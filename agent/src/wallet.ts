/**
 * Wallet Manager
 *
 * Manages CDP wallet operations for the agent.
 * Handles wallet creation, balance checking, and earnings tracking.
 *
 * @module agent/wallet
 */

import { ethers, JsonRpcProvider, formatEther, formatUnits, Wallet } from 'ethers';
import { CdpClient } from '@coinbase/cdp-sdk';
import type {
  WalletBalance,
  EarningsSummary,
  Payout,
  AgentConfig,
  WithdrawalRequest,
  WithdrawalResult,
  WithdrawalHistory,
  Withdrawal,
} from './types.js';
import { USDC_CONTRACT_ADDRESS } from './config.js';

/**
 * USDC token ABI (only balanceOf needed)
 */
const USDC_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

/**
 * Wallet data for persistence
 */
export interface WalletData {
  address: string;
  privateKey?: string;
  cdpWalletId?: string;
  network: string;
  createdAt: string;
}

/**
 * Initialize a new CDP wallet or restore from existing data
 */
export async function initializeWallet(
  config: AgentConfig,
  existingWalletData?: WalletData
): Promise<{ wallet: Wallet; walletData: WalletData }> {
  // If we have existing wallet data with a private key, restore it
  if (existingWalletData?.privateKey) {
    const provider = getProvider(config.network);
    const wallet = new Wallet(existingWalletData.privateKey, provider);

    return {
      wallet,
      walletData: existingWalletData,
    };
  }

  // Try to use CDP SDK to create a wallet
  try {
    const cdpApiKey = process.env.CDP_API_KEY_NAME;
    const cdpApiSecret = process.env.CDP_API_KEY_PRIVATE_KEY;

    if (cdpApiKey && cdpApiSecret) {
      return await createCdpWallet(config);
    }
  } catch (error) {
    console.warn('CDP wallet creation failed, falling back to local wallet:', error);
  }

  // Fallback: Create a local ethers wallet
  return createLocalWallet(config);
}

/**
 * Create a wallet using CDP SDK
 */
async function createCdpWallet(
  config: AgentConfig
): Promise<{ wallet: Wallet; walletData: WalletData }> {
  const cdpClient = new CdpClient();

  // Create an EVM account
  const account = await cdpClient.evm.createAccount();

  // Get the private key if available - CDP account may not expose this directly
  // Use the account's signing capability or fall back to random key
  const accountAsRecord = account as unknown as Record<string, unknown>;
  const privateKey = typeof accountAsRecord.privateKey === 'string'
    ? accountAsRecord.privateKey
    : ethers.hexlify(ethers.randomBytes(32));

  // Create ethers wallet from the account
  const provider = getProvider(config.network);
  const wallet = new Wallet(privateKey, provider);

  const walletData: WalletData = {
    address: account.address,
    privateKey: privateKey,
    network: config.network,
    createdAt: new Date().toISOString(),
  };

  return { wallet, walletData };
}

/**
 * Create a local ethers wallet (fallback)
 */
function createLocalWallet(
  config: AgentConfig
): { wallet: Wallet; walletData: WalletData } {
  const provider = getProvider(config.network);

  // Generate a new random wallet
  const randomWallet = Wallet.createRandom();
  const connectedWallet = new Wallet(randomWallet.privateKey, provider);

  const walletData: WalletData = {
    address: connectedWallet.address,
    privateKey: randomWallet.privateKey,
    network: config.network,
    createdAt: new Date().toISOString(),
  };

  return { wallet: connectedWallet, walletData };
}

/**
 * Get provider for the specified network
 */
function getProvider(network: string): JsonRpcProvider {
  const rpcUrls: Record<string, string> = {
    'base-sepolia': process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    'base-mainnet': process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org',
  };

  const rpcUrl = rpcUrls[network];
  if (!rpcUrl) {
    throw new Error(`Unknown network: ${network}`);
  }

  return new JsonRpcProvider(rpcUrl);
}

/**
 * Check ETH and USDC balance for a wallet
 */
export async function checkBalance(
  walletAddress: string,
  network: string
): Promise<WalletBalance> {
  const provider = getProvider(network);

  // Get ETH balance
  const ethBalance = await provider.getBalance(walletAddress);

  // Get USDC balance
  const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, USDC_ABI, provider);
  let usdcBalance: bigint;

  try {
    usdcBalance = await usdcContract.balanceOf(walletAddress);
  } catch (error) {
    // USDC contract might not exist on testnet or balance call failed
    console.warn('Failed to get USDC balance:', error);
    usdcBalance = BigInt(0);
  }

  return {
    address: walletAddress,
    ethBalance: formatEther(ethBalance),
    usdcBalance: formatUnits(usdcBalance, 6), // USDC has 6 decimals
    network,
  };
}

