"use client";

/**
 * RequireWallet Component
 * Wrapper that ensures a wallet is connected before showing content.
 * Shows a connect wallet prompt if no wallet is connected.
 */

import { useActiveAccount } from "thirdweb/react";
import { ConnectWallet } from "./ConnectWallet";

interface RequireWalletProps {
  children: React.ReactNode;
  /** Custom title for the connect prompt */
  title?: string;
  /** Custom description for the connect prompt */
  description?: string;
}

export function RequireWallet({
  children,
  title = "Connect Your Wallet",
  description = "You need to connect a wallet to access this page.",
}: RequireWalletProps) {
  const account = useActiveAccount();

  if (!account) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            {/* Icon */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#1B4D7A] to-[#14B8A6] flex items-center justify-center">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>

            {/* Description */}
            <p className="text-gray-400 mb-8">{description}</p>

            {/* Connect Button */}
            <div className="flex justify-center">
              <ConnectWallet />
            </div>

            {/* Help text */}
            <p className="text-sm text-gray-500 mt-6">
              Make sure you&apos;re on <span className="text-[#14B8A6]">Base Sepolia</span> network
            </p>

            {/* Faucet links */}
            <div className="mt-6 pt-6 border-t border-gray-800">
              <p className="text-xs text-gray-500 mb-3">Need testnet funds?</p>
              <div className="flex flex-col gap-2">
                <a
                  href="https://www.coinbase.com/faucets/base-sepolia"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#14B8A6] hover:underline"
                >
                  Get test ETH (for gas)
                </a>
                <a
                  href="https://faucet.circle.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#14B8A6] hover:underline"
                >
                  Get test USDC (for polls)
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default RequireWallet;
