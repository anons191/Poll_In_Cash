/**
 * Deploy MockUSDC to Base Sepolia using CDP SDK
 *
 * Run with: npx tsx src/scripts/deploy-mock-usdc.ts
 */

import "dotenv/config";
import { CdpClient } from "@coinbase/cdp-sdk";
import { createPublicClient, http, encodeFunctionData } from "viem";
import { baseSepolia } from "viem/chains";

// MockUSDC compiled bytecode from hardhat artifacts
const MOCK_USDC_BYTECODE =
  "0x608060405234801561001057600080fd5b50604051806040016040528060088152602001672aa9a21021b7b4b760c11b815250604051806040016040528060048152602001635553444360e01b815250816003908161005e9190610114565b50600461006b8282610114565b5050506101d3565b634e487b7160e01b600052604160045260246000fd5b600181811c9082168061009d57607f821691505b6020821081036100bd57634e487b7160e01b600052602260045260246000fd5b50919050565b601f82111561010f576000816000526020600020601f850160051c810160208610156100ec5750805b601f850160051c820191505b8181101561010b578281556001016100f8565b5050505b505050565b81516001600160401b0381111561012d5761012d610073565b6101418161013b8454610089565b846100c3565b602080601f831160018114610176576000841561015e5750858301515b600019600386901b1c1916600185901b17855561010b565b600085815260208120601f198616915b828110156101a557888601518255948401946001909101908401610186565b50858210156101c35787850151600019600388901b60f8161c191681555b5050505050600190811b01905550565b610786806101e26000396000f3fe608060405234801561001057600080fd5b506004361061009e5760003560e01c806340c10f191161006657806340c10f191461011857806370a082311461012d57806395d89b4114610156578063a9059cbb1461015e578063dd62ed3e1461017157600080fd5b806306fdde03146100a3578063095ea7b3146100c157806318160ddd146100e457806323b872dd146100f6578063313ce56714610109575b600080fd5b6100ab6101aa565b6040516100b891906105cf565b60405180910390f35b6100d46100cf36600461063a565b61023c565b60405190151581526020016100b8565b6002545b6040519081526020016100b8565b6100d4610104366004610664565b610256565b604051600681526020016100b8565b61012b61012636600461063a565b61027a565b005b6100e861013b3660046106a0565b6001600160a01b031660009081526020819052604090205490565b6100ab610288565b6100d461016c36600461063a565b610297565b6100e861017f3660046106c2565b6001600160a01b03918216600090815260016020908152604080832093909416825291909152205490565b6060600380546101b9906106f5565b80601f01602080910402602001604051908101604052809291908181526020018280546101e5906106f5565b80156102325780601f1061020757610100808354040283529160200191610232565b820191906000526020600020905b81548152906001019060200180831161021557829003601f168201915b5050505050905090565b60003361024a8185856102a5565b60019150505b92915050565b6000336102648582856102b7565b61026f85858561033b565b506001949350505050565b610284828261039a565b5050565b6060600480546101b9906106f5565b60003361024a81858561033b565b6102b283838360016103d0565b505050565b6001600160a01b03838116600090815260016020908152604080832093861683529290522054600019811015610335578181101561032657604051637dc7a0d960e11b81526001600160a01b038416600482015260248101829052604481018390526064015b60405180910390fd5b610335848484840360006103d0565b50505050565b6001600160a01b03831661036557604051634b637e8f60e11b81526000600482015260240161031d565b6001600160a01b03821661038f5760405163ec442f0560e01b81526000600482015260240161031d565b6102b28383836104a5565b6001600160a01b0382166103c45760405163ec442f0560e01b81526000600482015260240161031d565b610284600083836104a5565b6001600160a01b0384166103fa5760405163e602df0560e01b81526000600482015260240161031d565b6001600160a01b03831661042457604051634a1406b160e11b81526000600482015260240161031d565b6001600160a01b038085166000908152600160209081526040808320938716835292905220829055801561033557826001600160a01b0316846001600160a01b03167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b9258460405161049791815260200190565b60405180910390a350505050565b6001600160a01b0383166104d05780600260008282546104c5919061072f565b909155506105429050565b6001600160a01b038316600090815260208190526040902054818110156105235760405163391434e360e21b81526001600160a01b0385166004820152602481018290526044810183905260640161031d565b6001600160a01b03841660009081526020819052604090209082900390555b6001600160a01b03821661055e5760028054829003905561057d565b6001600160a01b03821660009081526020819052604090208054820190555b816001600160a01b0316836001600160a01b03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef836040516105c291815260200190565b60405180910390a3505050565b60006020808352835180602085015260005b818110156105fd578581018301518582016040015282016105e1565b506000604082860101526040601f19601f8301168501019250505092915050565b80356001600160a01b038116811461063557600080fd5b919050565b6000806040838503121561064d57600080fd5b6106568361061e565b946020939093013593505050565b60008060006060848603121561067957600080fd5b6106828461061e565b92506106906020850161061e565b9150604084013590509250925092565b6000602082840312156106b257600080fd5b6106bb8261061e565b9392505050565b600080604083850312156106d557600080fd5b6106de8361061e565b91506106ec6020840161061e565b90509250929050565b600181811c9082168061070957607f821691505b60208210810361072957634e487b7160e01b600052602260045260246000fd5b50919050565b8082018082111561025057634e487b7160e01b600052601160045260246000fdfea2646970667358221220bdff9c6646e437ce7f93d91d1f956a089f4d012f33796c1b06a512bb889cecbb64736f6c63430008180033";

