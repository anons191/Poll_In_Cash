/**
 * Tests for gas sponsorship configuration
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getSponsorshipPolicy,
  getPaymasterConfig,
  getFrontendGasConfig,
  shouldSponsorTransaction,
  BASE_SEPOLIA_SPONSORSHIP_POLICY,
  isWithinDailyLimit,
  getUserDailySpend,
} from "../gas-sponsor.js";

// Store original env
const originalEnv = process.env;

describe("Gas Sponsorship Configuration", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      POLLPOOL_CONTRACT_ADDRESS: "0x1234567890123456789012345678901234567890",
      THIRDWEB_CLIENT_ID: "test-client-id",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("BASE_SEPOLIA_SPONSORSHIP_POLICY", () => {
    it("should have correct chain configuration", () => {
      expect(BASE_SEPOLIA_SPONSORSHIP_POLICY.chainId).toBe(84532);
      expect(BASE_SEPOLIA_SPONSORSHIP_POLICY.name).toBe("poll-in-cash-base-sepolia");
      expect(BASE_SEPOLIA_SPONSORSHIP_POLICY.enabled).toBe(true);
    });

    it("should have gas limits configured", () => {
      expect(BASE_SEPOLIA_SPONSORSHIP_POLICY.maxGasLimit).toBe(1_000_000n);
      expect(BASE_SEPOLIA_SPONSORSHIP_POLICY.maxGasPrice).toBe(100_000_000_000n);
    });

    it("should have daily limit set", () => {
      expect(BASE_SEPOLIA_SPONSORSHIP_POLICY.dailyLimitUsd).toBe(100);
    });

    it("should have allowed methods configured", () => {
      expect(BASE_SEPOLIA_SPONSORSHIP_POLICY.allowedMethods).toContain("0x3e413bee"); // createPoll
      expect(BASE_SEPOLIA_SPONSORSHIP_POLICY.allowedMethods).toContain("0x095ea7b3"); // approve
    });
  });

  describe("getSponsorshipPolicy", () => {
    it("should include contract addresses when configured", () => {
      const policy = getSponsorshipPolicy();

      expect(policy.allowedContracts).toContain(
        "0x1234567890123456789012345678901234567890"
      );
      // Should also include USDC address
      expect(policy.allowedContracts).toContain(
        "0x036cbd53842c5426634e7929541ec2318f3dcf7e"
      );
    });

    it("should return empty allowed contracts when POLLPOOL_CONTRACT_ADDRESS not set", () => {
      delete process.env.POLLPOOL_CONTRACT_ADDRESS;

      const policy = getSponsorshipPolicy();

      expect(policy.allowedContracts).toEqual([]);
    });
  });

  describe("getPaymasterConfig", () => {
    it("should return valid paymaster configuration", () => {
      const config = getPaymasterConfig();

      expect(config.bundlerUrl).toContain("bundler.thirdweb.com");
      expect(config.paymasterUrl).toContain("bundler.thirdweb.com");
      expect(config.context?.policyId).toBe("poll-in-cash-base-sepolia");
    });

    it("should throw if THIRDWEB_CLIENT_ID not set", () => {
      delete process.env.THIRDWEB_CLIENT_ID;
      delete process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

      expect(() => getPaymasterConfig()).toThrow(
        "THIRDWEB_CLIENT_ID environment variable is not set"
      );
    });
  });

  describe("getFrontendGasConfig", () => {
    it("should return frontend-safe configuration", () => {
      const config = getFrontendGasConfig();

      expect(config.gaslessEnabled).toBe(true);
      expect(config.chainId).toBe(84532);
      expect(config.chainName).toBe("Base Sepolia");
      expect(config.sponsorshipMessage).toContain("Gas fees are sponsored");
    });
  });

  describe("shouldSponsorTransaction", () => {
    const pollPoolAddress = "0x1234567890123456789012345678901234567890";
    const usdcAddress = "0x036cbd53842c5426634e7929541ec2318f3dcf7e";

    it("should sponsor transactions to allowed contracts with allowed methods", () => {
      // createPoll method selector
      const result = shouldSponsorTransaction(
        pollPoolAddress,
        "0x3e413bee0000000000000000000000000000000000000000000000000000000000000000",
        0n
      );

      expect(result.sponsored).toBe(true);
    });

    it("should sponsor USDC approve transactions", () => {
      // approve method selector
      const result = shouldSponsorTransaction(
        usdcAddress,
        "0x095ea7b30000000000000000000000000000000000000000000000000000000000000000",
        0n
      );

      expect(result.sponsored).toBe(true);
    });

    it("should not sponsor transactions with ETH value", () => {
      const result = shouldSponsorTransaction(
        pollPoolAddress,
        "0x3e413bee0000000000000000000000000000000000000000000000000000000000000000",
        1000000000000000n // 0.001 ETH
      );

      expect(result.sponsored).toBe(false);
      expect(result.reason).toContain("value");
    });

    it("should not sponsor transactions to unknown contracts", () => {
      const unknownContract = "0xdead000000000000000000000000000000000000";

      const result = shouldSponsorTransaction(
        unknownContract,
        "0x095ea7b30000000000000000000000000000000000000000000000000000000000000000",
        0n
      );

      expect(result.sponsored).toBe(false);
      expect(result.reason).toContain("not in allowed list");
    });

    it("should not sponsor transactions with unknown methods", () => {
      const result = shouldSponsorTransaction(
        pollPoolAddress,
        "0xdeadbeef0000000000000000000000000000000000000000000000000000000000000000",
        0n
      );

      expect(result.sponsored).toBe(false);
      expect(result.reason).toContain("Method not in allowed list");
    });
  });

  describe("Daily Limits", () => {
    describe("getUserDailySpend", () => {
      it("should return 0 for now (placeholder)", async () => {
        const spend = await getUserDailySpend("0x1234567890123456789012345678901234567890");
        expect(spend).toBe(0);
      });
    });

    describe("isWithinDailyLimit", () => {
      it("should return true when spend is under limit", async () => {
        const result = await isWithinDailyLimit("0x1234567890123456789012345678901234567890");
        expect(result).toBe(true);
      });
    });
  });
});

describe("Gas Sponsorship - Disabled State", () => {
  it("should not sponsor when policy is disabled", () => {
    // Create a modified policy with enabled = false
    const originalEnabled = BASE_SEPOLIA_SPONSORSHIP_POLICY.enabled;
    (BASE_SEPOLIA_SPONSORSHIP_POLICY as { enabled: boolean }).enabled = false;

    const result = shouldSponsorTransaction(
      "0x1234567890123456789012345678901234567890",
      "0x3e413bee0000000000000000000000000000000000000000000000000000000000000000",
      0n
    );

    expect(result.sponsored).toBe(false);
    expect(result.reason).toContain("disabled");

    // Restore
    (BASE_SEPOLIA_SPONSORSHIP_POLICY as { enabled: boolean }).enabled = originalEnabled;
  });
});
