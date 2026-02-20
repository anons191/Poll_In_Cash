/**
 * Treasury Service Tests
 *
 * Tests for CDP treasury wallet setup and management.
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
  getTreasuryAddress,
  getTreasuryConfig,
  isTreasuryConfigured,
  getTreasuryProvider,
  createTreasuryWallet,
  formatUsdcBalance,
  getX402TreasuryConfig,
} from "../treasury.js";
import {
  SUPPORTED_NETWORKS,
  CHAIN_IDS,
  type WalletAddress,
} from "../../../types/wallet.js";

describe("Treasury Service", () => {
  const originalEnv = process.env;
  const mockTreasuryAddress = "0x1234567890123456789012345678901234567890" as WalletAddress;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = {
      ...originalEnv,
      CDP_API_KEY_ID: "test-api-key-id",
      CDP_API_KEY_SECRET: "test-api-key-secret",
      CDP_WALLET_SECRET: "test-wallet-secret",
      TREASURY_WALLET_ADDRESS: mockTreasuryAddress,
      NODE_ENV: "test",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isTreasuryConfigured", () => {
    it("should return true when treasury address is set", () => {
      expect(isTreasuryConfigured()).toBe(true);
    });

    it("should return false when treasury address is not set", () => {
      delete process.env.TREASURY_WALLET_ADDRESS;
      expect(isTreasuryConfigured()).toBe(false);
    });
  });

  describe("getTreasuryAddress", () => {
    it("should return the treasury address from env", () => {
      expect(getTreasuryAddress()).toBe(mockTreasuryAddress);
    });

    it("should throw when treasury address is not set", () => {
      delete process.env.TREASURY_WALLET_ADDRESS;
      expect(() => getTreasuryAddress()).toThrow(
        "TREASURY_WALLET_ADDRESS environment variable is required"
      );
    });

    it("should throw on invalid address format", () => {
      process.env.TREASURY_WALLET_ADDRESS = "invalid-address";
      expect(() => getTreasuryAddress()).toThrow("Invalid wallet address");
    });
  });

  describe("getTreasuryConfig", () => {
    it("should return full treasury config in development", () => {
      process.env.NODE_ENV = "development";
      const config = getTreasuryConfig();

      expect(config.address).toBe(mockTreasuryAddress);
      expect(config.networkId).toBe(SUPPORTED_NETWORKS.BASE_SEPOLIA);
      expect(config.chainId).toBe(CHAIN_IDS[SUPPORTED_NETWORKS.BASE_SEPOLIA]);
    });

    it("should return mainnet config in production", () => {
      process.env.NODE_ENV = "production";
      const config = getTreasuryConfig();

      expect(config.networkId).toBe(SUPPORTED_NETWORKS.BASE_MAINNET);
      expect(config.chainId).toBe(CHAIN_IDS[SUPPORTED_NETWORKS.BASE_MAINNET]);
    });
  });

  describe("getTreasuryProvider", () => {
    const mockProvider = {
      getAddress: vi.fn(() => mockTreasuryAddress),
      getBalance: vi.fn(() => Promise.resolve(BigInt(1000000000000000000))),
    };

    beforeEach(() => {
      (MockedProvider.configureWithWallet as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockProvider as unknown as CdpEvmWalletProvider
      );
    });

    it("should create provider with treasury address", async () => {
      await getTreasuryProvider();

      expect(MockedProvider.configureWithWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          address: mockTreasuryAddress,
        })
      );
    });

    it("should throw when CDP credentials are missing", async () => {
      delete process.env.CDP_API_KEY_ID;
      await expect(getTreasuryProvider()).rejects.toThrow(
        "CDP credentials are required"
      );
    });
  });

  describe("createTreasuryWallet", () => {
    const newTreasuryAddress = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const mockProvider = {
      getAddress: vi.fn(() => newTreasuryAddress),
      exportWallet: vi.fn(() =>
        Promise.resolve({
          name: "poll-in-cash-treasury",
          address: newTreasuryAddress,
        })
      ),
    };

    beforeEach(() => {
      (MockedProvider.configureWithWallet as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockProvider as unknown as CdpEvmWalletProvider
      );
    });

    it("should create treasury wallet with idempotency key", async () => {
      const result = await createTreasuryWallet();

      expect(MockedProvider.configureWithWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "poll-in-cash-treasury-base-sepolia",
        })
      );
      expect(result.address).toBe(newTreasuryAddress);
      expect(result.networkId).toBe(SUPPORTED_NETWORKS.BASE_SEPOLIA);
    });

    it("should use provided network", async () => {
      const result = await createTreasuryWallet(SUPPORTED_NETWORKS.BASE_MAINNET);

      expect(MockedProvider.configureWithWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "poll-in-cash-treasury-base-mainnet",
          networkId: SUPPORTED_NETWORKS.BASE_MAINNET,
        })
      );
      expect(result.networkId).toBe(SUPPORTED_NETWORKS.BASE_MAINNET);
    });

    it("should return env var string", async () => {
      const result = await createTreasuryWallet();

      expect(result.envVar).toBe(
        `TREASURY_WALLET_ADDRESS=${newTreasuryAddress}`
      );
    });

    it("should throw when CDP credentials are missing", async () => {
      delete process.env.CDP_API_KEY_SECRET;
      await expect(createTreasuryWallet()).rejects.toThrow(
        "CDP credentials"
      );
    });
  });

  describe("formatUsdcBalance", () => {
    it("should format zero balance", () => {
      expect(formatUsdcBalance(BigInt(0))).toBe("0.000000");
    });

    it("should format small balance", () => {
      expect(formatUsdcBalance(BigInt(1))).toBe("0.000001");
    });

    it("should format 1 USDC", () => {
      expect(formatUsdcBalance(BigInt(1000000))).toBe("1.000000");
    });

    it("should format 100.50 USDC", () => {
      expect(formatUsdcBalance(BigInt(100500000))).toBe("100.500000");
    });

    it("should format large balance", () => {
      expect(formatUsdcBalance(BigInt(1234567890123))).toBe("1234567.890123");
    });
  });

  describe("getX402TreasuryConfig", () => {
    it("should return x402 compatible config for sepolia", () => {
      process.env.NODE_ENV = "development";
      const config = getX402TreasuryConfig();

      expect(config.payTo).toBe(mockTreasuryAddress);
      expect(config.network).toBe(`eip155:${CHAIN_IDS[SUPPORTED_NETWORKS.BASE_SEPOLIA]}`);
      expect(config.chainId).toBe(CHAIN_IDS[SUPPORTED_NETWORKS.BASE_SEPOLIA]);
    });

    it("should return x402 compatible config for mainnet", () => {
      process.env.NODE_ENV = "production";
      const config = getX402TreasuryConfig();

      expect(config.network).toBe(`eip155:${CHAIN_IDS[SUPPORTED_NETWORKS.BASE_MAINNET]}`);
      expect(config.chainId).toBe(CHAIN_IDS[SUPPORTED_NETWORKS.BASE_MAINNET]);
    });
  });
});
