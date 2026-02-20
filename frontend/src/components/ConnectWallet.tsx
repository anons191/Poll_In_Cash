"use client";

/**
 * ConnectWallet Component
 * Thirdweb ConnectButton with in-app wallet strategy
 * On connect: calls POST /auth/nonce then POST /auth/verify
 */

import { useState, useCallback, useEffect } from "react";
import {
  ConnectButton,
  useActiveAccount,
  useActiveWallet,
  useActiveWalletChain,
  useSwitchActiveWalletChain,
  useDisconnect,
} from "thirdweb/react";
import { signMessage } from "thirdweb/utils";
import {
  getThirdwebClient,
  baseSepolia,
  supportedWallets,
  recommendedWallets,
  requestNonce,
  verifySignature,
  storeAuthToken,
  clearAuthToken,
  getAuthToken,
  shortenAddress,
} from "@/lib/thirdweb";

// ============ Types ============

interface AuthState {
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  error: string | null;
  token: string | null;
}

interface ConnectWalletProps {
  /** Callback when user successfully authenticates */
  onAuthenticated?: (token: string, address: string) => void;
  /** Callback when user disconnects */
  onDisconnected?: () => void;
  /** Custom className for the button container */
  className?: string;
  /** Whether to show a simplified button (just connect, no profile) */
  simplified?: boolean;
}

// ============ Component ============

export function ConnectWallet({
  onAuthenticated,
  onDisconnected,
  className = "",
  simplified = false,
}: ConnectWalletProps) {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const activeChain = useActiveWalletChain();
  const switchChain = useSwitchActiveWalletChain();
  const { disconnect } = useDisconnect();

  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isAuthenticating: false,
    error: null,
    token: null,
  });

  // Check for existing token on mount
  useEffect(() => {
    const existingToken = getAuthToken();
    if (existingToken) {
      setAuthState((prev) => ({
        ...prev,
        isAuthenticated: true,
        token: existingToken,
      }));
    }
  }, []);

  /**
   * Ensure the wallet is on the correct chain (Base Sepolia)
   */
  const ensureCorrectChain = useCallback(async (): Promise<boolean> => {
    if (!activeChain || activeChain.id !== baseSepolia.id) {
      try {
        await switchChain(baseSepolia);
        return true;
      } catch (error) {
        console.error("Failed to switch chain:", error);
        setAuthState((prev) => ({
          ...prev,
          isAuthenticating: false,
          error: "Please switch to Base Sepolia network",
        }));
        return false;
      }
    }
    return true;
  }, [activeChain, switchChain]);

  /**
   * Authenticate the connected wallet with the backend
   */
  const authenticateWithBackend = useCallback(
    async (address: string) => {
      setAuthState((prev) => ({
        ...prev,
        isAuthenticating: true,
        error: null,
      }));

      try {
        // Step 0: Ensure correct chain
        const onCorrectChain = await ensureCorrectChain();
        if (!onCorrectChain) {
          return;
        }

        // Step 1: Request nonce from backend
        const { nonce, message } = await requestNonce(address);

        // Step 2: Sign the message with the wallet
        if (!account) {
          throw new Error("No account connected");
        }

        const signature = await signMessage({
          account,
          message,
        });

        // Step 3: Verify signature with backend and get JWT
        const { token } = await verifySignature(address, signature, nonce);

        // Step 4: Store token and update state
        storeAuthToken(token);
        setAuthState({
          isAuthenticated: true,
          isAuthenticating: false,
          error: null,
          token,
        });

        // Notify parent component
        onAuthenticated?.(token, address);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Authentication failed";
        setAuthState((prev) => ({
          ...prev,
          isAuthenticating: false,
          error: errorMessage,
        }));
        console.error("Authentication error:", error);
      }
    },
    [account, onAuthenticated, ensureCorrectChain]
  );

  /**
   * Handle wallet connection - trigger authentication
   */
  const handleConnect = useCallback(() => {
    if (account?.address && !authState.isAuthenticated && !authState.isAuthenticating) {
      authenticateWithBackend(account.address);
    }
  }, [account?.address, authState.isAuthenticated, authState.isAuthenticating, authenticateWithBackend]);

  // Auto-authenticate when wallet connects (only once per connection)
  useEffect(() => {
    // Don't retry if there's an error - user must manually retry
    if (authState.error) {
      return;
    }

    if (account?.address && !authState.isAuthenticated && !authState.isAuthenticating) {
      // Check if we already have a valid token
      const existingToken = getAuthToken();
      if (!existingToken) {
        authenticateWithBackend(account.address);
      } else {
        setAuthState((prev) => ({
          ...prev,
          isAuthenticated: true,
          token: existingToken,
        }));
        onAuthenticated?.(existingToken, account.address);
      }
    }
  }, [account?.address, authState.isAuthenticated, authState.isAuthenticating, authState.error, authenticateWithBackend, onAuthenticated]);

  /**
   * Handle disconnect
   */
  const handleDisconnect = useCallback(() => {
    if (wallet) {
      disconnect(wallet);
    }
    clearAuthToken();
    setAuthState({
      isAuthenticated: false,
      isAuthenticating: false,
      error: null,
      token: null,
    });
    onDisconnected?.();
  }, [wallet, disconnect, onDisconnected]);

  const client = getThirdwebClient();

  return (
    <div className={`connect-wallet ${className}`}>
      <ConnectButton
        client={client}
        chain={baseSepolia}
        wallets={supportedWallets}
        recommendedWallets={recommendedWallets}
        connectModal={{
          size: "compact",
          title: "Connect to Poll in Cash",
          showThirdwebBranding: false,
          welcomeScreen: {
            title: "Welcome to Poll in Cash",
            subtitle: "Connect your wallet to participate in polls and earn USDC",
          },
        }}
        connectButton={{
          label: "Connect Wallet",
          className: "connect-btn",
        }}
        detailsButton={{
          displayBalanceToken: {
            [baseSepolia.id]: "0x036cbd53842c5426634e7929541ec2318f3dcf7e", // USDC
          },
        }}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        appMetadata={{
          name: "Poll in Cash",
          url: "https://pollincash.com",
          description: "Participate in polls and earn USDC",
          logoUrl: "/logo.png",
        }}
      />

      {/* Authentication Status */}
      {authState.isAuthenticating && (
        <div className="mt-2 text-sm text-gray-500 flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Authenticating...
        </div>
      )}

      {authState.error && (
        <div className="mt-2 text-sm text-red-500">
          {authState.error}
          <button
            onClick={() => account?.address && authenticateWithBackend(account.address)}
            className="ml-2 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {authState.isAuthenticated && !simplified && (
        <div className="mt-2 text-sm text-green-600">
          Authenticated
        </div>
      )}
    </div>
  );
}

// ============ Simplified Connect Button ============

/**
 * A simplified version that just shows connect/address without auth status
 */
export function SimpleConnectButton({ className = "" }: { className?: string }) {
  return (
    <ConnectWallet className={className} simplified />
  );
}

// ============ Wallet Display ============

/**
 * Component to display connected wallet info
 */
export function WalletDisplay({ className = "" }: { className?: string }) {
  const account = useActiveAccount();

  if (!account) {
    return null;
  }

  return (
    <div className={`wallet-display flex items-center gap-2 ${className}`}>
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500" />
      <div>
        <div className="text-sm font-medium">
          {shortenAddress(account.address)}
        </div>
        <div className="text-xs text-gray-500">Base Sepolia</div>
      </div>
    </div>
  );
}

export default ConnectWallet;
