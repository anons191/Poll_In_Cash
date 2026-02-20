/**
 * Wallet Provider Service Tests
 *
 * Tests for CDP wallet provisioning and management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { CdpEvmWalletProvider } from "@coinbase/agentkit";

// Mock the agentkit module
vi.mock("@coinbase/agentkit", () => ({
  CdpEvmWalletProvider: {
    configureWithWallet: vi.fn(),
  },
}));

// Import after mocking
import { CdpEvmWalletProvider as MockedProvider } from "@coinbase/agentkit";
import {
  createWalletProvider,
  getWalletProviderByAddress,
  createWalletWithIdempotencyKey,
  provisionAgentWallet,
  restoreWalletProvider,
  exportWalletData,
  isCdpConfigured,
  getCurrentNetworkId,
} from "../wallet-provider.js";
import { SUPPORTED_NETWORKS, WalletProviderType } from "../../../types/wallet.js";

describe("CDP Wallet Provider Service", () => {
  const originalEnv = process.env;

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

  describe("isCdpConfigured", () => {
    it("should return true when all CDP env vars are set", () => {
      expect(isCdpConfigured()).toBe(true);
    });

    it("should return false when CDP_API_KEY_ID is missing", () => {
      delete process.env.CDP_API_KEY_ID;
      expect(isCdpConfigured()).toBe(false);
    });

    it("should return false when CDP_API_KEY_SECRET is missing", () => {
      delete process.env.CDP_API_KEY_SECRET;
      expect(isCdpConfigured()).toBe(false);
    });

    it("should return false when CDP_WALLET_SECRET is missing", () => {
      delete process.env.CDP_WALLET_SECRET;
      expect(isCdpConfigured()).toBe(false);
    });
  });

  describe("getCurrentNetworkId", () => {
    it("should return base-sepolia in development", () => {
      process.env.NODE_ENV = "development";
      expect(getCurrentNetworkId()).toBe(SUPPORTED_NETWORKS.BASE_SEPOLIA);
    });

    it("should return base-sepolia in test", () => {
      process.env.NODE_ENV = "test";
      expect(getCurrentNetworkId()).toBe(SUPPORTED_NETWORKS.BASE_SEPOLIA);
    });

    it("should return base-mainnet in production", () => {
      process.env.NODE_ENV = "production";
      expect(getCurrentNetworkId()).toBe(SUPPORTED_NETWORKS.BASE_MAINNET);
    });
  });

  describe("createWalletProvider", () => {
    const mockProvider = {
      getAddress: vi.fn(() => "0x1234567890123456789012345678901234567890"),
      getBalance: vi.fn(() => Promise.resolve(BigInt(1000000))),
      exportWallet: vi.fn(() =>
        Promise.resolve({
          name: "test-wallet",
          address: "0x1234567890123456789012345678901234567890",
        })
      ),
    };

    beforeEach(() => {
      (MockedProvider.configureWithWallet as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockProvider as unknown as CdpEvmWalletProvider
      );
    });

    it("should create a wallet provider with correct config", async () => {
      await createWalletProvider();

      expect(MockedProvider.configureWithWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKeyId: "test-api-key-id",
          apiKeySecret: "test-api-key-secret",
          walletSecret: "test-wallet-secret",
          networkId: SUPPORTED_NETWORKS.BASE_SEPOLIA,
        })
      );
    });

    it("should merge custom config with defaults", async () => {
      await createWalletProvider({
        networkId: "ethereum-sepolia",
      });

      expect(MockedProvider.configureWithWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          networkId: "ethereum-sepolia",
        })
      );
    });

    it("should throw if CDP credentials are missing", async () => {
      delete process.env.CDP_API_KEY_ID;

      await expect(createWalletProvider()).rejects.toThrow(
        "CDP_API_KEY_ID environment variable is required"
      );
    });
  });

  describe("getWalletProviderByAddress", () => {
    const mockProvider = {
      getAddress: vi.fn(() => "0x1234567890123456789012345678901234567890"),
    };

    beforeEach(() => {
      (MockedProvider.configureWithWallet as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockProvider as unknown as CdpEvmWalletProvider
      );
    });

    it("should create provider with specific address", async () => {
      const address = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
      await getWalletProviderByAddress(address as any);

      expect(MockedProvider.configureWithWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          address,
        })
      );
    });
  });

  describe("createWalletWithIdempotencyKey", () => {
    const mockProvider = {
      getAddress: vi.fn(() => "0x1234567890123456789012345678901234567890"),
    };

    beforeEach(() => {
      (MockedProvider.configureWithWallet as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockProvider as unknown as CdpEvmWalletProvider
      );
    });

    it("should create provider with idempotency key", async () => {
      await createWalletWithIdempotencyKey("unique-key-123");

      expect(MockedProvider.configureWithWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "unique-key-123",
        })
      );
    });
  });

  describe("provisionAgentWallet", () => {
    const mockProvider = {
      getAddress: vi.fn(() => "0x1234567890123456789012345678901234567890"),
      exportWallet: vi.fn(() =>
        Promise.resolve({
          name: "agent-wallet-user123",
          address: "0x1234567890123456789012345678901234567890",
        })
      ),
    };

    beforeEach(() => {
      (MockedProvider.configureWithWallet as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockProvider as unknown as CdpEvmWalletProvider
      );
    });

    it("should provision a new agent wallet with user ID as idempotency key", async () => {
      const result = await provisionAgentWallet("user123");

      expect(MockedProvider.configureWithWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "agent-wallet-user123",
        })
      );
      expect(result.provider).toBe(mockProvider);
      expect(result.wallet.address).toBe("0x1234567890123456789012345678901234567890");
      expect(result.wallet.providerType).toBe(WalletProviderType.CDP_AGENT);
    });

    it("should return exportable wallet data", async () => {
      const result = await provisionAgentWallet("user123");

      expect(result.exportedData).toEqual(
        expect.objectContaining({
          name: "agent-wallet-user123",
          address: "0x1234567890123456789012345678901234567890",
          networkId: SUPPORTED_NETWORKS.BASE_SEPOLIA,
        })
      );
      expect(result.exportedData.createdAt).toBeDefined();
    });
  });

  describe("restoreWalletProvider", () => {
    const mockProvider = {
      getAddress: vi.fn(() => "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
    };

    beforeEach(() => {
      (MockedProvider.configureWithWallet as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockProvider as unknown as CdpEvmWalletProvider
      );
    });

    it("should restore wallet provider from exported data", async () => {
      const exportedData = {
        name: "test-wallet",
        address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as any,
        networkId: SUPPORTED_NETWORKS.BASE_SEPOLIA,
        createdAt: new Date().toISOString(),
      };

      await restoreWalletProvider(exportedData);

      expect(MockedProvider.configureWithWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          address: exportedData.address,
          networkId: exportedData.networkId,
        })
      );
    });
  });

  describe("exportWalletData", () => {
    const mockProvider = {
      exportWallet: vi.fn(() =>
        Promise.resolve({
          name: "exported-wallet",
          address: "0x1234567890123456789012345678901234567890",
        })
      ),
    } as unknown as CdpEvmWalletProvider;

    it("should export wallet data from provider", async () => {
      const result = await exportWalletData(mockProvider);

      expect(result.name).toBe("exported-wallet");
      expect(result.address).toBe("0x1234567890123456789012345678901234567890");
      expect(result.networkId).toBe(SUPPORTED_NETWORKS.BASE_SEPOLIA);
      expect(result.createdAt).toBeDefined();
    });

    it("should throw on invalid address", async () => {
      const badProvider = {
        exportWallet: vi.fn(() =>
          Promise.resolve({
            name: "bad-wallet",
            address: "invalid-address",
          })
        ),
      } as unknown as CdpEvmWalletProvider;

      await expect(exportWalletData(badProvider)).rejects.toThrow(
        "Invalid wallet address"
      );
    });
  });
});
