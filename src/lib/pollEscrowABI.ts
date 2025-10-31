/**
 * PollEscrow Contract ABI
 * Generated from contracts/PollEscrow.sol
 * This will be updated after contract deployment with the actual ABI
 */

export const pollEscrowABI = [
  {
    inputs: [
      { internalType: "uint256", name: "_rewardPool", type: "uint256" },
      { internalType: "uint256", name: "_rewardPerUser", type: "uint256" },
      { internalType: "uint256", name: "_maxCompletions", type: "uint256" },
    ],
    name: "createPoll",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_pollId", type: "uint256" },
      { internalType: "bytes32", name: "_nullifierHash", type: "bytes32" },
    ],
    name: "completePoll",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_pollId", type: "uint256" }],
    name: "getPollInfo",
    outputs: [
      { internalType: "address", name: "creator", type: "address" },
      { internalType: "uint256", name: "rewardPool", type: "uint256" },
      { internalType: "uint256", name: "rewardPerUser", type: "uint256" },
      { internalType: "uint256", name: "completedCount", type: "uint256" },
      { internalType: "uint256", name: "maxCompletions", type: "uint256" },
      { internalType: "bool", name: "isActive", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_pollId", type: "uint256" },
      { internalType: "bytes32", name: "_nullifierHash", type: "bytes32" },
    ],
    name: "isNullifierHashUsed",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_pollId", type: "uint256" }],
    name: "closePoll",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getPollCounter",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "PLATFORM_FEE_BPS",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "platformTreasury",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "usdcToken",
    outputs: [{ internalType: "contract IERC20", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { indexed: true, internalType: "uint256", name: "pollId", type: "uint256" },
      { indexed: true, internalType: "address", name: "creator", type: "address" },
      { internalType: "uint256", name: "rewardPool", type: "uint256" },
      { internalType: "uint256", name: "rewardPerUser", type: "uint256" },
      { internalType: "uint256", name: "maxCompletions", type: "uint256" },
    ],
    name: "PollCreated",
    type: "event",
  },
  {
    inputs: [
      { indexed: true, internalType: "uint256", name: "pollId", type: "uint256" },
      { indexed: true, internalType: "address", name: "participant", type: "address" },
      { internalType: "uint256", name: "userPayout", type: "uint256" },
      { internalType: "uint256", name: "platformFee", type: "uint256" },
      { internalType: "bytes32", name: "nullifierHash", type: "bytes32" },
    ],
    name: "PollCompleted",
    type: "event",
  },
  {
    inputs: [{ indexed: true, internalType: "uint256", name: "pollId", type: "uint256" }],
    name: "PollClosed",
    type: "event",
  },
] as const;