/**
 * Get earnings history from the API
 */
export async function getEarningsHistory(
  config: AgentConfig,
  authToken: string
): Promise<EarningsSummary> {
  const url = `${config.apiBaseUrl}/agent/earnings`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get earnings: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    totalEarned?: string;
    confirmedPayouts?: number;
    pendingPayouts?: number;
    pollsCompleted?: number;
    reliabilityScore?: string;
    recentPayouts?: Payout[];
  };

  return {
    totalEarned: data.totalEarned || '0',
    confirmedPayouts: data.confirmedPayouts || 0,
    pendingPayouts: data.pendingPayouts || 0,
    pollsCompleted: data.pollsCompleted || 0,
    reliabilityScore: data.reliabilityScore || '1.00',
    recentPayouts: (data.recentPayouts || []).map((p: Payout) => ({
      id: p.id,
      pollId: p.pollId,
      pollTitle: p.pollTitle,
      amountUsdc: p.amountUsdc,
      status: p.status,
      txHash: p.txHash,
      distributedAt: p.distributedAt,
    })),
  };
}

/**
 * Request a withdrawal from the agent wallet
 */
export async function requestWithdrawal(
  config: AgentConfig,
  authToken: string,
  request: WithdrawalRequest
): Promise<WithdrawalResult> {
  const url = `${config.apiBaseUrl}/agent/withdraw`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Withdrawal failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
  }

  return response.json() as Promise<WithdrawalResult>;
}

/**
 * Get withdrawal history from the API
 */
export async function getWithdrawalHistory(
  config: AgentConfig,
  authToken: string
): Promise<WithdrawalHistory> {
  const url = `${config.apiBaseUrl}/agent/withdraw/history`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get withdrawal history: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<WithdrawalHistory>;
}

/**
 * Get wallet balance from the API (includes USDC balance check)
 */
