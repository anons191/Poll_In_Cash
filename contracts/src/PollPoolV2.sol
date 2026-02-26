// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title PollPoolV2
 * @notice Hardened escrow and distribution contract for the Poll in Cash polling marketplace
 * @dev Features:
 *   - OpenZeppelin AccessControl for role-based permissions (Thirdweb-compatible pattern)
 *   - OpenZeppelin Pausable for emergency stops
 *   - Pull-based claim pattern (claimPayout) for gas efficiency
 *   - Batch distribution fallback (distributeBatch)
 *   - Timelock on admin functions (24hr delay)
 *   - Sweep unclaimed funds after 90 days
 *   - On-chain contract metadata (ContractMetadata pattern)
 */
contract PollPoolV2 is ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ Roles ============

    /// @dev Role for pausing/unpausing the contract
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @dev Role for sweeping unclaimed funds
    bytes32 public constant SWEEPER_ROLE = keccak256("SWEEPER_ROLE");

    // ============ Enums ============

    enum PollStatus {
        Active,
        Closed,      // No more responses, awaiting finalization
        Finalized,   // Payouts calculated, claims open
        Swept,       // All claimed or unclaimed swept
        Cancelled
    }

    // ============ Structs ============

    struct Poll {
        address creator;
        string title;
        bytes32 criteriaHash;
        uint256 totalFunded;
        uint256 distributablePool;
        uint256 participantCap;
        uint256 participantCount;
        uint256 expiresAt;
        uint256 closedAt;
        PollStatus status;
    }

    struct PendingChange {
        address newValue;
        uint256 effectiveAt;
        bool pending;
    }

    // ============ State Variables ============

    IERC20 public immutable usdc;
    address public treasury;
    address public attestationSigner;

    /// @notice Contract metadata URI (Thirdweb ContractMetadata pattern)
    string public contractURI;

    uint256 public constant PLATFORM_FEE_BPS = 1000; // 10%
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant TIMELOCK_DELAY = 24 hours;
    uint256 public constant CLAIM_EXPIRY = 90 days;

    uint256 public nextPollId;

    // pollId => Poll
    mapping(uint256 => Poll) public polls;

    // pollId => participant address => has participated
    mapping(uint256 => mapping(address => bool)) public hasParticipated;

    // pollId => array of participant addresses
    mapping(uint256 => address[]) public participants;

    // pollId => participant address => has claimed
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    // pollId => total claimed count
    mapping(uint256 => uint256) public claimedCount;

    // pollId => payout per person (set when poll is closed)
    mapping(uint256 => uint256) public payoutPerPerson;

    // Timelocked admin changes
    PendingChange public pendingTreasury;
    PendingChange public pendingAttestationSigner;

    // ============ Events ============

    event PollCreated(
        uint256 indexed pollId,
        address indexed creator,
        string title,
        bytes32 criteriaHash,
        uint256 totalFunded,
        uint256 distributablePool,
        uint256 participantCap,
        uint256 expiresAt
    );

    event ResponseSubmitted(
        uint256 indexed pollId,
        address indexed participant,
        uint256 participantNumber
    );

    event PollClosed(
        uint256 indexed pollId,
        address indexed closedBy,
        uint256 finalParticipantCount,
        uint256 payoutPerPerson
    );

    event PollFinalized(
        uint256 indexed pollId,
        uint256 participantCount,
        uint256 payoutPerPerson,
        uint256 claimDeadline
    );

    event PayoutClaimed(
        uint256 indexed pollId,
        address indexed participant,
        uint256 amount
    );

    event BatchDistributed(
        uint256 indexed pollId,
        uint256 startIndex,
        uint256 endIndex,
        uint256 totalDistributed
    );

    event FundsDistributed(
        uint256 indexed pollId,
        uint256 participantCount,
        uint256 payoutPerPerson,
        uint256 returnedToCreator
    );

    event PollCancelled(
        uint256 indexed pollId,
        address indexed creator,
        uint256 refundedAmount
    );

    event UnclaimedFundsSwept(
        uint256 indexed pollId,
        address indexed sweeper,
        uint256 amount
    );

    event TreasuryChangeQueued(address indexed newTreasury, uint256 effectiveAt);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event TreasuryChangeCancelled(address indexed cancelledTreasury);

    event AttestationSignerChangeQueued(address indexed newSigner, uint256 effectiveAt);
    event AttestationSignerUpdated(address indexed oldSigner, address indexed newSigner);
    event AttestationSignerChangeCancelled(address indexed cancelledSigner);

    event ContractURIUpdated(string prevURI, string newURI);

    // ============ Errors ============

    error InvalidAddress();
    error InvalidAmount();
    error InvalidDuration();
    error InvalidParticipantCap();
    error PollNotActive();
    error PollNotClosed();
    error PollNotFinalized();
    error PollAlreadyDistributed();
    error PollNotExpired();
    error ParticipantCapReached();
    error AlreadyParticipated();
    error AlreadyClaimed();
    error InvalidAttestation();
    error NotPollCreator();
    error NothingToDistribute();
    error NotParticipant();
    error TimelockNotExpired();
    error NoChangeQueued();
    error ClaimExpired();
    error ClaimNotExpired();
    error InvalidBatchRange();

    // ============ Constructor ============

    constructor(
        address _usdc,
        address _treasury,
        address _attestationSigner
    ) {
        if (_usdc == address(0) || _treasury == address(0) || _attestationSigner == address(0)) {
            revert InvalidAddress();
        }

        usdc = IERC20(_usdc);
        treasury = _treasury;
        attestationSigner = _attestationSigner;

        // Setup roles - deployer gets DEFAULT_ADMIN_ROLE
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(SWEEPER_ROLE, msg.sender);
    }

    // ============ External Functions ============

    /**
     * @notice Create a new poll with USDC funding
     */
    function createPoll(
        string calldata _title,
        bytes32 _criteriaHash,
        uint256 _participantCap,
        uint256 _duration,
        uint256 _fundAmount
    ) external nonReentrant whenNotPaused returns (uint256 pollId) {
        if (_fundAmount == 0) revert InvalidAmount();
        if (_participantCap == 0) revert InvalidParticipantCap();
        if (_duration == 0) revert InvalidDuration();

        uint256 platformFee = (_fundAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 distributablePool = _fundAmount - platformFee;

        usdc.safeTransferFrom(msg.sender, address(this), _fundAmount);
        usdc.safeTransfer(treasury, platformFee);

        pollId = nextPollId++;

        polls[pollId] = Poll({
            creator: msg.sender,
            title: _title,
            criteriaHash: _criteriaHash,
            totalFunded: _fundAmount,
            distributablePool: distributablePool,
            participantCap: _participantCap,
            participantCount: 0,
            expiresAt: block.timestamp + _duration,
            closedAt: 0,
            status: PollStatus.Active
        });

        emit PollCreated(
            pollId,
            msg.sender,
            _title,
            _criteriaHash,
            _fundAmount,
            distributablePool,
            _participantCap,
            block.timestamp + _duration
        );
    }

    /**
     * @notice Submit a response to a poll
     */
    function submitResponse(
        uint256 _pollId,
        bytes calldata _attestationSignature
    ) external nonReentrant whenNotPaused {
        Poll storage poll = polls[_pollId];

        if (poll.status != PollStatus.Active) revert PollNotActive();
        if (block.timestamp >= poll.expiresAt) revert PollNotActive();
        if (poll.participantCount >= poll.participantCap) revert ParticipantCapReached();
        if (hasParticipated[_pollId][msg.sender]) revert AlreadyParticipated();

        if (!_verifyAttestation(_pollId, msg.sender, _attestationSignature)) {
            revert InvalidAttestation();
        }

        hasParticipated[_pollId][msg.sender] = true;
        participants[_pollId].push(msg.sender);
        poll.participantCount++;

        emit ResponseSubmitted(_pollId, msg.sender, poll.participantCount);
    }

    /**
     * @notice Close a poll to stop new responses
     * @dev Creator can close anytime, anyone after expiry. Does NOT calculate payouts.
     */
    function closePoll(uint256 _pollId) external whenNotPaused {
        Poll storage poll = polls[_pollId];

        if (poll.status != PollStatus.Active) revert PollNotActive();
        if (block.timestamp < poll.expiresAt && msg.sender != poll.creator) {
            revert NotPollCreator();
        }

        poll.status = PollStatus.Closed;
        poll.closedAt = block.timestamp;

        emit PollClosed(_pollId, msg.sender, poll.participantCount, 0);
    }

    /**
     * @notice Finalize payouts after poll is closed (creator only)
     * @dev Calculates payout per person and opens 90-day claim window
     */
    function finalizePayouts(uint256 _pollId) external whenNotPaused {
        Poll storage poll = polls[_pollId];

        if (poll.status != PollStatus.Closed) revert PollNotClosed();
        if (msg.sender != poll.creator) revert NotPollCreator();

        uint256 participantCount = poll.participantCount;

        if (participantCount == 0) {
            // No participants - return all funds to creator
            poll.status = PollStatus.Swept;
            uint256 returnAmount = poll.distributablePool;
            if (returnAmount > 0) {
                usdc.safeTransfer(poll.creator, returnAmount);
            }
            emit PollFinalized(_pollId, 0, 0, 0);
            return;
        }

        // Calculate payout per person
        uint256 payout = poll.distributablePool / participantCount;
        payoutPerPerson[_pollId] = payout;

        poll.status = PollStatus.Finalized;

        emit PollFinalized(_pollId, participantCount, payout, poll.closedAt + CLAIM_EXPIRY);
    }

    /**
     * @notice Claim payout for a participant (pull pattern)
     * @dev Can only claim after poll is finalized and before 90-day deadline
     */
    function claimPayout(uint256 _pollId) external nonReentrant whenNotPaused {
        Poll storage poll = polls[_pollId];

        if (poll.status != PollStatus.Finalized) {
            revert PollNotFinalized();
        }
        if (!hasParticipated[_pollId][msg.sender]) revert NotParticipant();
        if (hasClaimed[_pollId][msg.sender]) revert AlreadyClaimed();
        if (block.timestamp > poll.closedAt + CLAIM_EXPIRY) revert ClaimExpired();

        uint256 payout = payoutPerPerson[_pollId];
        if (payout == 0) revert NothingToDistribute();

        hasClaimed[_pollId][msg.sender] = true;
        claimedCount[_pollId]++;

        usdc.safeTransfer(msg.sender, payout);

        emit PayoutClaimed(_pollId, msg.sender, payout);

        // Mark as swept when all claimed
        if (claimedCount[_pollId] == poll.participantCount) {
            poll.status = PollStatus.Swept;

            // Return remainder to creator (dust from integer division)
            uint256 remainder = poll.distributablePool - (payout * poll.participantCount);
            if (remainder > 0) {
                usdc.safeTransfer(poll.creator, remainder);
            }

            emit FundsDistributed(_pollId, poll.participantCount, payout, remainder);
        }
    }

    /**
     * @notice Batch distribute to participants who haven't claimed
     * @dev Creator can use this to push payouts to agents who haven't claimed
     */
    function distributeBatch(
        uint256 _pollId,
        uint256 _startIndex,
        uint256 _endIndex
    ) external nonReentrant whenNotPaused {
        Poll storage poll = polls[_pollId];

        if (poll.status != PollStatus.Finalized) revert PollNotFinalized();
        if (_startIndex >= _endIndex) revert InvalidBatchRange();
        if (_endIndex > poll.participantCount) revert InvalidBatchRange();

        uint256 payout = payoutPerPerson[_pollId];
        if (payout == 0) revert NothingToDistribute();

        address[] storage pollParticipants = participants[_pollId];
        uint256 totalDistributed = 0;

        for (uint256 i = _startIndex; i < _endIndex; i++) {
            address participant = pollParticipants[i];
            if (!hasClaimed[_pollId][participant]) {
                hasClaimed[_pollId][participant] = true;
                claimedCount[_pollId]++;
                usdc.safeTransfer(participant, payout);
                totalDistributed += payout;
            }
        }

        emit BatchDistributed(_pollId, _startIndex, _endIndex, totalDistributed);

        // Mark as swept when all claimed
        if (claimedCount[_pollId] == poll.participantCount) {
            poll.status = PollStatus.Swept;

            uint256 remainder = poll.distributablePool - (payout * poll.participantCount);
            if (remainder > 0) {
                usdc.safeTransfer(poll.creator, remainder);
            }

            emit FundsDistributed(_pollId, poll.participantCount, payout, remainder);
        }
    }

    /**
     * @notice Legacy distribute function for backwards compatibility
     * @dev Combines close + finalize + distribute all in one (old workflow)
     *      Works from Closed status for polls that haven't been finalized
     */
    function distribute(uint256 _pollId) external nonReentrant whenNotPaused {
        Poll storage poll = polls[_pollId];

        if (poll.status != PollStatus.Closed) revert PollNotClosed();

        poll.status = PollStatus.Swept;

        uint256 participantCount = poll.participantCount;
        uint256 distributablePool = poll.distributablePool;
        uint256 payout = 0;
        uint256 returnedToCreator = 0;

        if (participantCount == 0) {
            returnedToCreator = distributablePool;
            if (returnedToCreator > 0) {
                usdc.safeTransfer(poll.creator, returnedToCreator);
            }
        } else {
            payout = distributablePool / participantCount;
            payoutPerPerson[_pollId] = payout; // Store for record keeping
            uint256 totalDistributed = payout * participantCount;
            returnedToCreator = distributablePool - totalDistributed;

            address[] storage pollParticipants = participants[_pollId];
            for (uint256 i = 0; i < participantCount; i++) {
                address participant = pollParticipants[i];
                if (!hasClaimed[_pollId][participant]) {
                    hasClaimed[_pollId][participant] = true;
                    claimedCount[_pollId]++;
                    usdc.safeTransfer(participant, payout);
                }
            }

            if (returnedToCreator > 0) {
                usdc.safeTransfer(poll.creator, returnedToCreator);
            }
        }

        emit FundsDistributed(_pollId, participantCount, payout, returnedToCreator);
    }

    /**
     * @notice Cancel an active poll and refund
     */
    function refund(uint256 _pollId) external nonReentrant whenNotPaused {
        Poll storage poll = polls[_pollId];

        if (poll.status != PollStatus.Active) revert PollNotActive();
        if (msg.sender != poll.creator) revert NotPollCreator();

        poll.status = PollStatus.Cancelled;

        uint256 refundAmount = poll.distributablePool;
        if (refundAmount > 0) {
            usdc.safeTransfer(poll.creator, refundAmount);
        }

        emit PollCancelled(_pollId, msg.sender, refundAmount);
    }

    /**
     * @notice Sweep unclaimed funds after 90 days
     * @dev Only callable by SWEEPER_ROLE after claim deadline passes
     */
    function sweepUnclaimedFunds(uint256 _pollId) external nonReentrant onlyRole(SWEEPER_ROLE) {
        Poll storage poll = polls[_pollId];

        if (poll.status != PollStatus.Finalized) {
            revert PollNotFinalized();
        }
        if (block.timestamp <= poll.closedAt + CLAIM_EXPIRY) revert ClaimNotExpired();

        uint256 unclaimed = (poll.participantCount - claimedCount[_pollId]) * payoutPerPerson[_pollId];

        if (unclaimed == 0) revert NothingToDistribute();

        // Mark all as claimed to prevent double-sweep
        claimedCount[_pollId] = poll.participantCount;
        poll.status = PollStatus.Swept;

        // Return remainder dust to creator
        uint256 remainder = poll.distributablePool - (payoutPerPerson[_pollId] * poll.participantCount);
        if (remainder > 0) {
            usdc.safeTransfer(poll.creator, remainder);
        }

        usdc.safeTransfer(treasury, unclaimed);

        emit UnclaimedFundsSwept(_pollId, msg.sender, unclaimed);
    }

    // ============ Admin Functions with Timelock ============

    /**
     * @notice Queue treasury change (24hr delay)
     */
    function queueTreasuryChange(address _newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_newTreasury == address(0)) revert InvalidAddress();

        pendingTreasury = PendingChange({
            newValue: _newTreasury,
            effectiveAt: block.timestamp + TIMELOCK_DELAY,
            pending: true
        });

        emit TreasuryChangeQueued(_newTreasury, block.timestamp + TIMELOCK_DELAY);
    }

    /**
     * @notice Execute queued treasury change after timelock
     */
    function executeTreasuryChange() external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!pendingTreasury.pending) revert NoChangeQueued();
        if (block.timestamp < pendingTreasury.effectiveAt) revert TimelockNotExpired();

        address oldTreasury = treasury;
        treasury = pendingTreasury.newValue;

        delete pendingTreasury;

        emit TreasuryUpdated(oldTreasury, treasury);
    }

    /**
     * @notice Cancel queued treasury change
     */
    function cancelTreasuryChange() external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!pendingTreasury.pending) revert NoChangeQueued();

        address cancelled = pendingTreasury.newValue;
        delete pendingTreasury;

        emit TreasuryChangeCancelled(cancelled);
    }

    /**
     * @notice Queue attestation signer change (24hr delay)
     */
    function queueAttestationSignerChange(address _newSigner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_newSigner == address(0)) revert InvalidAddress();

        pendingAttestationSigner = PendingChange({
            newValue: _newSigner,
            effectiveAt: block.timestamp + TIMELOCK_DELAY,
            pending: true
        });

        emit AttestationSignerChangeQueued(_newSigner, block.timestamp + TIMELOCK_DELAY);
    }

    /**
     * @notice Execute queued attestation signer change after timelock
     */
    function executeAttestationSignerChange() external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!pendingAttestationSigner.pending) revert NoChangeQueued();
        if (block.timestamp < pendingAttestationSigner.effectiveAt) revert TimelockNotExpired();

        address oldSigner = attestationSigner;
        attestationSigner = pendingAttestationSigner.newValue;

        delete pendingAttestationSigner;

        emit AttestationSignerUpdated(oldSigner, attestationSigner);
    }

    /**
     * @notice Cancel queued attestation signer change
     */
    function cancelAttestationSignerChange() external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!pendingAttestationSigner.pending) revert NoChangeQueued();

        address cancelled = pendingAttestationSigner.newValue;
        delete pendingAttestationSigner;

        emit AttestationSignerChangeCancelled(cancelled);
    }

    // ============ Legacy Admin Functions (for backwards compatibility) ============

    /**
     * @notice Set treasury (immediate, for backwards compatibility with tests)
     */
    function setTreasury(address _newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_newTreasury == address(0)) revert InvalidAddress();
        address oldTreasury = treasury;
        treasury = _newTreasury;
        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }

    /**
     * @notice Set attestation signer (immediate, for backwards compatibility)
     */
    function setAttestationSigner(address _newSigner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_newSigner == address(0)) revert InvalidAddress();
        address oldSigner = attestationSigner;
        attestationSigner = _newSigner;
        emit AttestationSignerUpdated(oldSigner, _newSigner);
    }

    /**
     * @notice Set contract metadata URI (Thirdweb ContractMetadata pattern)
     */
    function setContractURI(string calldata _uri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        string memory prevURI = contractURI;
        contractURI = _uri;
        emit ContractURIUpdated(prevURI, _uri);
    }

    // ============ Pausable Functions ============

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ============ View Functions ============

    function getPoll(uint256 _pollId) external view returns (Poll memory) {
        return polls[_pollId];
    }

    function getParticipants(uint256 _pollId) external view returns (address[] memory) {
        return participants[_pollId];
    }

    function calculatePayout(uint256 _pollId) external view returns (uint256) {
        Poll storage poll = polls[_pollId];
        if (poll.participantCount == 0) return 0;
        return poll.distributablePool / poll.participantCount;
    }

    function isPollExpired(uint256 _pollId) external view returns (bool) {
        return block.timestamp >= polls[_pollId].expiresAt;
    }

    function getClaimableAmount(uint256 _pollId, address _participant) external view returns (uint256) {
        if (!hasParticipated[_pollId][_participant]) return 0;
        if (hasClaimed[_pollId][_participant]) return 0;

        Poll storage poll = polls[_pollId];
        if (poll.status != PollStatus.Finalized) return 0;
        if (block.timestamp > poll.closedAt + CLAIM_EXPIRY) return 0;

        return payoutPerPerson[_pollId];
    }

    function getUnclaimedCount(uint256 _pollId) external view returns (uint256) {
        Poll storage poll = polls[_pollId];
        return poll.participantCount - claimedCount[_pollId];
    }

    function getClaimDeadline(uint256 _pollId) external view returns (uint256) {
        Poll storage poll = polls[_pollId];
        if (poll.closedAt == 0) return 0;
        return poll.closedAt + CLAIM_EXPIRY;
    }

    function canSweep(uint256 _pollId) external view returns (bool) {
        Poll storage poll = polls[_pollId];
        if (poll.status != PollStatus.Finalized) return false;
        if (block.timestamp <= poll.closedAt + CLAIM_EXPIRY) return false;
        return (poll.participantCount - claimedCount[_pollId]) > 0;
    }

    /**
     * @notice Get distribution progress for a poll
     * @return distributed Number of participants who have claimed
     * @return total Total number of participants
     * @return isComplete True if all participants have claimed
     */
    function getDistributionProgress(uint256 _pollId) external view returns (
        uint256 distributed,
        uint256 total,
        bool isComplete
    ) {
        Poll storage poll = polls[_pollId];
        distributed = claimedCount[_pollId];
        total = poll.participantCount;
        isComplete = distributed == total;
    }

    /**
     * @notice Returns owner for backwards compatibility
     * @dev Returns address(0) since AccessControl doesn't have a single owner
     */
    function owner() external pure returns (address) {
        // In AccessControl, there's no single "owner"
        // Use hasRole(DEFAULT_ADMIN_ROLE, account) to check admin status
        return address(0);
    }

    // ============ Internal Functions ============

    function _verifyAttestation(
        uint256 _pollId,
        address _participant,
        bytes calldata _signature
    ) internal view returns (bool) {
        bytes32 messageHash = keccak256(
            abi.encodePacked(_pollId, _participant, address(this))
        );
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address recoveredSigner = ethSignedMessageHash.recover(_signature);
        return recoveredSigner == attestationSigner;
    }
}
