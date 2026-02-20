/**
 * Smart Wallet Service Tests
 *
 * Tests for CDP smart wallet provisioning and gasless transactions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { CdpSmartWalletProvider } from "@coinbase/agentkit";

// Mock the agentkit module
vi.mock("@coinbase/agentkit", () => ({
  CdpSmartWalletProvider: {
    configureWithWallet: vi.fn(),
  },
}));

// Import after mocking
import { CdpSmartWalletProvider as MockedProvider } from "@coinbase/agentkit";
import {
  createSmartWalletProvider,
  getSmartWalletByAddress,
  createSmartWalletWithOwner,
  provisionAgentSmartWallet,
  sendGaslessTransaction,
  waitForReceipt,
  isGaslessAvailable,
} from "../smart-wallet.js";
import {
  SUPPORTED_NETWORKS,
  TransactionStatus,
  type WalletAddress,
  type TransactionHash,
} from "../../../types/wallet.js";

describe("CDP Smart Wallet Service", () => {
  const originalEnv = process.env;

  const mockAddress = "0x1234567890123456789012345678901234567890" as WalletAddress;
  const mockOwnerAddress = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as WalletAddress;
  const mockTxHash = "0x1234567890123456789012345678901234567890123456789012345678901234" as TransactionHash;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = {
      ...originalEnv,
      CDP_API_KEY_ID: "test-api-key-id",
      CDP_API_KEY_SECRET: "test-api-key-secret",
      CDP_WALLET_SECRET: "test-wallet-secret",
      NODE_ENV: "test",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isGaslessAvailable", () => {
    it("should return true on base-sepolia (testnet)", () => {
      process.env.NODE_ENV = "development";
      expect(isGaslessAvailable()).toBe(true);
    });

    it("should return true on mainnet if paymaster is configured", () => {
      process.env.NODE_ENV = "production";
      process.env.CDP_PAYMASTER_URL = "https://paymaster.example.com";
      expect(isGaslessAvailable()).toBe(true);
    });

    it("should return false on mainnet without paymaster", () => {
      process.env.NODE_ENV = "production";
      delete process.env.CDP_PAYMASTER_URL;
      expect(isGaslessAvailable()).toBe(false);
    });
  });

  describe("createSmartWalletProvider", () => {
    const mockProvider = {
      getAddress: vi.fn(() => mockAddress),
      smartAccount: { address: mockAddress },
      ownerAccount: { address: mockOwnerAddress },
      exportWallet: vi.fn(() =>
        Promise.resolve({
          name: "test-smart-wallet",
          address: mockAddress,
          ownerAddress: mockOwnerAddress,
        })
      ),
    };

    beforeEach(() => {
      (MockedProvider.configureWithWallet as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockProvider as unknown as CdpSmartWalletProvider
      );
    });

    it("should create a smart wallet provider with correct config", async () => {
      await createSmartWalletProvider();

      expect(MockedProvider.configureWithWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKeyId: "test-api-key-id",
          apiKeySecret: "test-api-key-secret",
          walletSecret: "test-wallet-secret",
          networkId: SUPPORTED_NETWORKS.BASE_SEPOLIA,
        })
      );
    });

    it("should include paymaster URL when configured", async () => {
      process.env.CDP_PAYMASTER_URL = "https://paymaster.example.com";

      await createSmartWalletProvider();

      expect(MockedProvider.configureWithWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          paymasterUrl: "https://paymaster.example.com",
        })
      );
    });
  });

  describe("getSmartWalletByAddress", () => {
    const mockProvider = {
      getAddress: vi.fn(() => mockAddress),
    };

    beforeEach(() => {
      (MockedProvider.configureWithWallet as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockProvider as unknown as CdpSmartWalletProvider
      );
    });

    it("should create provider with specific address", async () => {
      await getSmartWalletByAddress(mockAddress);

      expect(MockedProvider.configureWithWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockAddress,
        })
      );
    });

    it("should include owner address when provided", async () => {
      await getSmartWalletByAddress(mockAddress, mockOwnerAddress);

      expect(MockedProvider.configureWithWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockAddress,
          owner: mockOwnerAddress,
        })
      );
    });
  });

  describe("createSmartWalletWithOwner", () => {
    const mockProvider = {
      getAddress: vi.fn(() => mockAddress),
    };

    beforeEach(() => {
      (MockedProvider.configureWithWallet as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockProvider as unknown as CdpSmartWalletProvider
      );
    });

    it("should create smart wallet with owner address", async () => {
      await createSmartWalletWithOwner(mockOwnerAddress);

      expect(MockedProvider.configureWithWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: mockOwnerAddress,
        })
      );
    });

    it("should include name when provided", async () => {
      await createSmartWalletWithOwner(mockOwnerAddress, "my-smart-wallet");

      expect(MockedProvider.configureWithWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: mockOwnerAddress,
          smartAccountName: "my-smart-wallet",
        })
      );
    });
  });

  describe("provisionAgentSmartWallet", () => {
    const mockProvider = {
      getAddress: vi.fn(() => mockAddress),
      exportWallet: vi.fn(() =>
        Promise.resolve({
          name: "agent-smart-wallet-agent123",
          address: mockAddress,
          ownerAddress: mockOwnerAddress,
        })
      ),
    };

    beforeEach(() => {
      (MockedProvider.configureWithWallet as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockProvider as unknown as CdpSmartWalletProvider
      );
    });

    it("should provision a smart wallet for an agent", async () => {
      const result = await provisionAgentSmartWallet(mockOwnerAddress, "agent123");

      expect(MockedProvider.configureWithWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: mockOwnerAddress,
          smartAccountName: "agent-smart-wallet-agent123",
        })
      );
      expect(result.provider).toBe(mockProvider);
    });

    it("should return exported smart wallet data", async () => {
      const result = await provisionAgentSmartWallet(mockOwnerAddress, "agent123");

      expect(result.exportedData).toEqual(
        expect.objectContaining({
          name: "agent-smart-wallet-agent123",
          address: mockAddress,
          ownerAddress: mockOwnerAddress,
          networkId: SUPPORTED_NETWORKS.BASE_SEPOLIA,
        })
      );
      expect(result.exportedData.createdAt).toBeDefined();
    });
  });

  describe("sendGaslessTransaction", () => {
    const mockProvider = {
      sendTransaction: vi.fn(() => Promise.resolve(mockTxHash)),
    } as unknown as CdpSmartWalletProvider;

    it("should send a transaction and return hash", async () => {
      const transaction = {
        to: mockAddress as `0x${string}`,
        data: "0x1234" as `0x${string}`,
        value: BigInt(0),
      };

      const result = await sendGaslessTransaction(mockProvider, transaction);

      expect(mockProvider.sendTransaction).toHaveBeenCalledWith(transaction);
      expect(result).toBe(mockTxHash);
    });
  });

  describe("waitForReceipt", () => {
    it("should return confirmed receipt on success", async () => {
      const mockProvider = {
        waitForTransactionReceipt: vi.fn(() =>
          Promise.resolve({
            transactionHash: mockTxHash,
            status: "success",
            blockNumber: BigInt(12345),
            gasUsed: BigInt(21000),
            effectiveGasPrice: BigInt(1000000000),
          })
        ),
      } as unknown as CdpSmartWalletProvider;

      const result = await waitForReceipt(mockProvider, mockTxHash);

      expect(result.status).toBe(TransactionStatus.CONFIRMED);
      expect(result.hash).toBe(mockTxHash);
      expect(result.blockNumber).toBe(12345);
    });

    it("should return failed receipt on failure", async () => {
      const mockProvider = {
        waitForTransactionReceipt: vi.fn(() =>
          Promise.resolve({
            transactionHash: mockTxHash,
            status: "reverted",
            blockNumber: BigInt(12345),
          })
        ),
      } as unknown as CdpSmartWalletProvider;

      const result = await waitForReceipt(mockProvider, mockTxHash);

      expect(result.status).toBe(TransactionStatus.FAILED);
    });
  });
});
