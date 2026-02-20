// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title PollPool
 * @notice Escrow and distribution contract for the Poll in Cash polling marketplace
 * @dev Handles poll lifecycle: creation, response submission, closing, distribution, and refunds
 */
contract PollPool is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ============ Enums ============

    enum PollStatus {
        Active,
        Closed,
        Distributed,
        Cancelled
    }

    // ============ Structs ============

    struct Poll {
        address creator;
        string title;
        bytes32 criteriaHash;
        uint256 totalFunded;      // Total USDC funded by creator (before fee)
        uint256 distributablePool; // USDC available for distribution (after fee)
        uint256 participantCap;
        uint256 participantCount;
        uint256 expiresAt;
        PollStatus status;
    }

    // ============ State Variables ============

    IERC20 public immutable usdc;
    address public treasury;
    address public attestationSigner;

    uint256 public constant PLATFORM_FEE_BPS = 1000; // 10% = 1000 basis points
    uint256 public constant BPS_DENOMINATOR = 10000;

    uint256 public nextPollId;

    // pollId => Poll
    mapping(uint256 => Poll) public polls;

    // pollId => participant address => has participated
    mapping(uint256 => mapping(address => bool)) public hasParticipated;

    // pollId => array of participant addresses
    mapping(uint256 => address[]) public participants;

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
        uint256 finalParticipantCount
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

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event AttestationSignerUpdated(address indexed oldSigner, address indexed newSigner);

    // ============ Errors ============

    error InvalidAddress();
    error InvalidAmount();
    error InvalidDuration();
    error InvalidParticipantCap();
    error PollNotActive();
    error PollNotClosed();
    error PollAlreadyDistributed();
    error PollNotExpired();
    error ParticipantCapReached();
    error AlreadyParticipated();
    error InvalidAttestation();
    error NotPollCreator();
    error NothingToDistribute();

    // ============ Constructor ============

    /**
     * @notice Initialize the PollPool contract
     * @param _usdc Address of the USDC token contract
     * @param _treasury Address to receive platform fees
     * @param _attestationSigner Address of the trusted attestation signer
     */
    constructor(
        address _usdc,
        address _treasury,
        address _attestationSigner
    ) Ownable(msg.sender) {
        if (_usdc == address(0) || _treasury == address(0) || _attestationSigner == address(0)) {
            revert InvalidAddress();
        }

        usdc = IERC20(_usdc);
        treasury = _treasury;
        attestationSigner = _attestationSigner;
    }

    // ============ External Functions ============

    /**
     * @notice Create a new poll with USDC funding
     * @dev Caller must have approved this contract to spend USDC
     * @param _title Human-readable poll title
     * @param _criteriaHash Hash of the off-chain targeting criteria
     * @param _participantCap Maximum number of participants
     * @param _duration Duration in seconds until poll expires
     * @param _fundAmount Total USDC to fund (platform fee will be deducted)
     * @return pollId The ID of the newly created poll
     */
    function createPoll(
        string calldata _title,
        bytes32 _criteriaHash,
        uint256 _participantCap,
        uint256 _duration,
        uint256 _fundAmount
    ) external nonReentrant returns (uint256 pollId) {
        if (_fundAmount == 0) revert InvalidAmount();
        if (_participantCap == 0) revert InvalidParticipantCap();
        if (_duration == 0) revert InvalidDuration();

        // Calculate platform fee and distributable pool
        uint256 platformFee = (_fundAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 distributablePool = _fundAmount - platformFee;

        // Transfer USDC from creator to this contract
        usdc.safeTransferFrom(msg.sender, address(this), _fundAmount);

        // Send platform fee to treasury
        usdc.safeTransfer(treasury, platformFee);

        // Create poll
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
     * @notice Submit a response to a poll with attestation verification
     * @dev The attestation signature must be from the trusted attestation signer
     * @param _pollId ID of the poll to respond to
     * @param _attestationSignature Signature proving eligibility from attestation provider
     */
    function submitResponse(
        uint256 _pollId,
        bytes calldata _attestationSignature
    ) external nonReentrant {
        Poll storage poll = polls[_pollId];

        // Check poll is active
        if (poll.status != PollStatus.Active) revert PollNotActive();

        // Check poll hasn't expired
        if (block.timestamp >= poll.expiresAt) revert PollNotActive();

        // Check cap not reached
        if (poll.participantCount >= poll.participantCap) revert ParticipantCapReached();

        // Check not already participated
        if (hasParticipated[_pollId][msg.sender]) revert AlreadyParticipated();

        // Verify attestation signature
        if (!_verifyAttestation(_pollId, msg.sender, _attestationSignature)) {
            revert InvalidAttestation();
        }

        // Record participation
        hasParticipated[_pollId][msg.sender] = true;
        participants[_pollId].push(msg.sender);
        poll.participantCount++;

        emit ResponseSubmitted(_pollId, msg.sender, poll.participantCount);
    }

    /**
     * @notice Close a poll to stop new responses
     * @dev Callable by creator anytime, or by anyone after expiry
     * @param _pollId ID of the poll to close
     */
    function closePoll(uint256 _pollId) external {
        Poll storage poll = polls[_pollId];

        if (poll.status != PollStatus.Active) revert PollNotActive();

        // Only creator can close before expiry
        if (block.timestamp < poll.expiresAt && msg.sender != poll.creator) {
            revert NotPollCreator();
        }

        poll.status = PollStatus.Closed;

        emit PollClosed(_pollId, msg.sender, poll.participantCount);
    }

    /**
     * @notice Distribute funds to all participants after poll is closed
     * @dev Calculates even distribution, returns unused funds to creator
     * @param _pollId ID of the poll to distribute
     */
    function distribute(uint256 _pollId) external nonReentrant {
        Poll storage poll = polls[_pollId];

        if (poll.status != PollStatus.Closed) revert PollNotClosed();

        poll.status = PollStatus.Distributed;

        uint256 participantCount = poll.participantCount;
        uint256 distributablePool = poll.distributablePool;
        uint256 payoutPerPerson = 0;
        uint256 returnedToCreator = 0;

        if (participantCount == 0) {
            // No participants - return all funds to creator
            returnedToCreator = distributablePool;
            if (returnedToCreator > 0) {
                usdc.safeTransfer(poll.creator, returnedToCreator);
            }
        } else {
            // Calculate per-person payout
            payoutPerPerson = distributablePool / participantCount;
            uint256 totalDistributed = payoutPerPerson * participantCount;
            returnedToCreator = distributablePool - totalDistributed;

            // Distribute to each participant
            address[] storage pollParticipants = participants[_pollId];
            for (uint256 i = 0; i < participantCount; i++) {
                usdc.safeTransfer(pollParticipants[i], payoutPerPerson);
            }

            // Return any remainder to creator (due to rounding)
            if (returnedToCreator > 0) {
                usdc.safeTransfer(poll.creator, returnedToCreator);
            }
        }

        emit FundsDistributed(_pollId, participantCount, payoutPerPerson, returnedToCreator);
    }

    /**
     * @notice Cancel an active poll and refund remaining funds to creator
     * @dev Only callable by poll creator while poll is active
     * @param _pollId ID of the poll to cancel
     */
    function refund(uint256 _pollId) external nonReentrant {
        Poll storage poll = polls[_pollId];

        if (poll.status != PollStatus.Active) revert PollNotActive();
        if (msg.sender != poll.creator) revert NotPollCreator();

        poll.status = PollStatus.Cancelled;

        // Calculate refund amount (distributable pool minus any already committed payouts)
        // Since payouts happen at distribution, all distributable pool is refundable
        uint256 refundAmount = poll.distributablePool;

        if (refundAmount > 0) {
            usdc.safeTransfer(poll.creator, refundAmount);
        }

        emit PollCancelled(_pollId, msg.sender, refundAmount);
    }

    // ============ View Functions ============

    /**
     * @notice Get poll details
     * @param _pollId ID of the poll
     * @return Poll struct with all poll data
     */
    function getPoll(uint256 _pollId) external view returns (Poll memory) {
        return polls[_pollId];
    }

    /**
     * @notice Get all participants for a poll
     * @param _pollId ID of the poll
     * @return Array of participant addresses
     */
    function getParticipants(uint256 _pollId) external view returns (address[] memory) {
        return participants[_pollId];
    }

    /**
     * @notice Calculate expected payout per person for a poll
     * @param _pollId ID of the poll
     * @return payoutPerPerson Expected USDC payout if distributed now
     */
    function calculatePayout(uint256 _pollId) external view returns (uint256 payoutPerPerson) {
        Poll storage poll = polls[_pollId];
        if (poll.participantCount == 0) return 0;
        return poll.distributablePool / poll.participantCount;
    }

    /**
     * @notice Check if a poll has expired
     * @param _pollId ID of the poll
     * @return True if poll has expired
     */
    function isPollExpired(uint256 _pollId) external view returns (bool) {
        return block.timestamp >= polls[_pollId].expiresAt;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the treasury address
     * @param _newTreasury New treasury address
     */
    function setTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert InvalidAddress();
        address oldTreasury = treasury;
        treasury = _newTreasury;
        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }

    /**
     * @notice Update the attestation signer address
     * @param _newSigner New attestation signer address
     */
    function setAttestationSigner(address _newSigner) external onlyOwner {
        if (_newSigner == address(0)) revert InvalidAddress();
        address oldSigner = attestationSigner;
        attestationSigner = _newSigner;
        emit AttestationSignerUpdated(oldSigner, _newSigner);
    }

    // ============ Internal Functions ============

    /**
     * @notice Verify an attestation signature
     * @dev The message format is: keccak256(abi.encodePacked(pollId, participant, address(this)))
     * @param _pollId ID of the poll
     * @param _participant Address of the participant
     * @param _signature Signature from the attestation provider
     * @return True if signature is valid from trusted signer
     */
    function _verifyAttestation(
        uint256 _pollId,
        address _participant,
        bytes calldata _signature
    ) internal view returns (bool) {
        // Create the message that should have been signed
        bytes32 messageHash = keccak256(
            abi.encodePacked(_pollId, _participant, address(this))
        );

        // Convert to Ethereum signed message hash
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();

        // Recover the signer
        address recoveredSigner = ethSignedMessageHash.recover(_signature);

        return recoveredSigner == attestationSigner;
    }
}
