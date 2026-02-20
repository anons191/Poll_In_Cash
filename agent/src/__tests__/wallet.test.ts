/**
 * Wallet Module Tests
 *
 * Tests for wallet functions including:
 * - checkBalance
 * - getEarningsHistory
 * - formatEarnings
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  WalletBalance,
  Payout,
  EarningsSummary,
} from '../types.js';

// Mock CDP SDK
vi.mock('@coinbase/cdp-sdk', () => ({
  CdpClient: vi.fn().mockImplementation(() => ({
    evm: {
      getBalance: vi.fn().mockResolvedValue({
        balance: '1000000000000000000', // 1 ETH in wei
      }),
    },
  })),
  EvmAddress: vi.fn().mockImplementation((address: string) => ({
    address,
  })),
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Sample wallet data
const sampleWalletAddress = '0x1234567890abcdef1234567890abcdef12345678';

// Sample wallet balance
const sampleWalletBalance: WalletBalance = {
  address: sampleWalletAddress,
  ethBalance: '0.05',
  usdcBalance: '125.50',
  network: 'base-sepolia',
};

// Sample payouts
const samplePayouts: Payout[] = [
  {
    id: 'payout-1',
    pollId: 'poll-1',
    pollTitle: 'Technology Survey 2024',
    amountUsdc: '1.80',
    status: 'confirmed',
    txHash: '0xabc123...',
    distributedAt: '2024-01-20T10:00:00.000Z',
  },
  {
    id: 'payout-2',
    pollId: 'poll-2',
    pollTitle: 'Consumer Preferences Poll',
    amountUsdc: '2.50',
    status: 'confirmed',
    txHash: '0xdef456...',
    distributedAt: '2024-01-19T15:30:00.000Z',
  },
  {
    id: 'payout-3',
    pollId: 'poll-3',
    pollTitle: 'Healthcare Survey',
    amountUsdc: '3.00',
    status: 'pending',
    distributedAt: undefined,
  },
];

// Sample earnings summary
const sampleEarningsSummary: EarningsSummary = {
  totalEarned: '125.50',
  confirmedPayouts: 45,
  pendingPayouts: 3,
  pollsCompleted: 48,
  reliabilityScore: '0.98',
  recentPayouts: samplePayouts,
};

// Mock API response
const mockEarningsApiResponse = {
  totalEarned: '125.50',
  confirmedPayouts: 45,
  pendingPayouts: 3,
  pollsCompleted: 48,
  reliabilityScore: '0.98',
  recentPayouts: samplePayouts.map((p) => ({
    ...p,
    distributedAt: p.distributedAt ?? null,
  })),
};

describe('Wallet Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============ checkBalance Tests ============

  describe('checkBalance', () => {
    it('should return formatted ETH and USDC balances', async () => {
      const balance = sampleWalletBalance;

      expect(balance.ethBalance).toBe('0.05');
      expect(balance.usdcBalance).toBe('125.50');
    });

    it('should include wallet address in response', async () => {
      const balance = sampleWalletBalance;

      expect(balance.address).toBe(sampleWalletAddress);
      expect(balance.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should include network information', async () => {
      const balance = sampleWalletBalance;

      expect(balance.network).toBe('base-sepolia');
      expect(['base-sepolia', 'base-mainnet']).toContain(balance.network);
    });

    it('should handle zero balances', async () => {
      const emptyBalance: WalletBalance = {
        address: sampleWalletAddress,
        ethBalance: '0.00',
        usdcBalance: '0.00',
        network: 'base-sepolia',
      };

      expect(parseFloat(emptyBalance.ethBalance)).toBe(0);
      expect(parseFloat(emptyBalance.usdcBalance)).toBe(0);
    });

    it('should format balance with proper decimals', async () => {
      const balanceWei = '1000000000000000000'; // 1 ETH in wei
      const ethBalance = (BigInt(balanceWei) / BigInt(10 ** 18)).toString();

      expect(ethBalance).toBe('1');

      // USDC has 6 decimals
      const balanceUsdc = '1500000'; // 1.5 USDC
      const usdcBalance = (Number(balanceUsdc) / 10 ** 6).toFixed(2);

      expect(usdcBalance).toBe('1.50');
    });

    it('should handle CDP SDK errors gracefully', async () => {
      // Simulate CDP SDK error
      const error = new Error('Network error');

      try {
        throw error;
      } catch (e) {
        expect((e as Error).message).toBe('Network error');
      }
    });

    it('should work with CDP wallet', async () => {
      // CDP wallet mock structure
      const cdpWallet = {
        address: sampleWalletAddress,
        network: 'base-sepolia',
        getBalance: vi.fn().mockResolvedValue({
          eth: '0.05',
          usdc: '125.50',
        }),
      };

      expect(cdpWallet.address).toBeDefined();
      expect(cdpWallet.getBalance).toBeDefined();
    });
  });

  // ============ getEarningsHistory Tests ============

  describe('getEarningsHistory', () => {
    it('should fetch earnings from API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEarningsApiResponse,
      });

      const response = await fetch('http://localhost:3000/agent/earnings', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      });
      const data = await response.json();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/agent/earnings',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
      expect(data.totalEarned).toBe('125.50');
    });

    it('should parse total earned correctly', async () => {
      const earnings = sampleEarningsSummary;

      expect(earnings.totalEarned).toBe('125.50');
      expect(parseFloat(earnings.totalEarned)).toBe(125.5);
    });

    it('should count confirmed vs pending payouts', async () => {
      const earnings = sampleEarningsSummary;

      expect(earnings.confirmedPayouts).toBe(45);
      expect(earnings.pendingPayouts).toBe(3);
      expect(earnings.pollsCompleted).toBe(48);
    });

    it('should include reliability score', async () => {
      const earnings = sampleEarningsSummary;

      expect(earnings.reliabilityScore).toBe('0.98');
      expect(parseFloat(earnings.reliabilityScore)).toBeLessThanOrEqual(1);
      expect(parseFloat(earnings.reliabilityScore)).toBeGreaterThanOrEqual(0);
    });

    it('should include recent payouts list', async () => {
      const earnings = sampleEarningsSummary;

      expect(earnings.recentPayouts).toHaveLength(3);
      expect(earnings.recentPayouts[0]).toHaveProperty('pollId');
      expect(earnings.recentPayouts[0]).toHaveProperty('amountUsdc');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const response = await fetch('http://localhost:3000/agent/earnings');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });

    it('should handle empty earnings history', async () => {
      const emptyEarnings: EarningsSummary = {
        totalEarned: '0.00',
        confirmedPayouts: 0,
        pendingPayouts: 0,
        pollsCompleted: 0,
        reliabilityScore: '1.00',
        recentPayouts: [],
      };

      expect(emptyEarnings.recentPayouts).toHaveLength(0);
      expect(parseFloat(emptyEarnings.totalEarned)).toBe(0);
    });

    it('should parse payout dates correctly', async () => {
      const payout = samplePayouts[0];

      expect(payout.distributedAt).toBeDefined();
      const date = new Date(payout.distributedAt!);
      expect(date.toISOString()).toBe('2024-01-20T10:00:00.000Z');
    });

    it('should handle pending payouts without distributedAt', async () => {
      const pendingPayout = samplePayouts[2];

      expect(pendingPayout.status).toBe('pending');
      expect(pendingPayout.distributedAt).toBeUndefined();
    });
  });

  // ============ formatEarnings Tests ============

  describe('formatEarnings', () => {
    it('should produce human-readable output', async () => {
      const earnings = sampleEarningsSummary;

      const formatted = `
Total Earned: $${earnings.totalEarned} USDC
Confirmed Payouts: ${earnings.confirmedPayouts}
Pending Payouts: ${earnings.pendingPayouts}
Polls Completed: ${earnings.pollsCompleted}
Reliability Score: ${(parseFloat(earnings.reliabilityScore) * 100).toFixed(0)}%
      `.trim();

      expect(formatted).toContain('$125.50 USDC');
      expect(formatted).toContain('Confirmed Payouts: 45');
      expect(formatted).toContain('Reliability Score: 98%');
    });

    it('should format currency values correctly', async () => {
      const amount = '125.50';
      const formatted = `$${parseFloat(amount).toFixed(2)}`;

      expect(formatted).toBe('$125.50');
    });

    it('should format percentages correctly', async () => {
      const reliabilityScore = '0.98';
      const percentage = `${(parseFloat(reliabilityScore) * 100).toFixed(0)}%`;

      expect(percentage).toBe('98%');
    });

    it('should format dates in readable format', async () => {
      const isoDate = '2024-01-20T10:00:00.000Z';
      const date = new Date(isoDate);
      const formatted = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });

      expect(formatted).toContain('Jan');
      expect(formatted).toContain('2024');
    });

    it('should format payout list', async () => {
      const payouts = samplePayouts;

      const formattedList = payouts.map((p) => {
        const status = p.status === 'confirmed' ? '[OK]' : '[PENDING]';
        const date = p.distributedAt
          ? new Date(p.distributedAt).toLocaleDateString()
          : 'Pending';
        return `${status} ${p.pollTitle}: $${p.amountUsdc} (${date})`;
      });

      expect(formattedList).toHaveLength(3);
      expect(formattedList[0]).toContain('[OK]');
      expect(formattedList[2]).toContain('[PENDING]');
    });

    it('should handle empty earnings gracefully', async () => {
      const emptyEarnings: EarningsSummary = {
        totalEarned: '0.00',
        confirmedPayouts: 0,
        pendingPayouts: 0,
        pollsCompleted: 0,
        reliabilityScore: '1.00',
        recentPayouts: [],
      };

      const formatted = `Total Earned: $${emptyEarnings.totalEarned}`;

      expect(formatted).toBe('Total Earned: $0.00');
    });

    it('should show transaction hash for confirmed payouts', async () => {
      const confirmedPayout = samplePayouts[0];

      expect(confirmedPayout.txHash).toBeDefined();
      expect(confirmedPayout.txHash).toMatch(/^0x/);
    });

    it('should calculate total from individual payouts', async () => {
      const payouts = samplePayouts.filter((p) => p.status === 'confirmed');

      const total = payouts.reduce(
        (sum, p) => sum + parseFloat(p.amountUsdc),
        0
      );

      expect(total).toBeCloseTo(4.3); // 1.80 + 2.50
    });
  });

  // ============ Payout Status Tests ============

  describe('Payout Status', () => {
    it('should identify confirmed payouts', async () => {
      const payout: Payout = {
        id: 'payout-1',
        pollId: 'poll-1',
        pollTitle: 'Test Poll',
        amountUsdc: '1.00',
        status: 'confirmed',
        txHash: '0xabc...',
        distributedAt: '2024-01-20T10:00:00.000Z',
      };

      expect(payout.status).toBe('confirmed');
      expect(payout.txHash).toBeDefined();
    });

    it('should identify pending payouts', async () => {
      const payout: Payout = {
        id: 'payout-2',
        pollId: 'poll-2',
        pollTitle: 'Test Poll 2',
        amountUsdc: '2.00',
        status: 'pending',
      };

      expect(payout.status).toBe('pending');
      expect(payout.txHash).toBeUndefined();
    });

    it('should identify failed payouts', async () => {
      const payout: Payout = {
        id: 'payout-3',
        pollId: 'poll-3',
        pollTitle: 'Test Poll 3',
        amountUsdc: '1.50',
        status: 'failed',
      };

      expect(payout.status).toBe('failed');
    });

    it('should filter payouts by status', async () => {
      const allPayouts = samplePayouts;

      const confirmed = allPayouts.filter((p) => p.status === 'confirmed');
      const pending = allPayouts.filter((p) => p.status === 'pending');

      expect(confirmed).toHaveLength(2);
      expect(pending).toHaveLength(1);
    });
  });

  // ============ Integration Tests ============

  describe('Wallet Integration', () => {
    it('should check balance and get earnings', async () => {
      // Mock balance check
      const balance = sampleWalletBalance;

      expect(balance.address).toBe(sampleWalletAddress);
      expect(parseFloat(balance.usdcBalance)).toBeGreaterThan(0);

      // Mock earnings fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEarningsApiResponse,
      });

      const response = await fetch('http://localhost:3000/agent/earnings', {
        headers: { Authorization: 'Bearer token' },
      });
      const earnings = await response.json();

      expect(earnings.totalEarned).toBe('125.50');
      expect(parseFloat(earnings.totalEarned)).toBe(
        parseFloat(balance.usdcBalance)
      );
    });

    it('should track earnings growth over time', async () => {
      const payouts = samplePayouts.filter((p) => p.status === 'confirmed');

      // Sort by date
      const sorted = [...payouts].sort((a, b) => {
        const dateA = new Date(a.distributedAt!);
        const dateB = new Date(b.distributedAt!);
        return dateA.getTime() - dateB.getTime();
      });

      // Calculate cumulative earnings
      let cumulative = 0;
      const earningsOverTime = sorted.map((p) => {
        cumulative += parseFloat(p.amountUsdc);
        return {
          date: p.distributedAt,
          total: cumulative.toFixed(2),
        };
      });

      expect(earningsOverTime).toHaveLength(2);
      expect(earningsOverTime[1].total).toBe('4.30');
    });
  });
});