const MOCK_USDC_ABI = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "pure",
    type: "function",
  },
] as const;

async function main() {
  console.log("=== DEPLOYING MOCK USDC TO BASE SEPOLIA ===\n");

  // Check CDP configuration
  const apiKeyId = process.env.CDP_API_KEY_ID;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET;
  const walletSecret = process.env.CDP_WALLET_SECRET;

  if (!apiKeyId || !apiKeySecret || !walletSecret) {
    console.error("Missing CDP configuration!");
    console.log("Required env vars: CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET");
    process.exit(1);
  }

  console.log("CDP configuration found");

  // Create CDP client
  const cdp = new CdpClient({
    apiKeyId,
    apiKeySecret,
    walletSecret,
  });

  // Get or create a wallet
  const FUNDED_WALLET_ADDRESS = "0x48D5AA3F8b10dF8FF3e1105654D05202915D3863";
  console.log("Using wallet:", FUNDED_WALLET_ADDRESS);

  // Create viem public client
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http("https://sepolia.base.org"),
  });

  // Check balance
  const balance = await publicClient.getBalance({
    address: FUNDED_WALLET_ADDRESS as `0x${string}`
  });
  console.log("Wallet balance:", Number(balance) / 1e18, "ETH");

  if (balance === 0n) {
    console.error("\nERROR: Wallet has no ETH for gas!");
    console.log("Get Base Sepolia ETH from: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet");
    process.exit(1);
  }

  // Deploy using CDP SDK's deployContract (requires solidity source)
  console.log("\n--- Deploying MockUSDC via CDP Smart Contract API ---");

  // MockUSDC Solidity source
  const soliditySource = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockUSDC {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public constant decimals = 6;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
`;

  try {
    // Use CDP to compile and deploy the contract
    const result = await cdp.evm.deployContract({
      address: FUNDED_WALLET_ADDRESS as `0x${string}`,
      networkId: "base-sepolia",
      contractName: "MockUSDC",
      solidityVersion: "0.8.24",
      solidityInputJson: JSON.stringify({
        language: "Solidity",
        sources: {
          "MockUSDC.sol": {
            content: soliditySource,
          },
        },
        settings: {
          outputSelection: {
            "*": {
              "*": ["abi", "evm.bytecode"],
            },
          },
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      }),
      constructorArgs: {},
    });

    console.log("\n=== DEPLOYMENT SUCCESSFUL ===");
    console.log("MockUSDC deployed to:", result.contractAddress);
    console.log("Transaction hash:", result.transactionHash);

    // Output for frontend
    console.log("\n=== ADD TO frontend/.env.local ===");
    console.log(`NEXT_PUBLIC_TEST_USDC_ADDRESS=${result.contractAddress}`);

    console.log("\n=== BASESCAN LINK ===");
    console.log(`https://sepolia.basescan.org/address/${result.contractAddress}`);

  } catch (error: any) {
    console.error("Deployment failed:", error.message || error);

    // If CDP deployment fails, provide alternative instructions
    console.log("\n=== ALTERNATIVE: Manual Deployment ===");
    console.log("If CDP contract deployment is not available, you can:");
    console.log("1. Use the existing Circle USDC on Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e");
    console.log("2. Get test USDC from: https://faucet.circle.com/");
    console.log("\nOr deploy manually via Remix at: https://remix.ethereum.org");

    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exit(1);
});
