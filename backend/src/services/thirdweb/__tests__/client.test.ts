/**
 * Tests for Thirdweb client and contract interaction helpers
 * Mocks the thirdweb SDK for unit testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toWalletAddress } from "../../../types/wallet.js";

// Mock environment variables
const originalEnv = process.env;

// Setup mocks before importing the module
vi.mock("thirdweb", () => ({
  createThirdwebClient: vi.fn(() => ({
    clientId: "mock-client",
  })),
  getContract: vi.fn(() => ({
    address: "0x1234567890123456789012345678901234567890",
    chain: { id: 84532 },
  })),
  readContract: vi.fn(),
  prepareContractCall: vi.fn(() => ({
    to: "0x1234567890123456789012345678901234567890",
    data: "0x",
  })),
  sendTransaction: vi.fn(),
}));

vi.mock("thirdweb/chains", () => ({
  baseSepolia: { id: 84532, name: "Base Sepolia" },
}));

vi.mock("thirdweb/wallets", () => ({
  privateKeyToAccount: vi.fn(() => ({
    address: "0xabcdef1234567890abcdef1234567890abcdef12",
    signMessage: vi.fn(),
  })),
}));

describe("Thirdweb Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      THIRDWEB_SECRET_KEY: "test-secret-key",
      POLLPOOL_CONTRACT_ADDRESS: "0x1234567890123456789012345678901234567890",
      SERVER_WALLET_PRIVATE_KEY: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  describe("getThirdwebClient", () => {
    it("should create a client with the secret key", async () => {
      const { createThirdwebClient } = await import("thirdweb");
      const { getThirdwebClient } = await import("../client.js");

      const client = getThirdwebClient();

      expect(createThirdwebClient).toHaveBeenCalledWith({
        secretKey: "test-secret-key",
      });
      expect(client).toBeDefined();
    });
  });

  describe("readPollState", () => {
    it("should return poll data for valid poll ID", async () => {
      const { readContract } = await import("thirdweb");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(readContract).mockResolvedValue({
        creator: "0xabcdef1234567890abcdef1234567890abcdef12",
        title: "Test Poll",
        criteriaHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
        totalFunded: 1000000n,
        distributablePool: 900000n,
        participantCap: 10n,
        participantCount: 5n,
        expiresAt: BigInt(Date.now() / 1000 + 86400),
        status: 0,
      } as never);

      const { readPollState } = await import("../client.js");
      const result = await readPollState(1n);

      expect(result).not.toBeNull();
      expect(result?.title).toBe("Test Poll");
      expect(result?.participantCount).toBe(5n);
      expect(result?.status).toBe(0);
    });

    it("should return null on error", async () => {
      const { readContract } = await import("thirdweb");
      vi.mocked(readContract).mockRejectedValue(new Error("Contract call failed"));

      const { readPollState } = await import("../client.js");
      const result = await readPollState(999n);

      expect(result).toBeNull();
    });
  });

  describe("getParticipants", () => {
    it("should return array of participant addresses", async () => {
      const { readContract } = await import("thirdweb");
      vi.mocked(readContract).mockResolvedValue([
        "0xabcdef1234567890abcdef1234567890abcdef12",
        "0x1234567890123456789012345678901234567890",
      ] as never);

      const { getParticipants } = await import("../client.js");
      const result = await getParticipants(1n);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
    });

    it("should return empty array on error", async () => {
      const { readContract } = await import("thirdweb");
      vi.mocked(readContract).mockRejectedValue(new Error("Failed"));

      const { getParticipants } = await import("../client.js");
      const result = await getParticipants(1n);

      expect(result).toEqual([]);
    });
  });

  describe("hasUserParticipated", () => {
    it("should return true if user has participated", async () => {
      const { readContract } = await import("thirdweb");
      vi.mocked(readContract).mockResolvedValue(true as never);

      const { hasUserParticipated } = await import("../client.js");
      const userAddress = toWalletAddress("0xabcdef1234567890abcdef1234567890abcdef12")!;
      const result = await hasUserParticipated(1n, userAddress);

      expect(result).toBe(true);
    });

    it("should return false if user has not participated", async () => {
      const { readContract } = await import("thirdweb");
      vi.mocked(readContract).mockResolvedValue(false as never);

      const { hasUserParticipated } = await import("../client.js");
      const userAddress = toWalletAddress("0xabcdef1234567890abcdef1234567890abcdef12")!;
      const result = await hasUserParticipated(1n, userAddress);

      expect(result).toBe(false);
    });
  });

  describe("calculatePayout", () => {
    it("should return payout amount", async () => {
      const { readContract } = await import("thirdweb");
      vi.mocked(readContract).mockResolvedValue(180000n as never);

      const { calculatePayout } = await import("../client.js");
      const result = await calculatePayout(1n);

      expect(result).toBe(180000n);
    });

    it("should return 0 on error", async () => {
      const { readContract } = await import("thirdweb");
      vi.mocked(readContract).mockRejectedValue(new Error("Failed"));

      const { calculatePayout } = await import("../client.js");
      const result = await calculatePayout(1n);

      expect(result).toBe(0n);
    });
  });

  describe("closePoll", () => {
    it("should close poll and return transaction receipt", async () => {
      const { sendTransaction } = await import("thirdweb");
      vi.mocked(sendTransaction).mockResolvedValue({
        transactionHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
      } as never);

      const { closePoll } = await import("../client.js");
      const result = await closePoll(1n);

      expect(result.hash).toBe("0x1234567890123456789012345678901234567890123456789012345678901234");
      expect(result.status).toBe("confirmed");
    });
  });

  describe("distribute", () => {
    it("should distribute funds and return transaction receipt", async () => {
      const { sendTransaction } = await import("thirdweb");
      vi.mocked(sendTransaction).mockResolvedValue({
        transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      } as never);

      const { distribute } = await import("../client.js");
      const result = await distribute(1n);

      expect(result.hash).toBe("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
      expect(result.status).toBe("confirmed");
    });
  });
});

describe("PollStatus enum", () => {
  it("should have correct values", async () => {
    const { PollStatus } = await import("../client.js");

    expect(PollStatus.Active).toBe(0);
    expect(PollStatus.Closed).toBe(1);
    expect(PollStatus.Distributed).toBe(2);
    expect(PollStatus.Cancelled).toBe(3);
  });
});

describe("BASE_SEPOLIA_CONFIG", () => {
  it("should have correct chain configuration", async () => {
    const { BASE_SEPOLIA_CONFIG } = await import("../client.js");

    expect(BASE_SEPOLIA_CONFIG.chainId).toBe(84532);
    expect(BASE_SEPOLIA_CONFIG.name).toBe("Base Sepolia");
    expect(BASE_SEPOLIA_CONFIG.rpcUrl).toBe("https://sepolia.base.org");
    expect(BASE_SEPOLIA_CONFIG.blockExplorer).toBe("https://sepolia.basescan.org");
  });
});
