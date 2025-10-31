// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PollEscrow
 * @notice Manages USDC escrow for polls and executes payouts with platform fee
 * @dev Platform fee is 10%, user receives 90%
 */
contract PollEscrow is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    
    uint256 public constant PLATFORM_FEE_BPS = 1000; // 10% (1000 basis points)
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ============ State Variables ============
    
    IERC20 public immutable usdcToken;
    address public immutable platformTreasury;
    
    uint256 private _pollCounter;
    
    struct Poll {
        address creator;
        uint256 rewardPool;        // Total USDC in escrow
        uint256 rewardPerUser;      // USDC reward per completion
        uint256 completedCount;     // Number of completions
        uint256 maxCompletions;     // Max number of participants
        bool isActive;              // Poll status
        mapping(bytes32 => bool) nullifierHashes; // Track used nullifier hashes
    }
    
    mapping(uint256 => Poll) public polls;
    
    // ============ Events ============
    
    event PollCreated(
        uint256 indexed pollId,
        address indexed creator,
        uint256 rewardPool,
        uint256 rewardPerUser,
        uint256 maxCompletions
    );
    
    event PollCompleted(
        uint256 indexed pollId,
        address indexed participant,
        uint256 userPayout,
        uint256 platformFee,
        bytes32 nullifierHash
    );
    
    event PollClosed(uint256 indexed pollId);
    
    // ============ Errors ============
    
    error InvalidPoll();
    error PollNotActive();
    error PollExceededMaxCompletions();
    error NullifierHashAlreadyUsed();
    error InsufficientFunds();
    error TransferFailed();

    // ============ Constructor ============
    
    constructor(address _usdcToken, address _platformTreasury) Ownable(msg.sender) {
        require(_usdcToken != address(0), "Invalid USDC address");
        require(_platformTreasury != address(0), "Invalid treasury address");
        
        usdcToken = IERC20(_usdcToken);
        platformTreasury = _platformTreasury;
    }

    // ============ Public Functions ============
    
    /**
     * @notice Create a new poll with USDC escrow
     * @param _rewardPool Total USDC amount to escrow
     * @param _rewardPerUser USDC amount per user completion
     * @param _maxCompletions Maximum number of participants
     * @return pollId The ID of the newly created poll
     */
    function createPoll(
        uint256 _rewardPool,
        uint256 _rewardPerUser,
        uint256 _maxCompletions
    ) external nonReentrant returns (uint256) {
        require(_rewardPool > 0, "Reward pool must be > 0");
        require(_rewardPerUser > 0, "Reward per user must be > 0");
        require(_maxCompletions > 0, "Max completions must be > 0");
        
        uint256 pollId = ++_pollCounter;
        
        // Transfer USDC from creator to this contract
        usdcToken.safeTransferFrom(msg.sender, address(this), _rewardPool);
        
        Poll storage poll = polls[pollId];
        poll.creator = msg.sender;
        poll.rewardPool = _rewardPool;
        poll.rewardPerUser = _rewardPerUser;
        poll.maxCompletions = _maxCompletions;
        poll.isActive = true;
        
        emit PollCreated(pollId, msg.sender, _rewardPool, _rewardPerUser, _maxCompletions);
        
        return pollId;
    }
    
    /**
     * @notice Complete a poll and receive USDC payout
     * @param _pollId The ID of the poll to complete
     * @param _nullifierHash The World ID nullifier hash (prevents double-voting)
     * @dev Platform receives 10%, user receives 90%
     */
    function completePoll(
        uint256 _pollId,
        bytes32 _nullifierHash
    ) external nonReentrant {
        Poll storage poll = polls[_pollId];
        
        if (poll.creator == address(0)) {
            revert InvalidPoll();
        }
        
        if (!poll.isActive) {
            revert PollNotActive();
        }
        
        if (poll.completedCount >= poll.maxCompletions) {
            revert PollExceededMaxCompletions();
        }
        
        if (poll.nullifierHashes[_nullifierHash]) {
            revert NullifierHashAlreadyUsed();
        }
        
        // Mark nullifier hash as used
        poll.nullifierHashes[_nullifierHash] = true;
        poll.completedCount++;
        
        // Calculate payouts (90% user, 10% platform)
        uint256 userPayout = (poll.rewardPerUser * (BPS_DENOMINATOR - PLATFORM_FEE_BPS)) / BPS_DENOMINATOR;
        uint256 platformFee = poll.rewardPerUser - userPayout;
        
        // Transfer user payout
        usdcToken.safeTransfer(msg.sender, userPayout);
        
        // Transfer platform fee
        usdcToken.safeTransfer(platformTreasury, platformFee);
        
        emit PollCompleted(_pollId, msg.sender, userPayout, platformFee, _nullifierHash);
        
        // Auto-close poll if max completions reached
        if (poll.completedCount >= poll.maxCompletions) {
            poll.isActive = false;
            emit PollClosed(_pollId);
        }
    }
    
    /**
     * @notice Get poll information
     * @param _pollId The ID of the poll
     * @return creator The address of the poll creator
     * @return rewardPool Total USDC in escrow
     * @return rewardPerUser USDC reward per completion
     * @return completedCount Number of completions
     * @return maxCompletions Maximum number of participants
     * @return isActive Whether the poll is active
     */
    function getPollInfo(uint256 _pollId)
        external
        view
        returns (
            address creator,
            uint256 rewardPool,
            uint256 rewardPerUser,
            uint256 completedCount,
            uint256 maxCompletions,
            bool isActive
        )
    {
        Poll storage poll = polls[_pollId];
        return (
            poll.creator,
            poll.rewardPool,
            poll.rewardPerUser,
            poll.completedCount,
            poll.maxCompletions,
            poll.isActive
        );
    }
    
    /**
     * @notice Check if a nullifier hash has been used
     * @param _pollId The ID of the poll
     * @param _nullifierHash The nullifier hash to check
     * @return Whether the nullifier hash has been used
     */
    function isNullifierHashUsed(uint256 _pollId, bytes32 _nullifierHash)
        external
        view
        returns (bool)
    {
        return polls[_pollId].nullifierHashes[_nullifierHash];
    }
    
    /**
     * @notice Close a poll (only creator can close)
     * @param _pollId The ID of the poll to close
     */
    function closePoll(uint256 _pollId) external {
        Poll storage poll = polls[_pollId];
        require(poll.creator == msg.sender, "Only creator can close");
        require(poll.isActive, "Poll already closed");
        
        poll.isActive = false;
        emit PollClosed(_pollId);
    }
    
    /**
     * @notice Get the current poll counter
     * @return The total number of polls created
     */
    function getPollCounter() external view returns (uint256) {
        return _pollCounter;
    }
}