export async function getWalletBalanceFromApi(
  config: AgentConfig,
  authToken: string
): Promise<{ walletAddress: string; balance: string; currency: string; network: string }> {
  const url = `${config.apiBaseUrl}/agent/withdraw/balance`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get balance: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Format withdrawal into a human-readable string
 */
export function formatWithdrawal(withdrawal: Withdrawal): string {
  const amount = parseFloat(withdrawal.amount).toFixed(2);
  const status = withdrawal.status;
  const destination = withdrawal.destinationType === 'wallet'
    ? `${withdrawal.destinationAddress.slice(0, 10)}...`
    : `${withdrawal.destinationType} (${withdrawal.destinationHandle || withdrawal.destinationAddress.slice(0, 10)}...)`;

  let result = `$${amount} USDC → ${destination} [${status}]`;

  if (withdrawal.txHash) {
    result += `\n  TX: ${withdrawal.txHash.slice(0, 20)}...`;
  }
  if (withdrawal.errorMessage) {
    result += `\n  Error: ${withdrawal.errorMessage}`;
  }

  return result;
}

/**
 * Format withdrawal history into a human-readable summary
 */
export function formatWithdrawalHistory(history: WithdrawalHistory): string {
  const lines: string[] = [];

  lines.push('=== Withdrawal History ===');

  if (history.withdrawals.length === 0) {
    lines.push('No withdrawals yet.');
    return lines.join('\n');
  }

  for (const w of history.withdrawals.slice(0, 10)) {
    lines.push(formatWithdrawal(w));
  }

  if (history.withdrawals.length > 10) {
    lines.push(`... and ${history.withdrawals.length - 10} more`);
  }

  return lines.join('\n');
}

/**
 * Format earnings into a human-readable summary
 */
export function formatEarnings(earnings: EarningsSummary): string {
  const lines: string[] = [];

  lines.push('=== Earnings Summary ===');
  lines.push(`Total Earned: $${parseFloat(earnings.totalEarned).toFixed(2)} USDC`);
  lines.push(`Polls Completed: ${earnings.pollsCompleted}`);
  lines.push(`Reliability Score: ${parseFloat(earnings.reliabilityScore).toFixed(2)}`);
  lines.push('');
  lines.push(`Confirmed Payouts: ${earnings.confirmedPayouts}`);
  lines.push(`Pending Payouts: ${earnings.pendingPayouts}`);

  if (earnings.recentPayouts.length > 0) {
    lines.push('');
    lines.push('Recent Payouts:');

    for (const payout of earnings.recentPayouts.slice(0, 5)) {
      const amount = parseFloat(payout.amountUsdc).toFixed(2);
      const status = payout.status === 'confirmed' ? 'done' : payout.status;
      lines.push(`  - ${payout.pollTitle}: $${amount} (${status})`);
    }
  }

  return lines.join('\n');
}

/**
 * Format balance into a human-readable string
 */
export function formatBalance(balance: WalletBalance): string {
  const ethNum = parseFloat(balance.ethBalance);
  const usdcNum = parseFloat(balance.usdcBalance);

  return [
    `Address: ${balance.address}`,
    `Network: ${balance.network}`,
    `ETH: ${ethNum.toFixed(6)} ETH`,
    `USDC: $${usdcNum.toFixed(2)}`,
  ].join('\n');
}

/**
 * Wallet Manager class for stateful wallet operations
 */
export class WalletManager {
  private config: AgentConfig;
  private wallet: Wallet | null = null;
  private walletData: WalletData | null = null;
  private authToken: string | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * Set auth token for API calls
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Initialize or restore wallet
   */
  async initialize(existingWalletData?: WalletData): Promise<void> {
    const result = await initializeWallet(this.config, existingWalletData);
    this.wallet = result.wallet;
    this.walletData = result.walletData;
  }

  /**
   * Initialize from a private key
   */
  initializeFromPrivateKey(privateKey: string): void {
    const provider = getProvider(this.config.network);
    this.wallet = new Wallet(privateKey, provider);
    this.walletData = {
      address: this.wallet.address,
      privateKey,
      network: this.config.network,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Get the ethers wallet instance
   */
  getWallet(): Wallet | null {
    return this.wallet;
  }

  /**
   * Get wallet data for persistence
   */
  getWalletData(): WalletData | null {
    return this.walletData;
  }

  /**
   * Get wallet address
   */
  getWalletAddress(): string | null {
    return this.walletData?.address || null;
  }

  /**
   * Check if wallet is initialized
   */
  isInitialized(): boolean {
    return this.wallet !== null;
  }

  /**
   * Check wallet balance
   */
  async checkBalance(): Promise<WalletBalance> {
    if (!this.walletData) {
      throw new Error('Wallet not initialized');
    }

    return checkBalance(this.walletData.address, this.config.network);
  }

  /**
   * Get earnings history
   */
  async getEarningsHistory(): Promise<EarningsSummary> {
    if (!this.authToken) {
      throw new Error('Auth token not set');
    }

    return getEarningsHistory(this.config, this.authToken);
  }

  /**
   * Format current earnings
   */
  async formatEarnings(): Promise<string> {
    const earnings = await this.getEarningsHistory();
    return formatEarnings(earnings);
  }

  /**
   * Format current balance
   */
  async formatBalance(): Promise<string> {
    const balance = await this.checkBalance();
    return formatBalance(balance);
  }

  /**
   * Sign a message with the wallet
   */
  async signMessage(message: string): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    return this.wallet.signMessage(message);
  }

  /**
   * Get a summary of the wallet status
   */
  async getStatus(): Promise<{
    address: string;
    balance: WalletBalance;
    network: string;
  }> {
    if (!this.walletData) {
      throw new Error('Wallet not initialized');
    }

    const balance = await this.checkBalance();

    return {
      address: this.walletData.address,
      balance,
      network: this.config.network,
    };
  }

  /**
   * Export wallet data (for backup)
   * WARNING: This includes the private key if available
   */
  exportWalletData(): WalletData | null {
    return this.walletData;
  }

  /**
   * Get a masked version of wallet data (safe for logging)
   */
  getMaskedWalletData(): Omit<WalletData, 'privateKey'> & { hasPrivateKey: boolean } | null {
    if (!this.walletData) return null;

    return {
      address: this.walletData.address,
      cdpWalletId: this.walletData.cdpWalletId,
      network: this.walletData.network,
      createdAt: this.walletData.createdAt,
      hasPrivateKey: !!this.walletData.privateKey,
    };
  }

  /**
   * Request a withdrawal to a destination address
   */
  async withdraw(request: WithdrawalRequest): Promise<WithdrawalResult> {
    if (!this.authToken) {
      throw new Error('Auth token not set');
    }

    return requestWithdrawal(this.config, this.authToken, request);
  }

  /**
   * Get withdrawal history
   */
  async getWithdrawalHistory(): Promise<WithdrawalHistory> {
    if (!this.authToken) {
      throw new Error('Auth token not set');
    }

    return getWithdrawalHistory(this.config, this.authToken);
  }

  /**
   * Get wallet balance from API
   */
  async getApiBalance(): Promise<{ walletAddress: string; balance: string; currency: string; network: string }> {
    if (!this.authToken) {
      throw new Error('Auth token not set');
    }

    return getWalletBalanceFromApi(this.config, this.authToken);
  }

  /**
   * Format withdrawal history
   */
  async formatWithdrawalHistory(): Promise<string> {
    const history = await this.getWithdrawalHistory();
    return formatWithdrawalHistory(history);
  }
}
