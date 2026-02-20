"use client";

/**
 * WalletInfo Component
 * USDC balance display, truncated wallet address with copy-to-clipboard button
 */

import { useState, useCallback } from "react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

// ============ Types ============

interface WalletInfoProps {
  /** Wallet address */
  address: string;
  /** USDC balance */
  usdcBalance: number;
  /** Whether balance is loading */
  balanceLoading?: boolean;
  /** Native token balance (ETH/MATIC etc) */
  nativeBalance?: number;
  /** Native token symbol */
  nativeSymbol?: string;
  /** Network name */
  networkName?: string;
  /** Callback to disconnect wallet */
  onDisconnect?: () => void;
  /** Callback to refresh balance */
  onRefresh?: () => void;
  /** Additional className */
  className?: string;
}

// ============ Helper Functions ============

function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

function formatBalance(balance: number, decimals = 2): string {
  return balance.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// ============ Component ============

export function WalletInfo({
  address,
  usdcBalance,
  balanceLoading = false,
  nativeBalance,
  nativeSymbol = "ETH",
  networkName = "Base",
  onDisconnect,
  onRefresh,
  className = "",
}: WalletInfoProps) {
  const [copied, setCopied] = useState(false);

  // Copy address to clipboard
  const copyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  }, [address]);

  return (
    <Card className={className} padding="lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {/* Wallet avatar */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1B4D7A] to-[#14B8A6] flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Connected Wallet
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {networkName}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Refresh balance"
            >
              <svg
                className={`w-4 h-4 ${balanceLoading ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
          {onDisconnect && (
            <Button variant="ghost" size="sm" onClick={onDisconnect}>
              Disconnect
            </Button>
          )}
        </div>
      </div>

      {/* Address */}
      <div className="mb-6">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          Wallet Address
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-mono text-gray-900 dark:text-white">
            {shortenAddress(address, 6)}
          </code>
          <button
            onClick={copyAddress}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            title={copied ? "Copied!" : "Copy address"}
          >
            {copied ? (
              <svg
                className="w-5 h-5 text-[#22C55E]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            )}
          </button>
          <a
            href={`https://basescan.org/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            title="View on BaseScan"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
      </div>

      {/* Balances */}
      <div className="grid grid-cols-2 gap-4">
        {/* USDC Balance */}
        <div className="p-4 bg-[#22C55E]/10 dark:bg-[#22C55E]/20 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-[#22C55E] flex items-center justify-center">
              <span className="text-xs font-bold text-white">$</span>
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              USDC
            </span>
          </div>
          {balanceLoading ? (
            <div className="h-8 w-24 bg-[#22C55E]/20 rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-[#22C55E]">
              ${formatBalance(usdcBalance)}
            </p>
          )}
        </div>

        {/* Native Balance */}
        {nativeBalance !== undefined && (
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-[#1B4D7A] flex items-center justify-center">
                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12 2L2 12l10 10 10-10L12 2zm0 18l-8-8 8-8 8 8-8 8z"
                  />
                </svg>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {nativeSymbol}
              </span>
            </div>
            {balanceLoading ? (
              <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatBalance(nativeBalance, 4)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Low balance warning */}
      {nativeBalance !== undefined && nativeBalance < 0.001 && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div className="flex gap-2">
            <svg
              className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                Low {nativeSymbol} balance
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
                You may need {nativeSymbol} for transaction fees.
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ============ Compact Wallet Badge ============

interface WalletBadgeProps {
  address: string;
  onClick?: () => void;
  className?: string;
}

export function WalletBadge({ address, onClick, className = "" }: WalletBadgeProps) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${className}`}
    >
      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#1B4D7A] to-[#14B8A6]" />
      <span className="text-sm font-medium text-gray-900 dark:text-white">
        {shortenAddress(address)}
      </span>
    </button>
  );
}

export default WalletInfo;
