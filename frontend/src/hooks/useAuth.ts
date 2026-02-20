"use client";

/**
 * useAuth Hook
 * Authentication state management using Thirdweb wallet integration
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useActiveAccount, useDisconnect, useActiveWallet } from "thirdweb/react";
import { signMessage } from "thirdweb/utils";
import {
  fetchNonce,
  verifySignature,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  fetchProfile,
  ApiClientError,
} from "../lib/api";
import type { User, Profile } from "../lib/types";

/**
 * Authentication state interface
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoggingIn: boolean;
  user: User | null;
  profile: Profile | null;
  walletAddress: string | null;
  error: string | null;
}

/**
 * Authentication hook return type
 */
export interface UseAuthReturn extends AuthState {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

/**
 * useAuth Hook
 *
 * Manages authentication state with Thirdweb wallet integration.
 * Handles wallet connection, signature-based auth, and JWT token management.
 *
 * @returns Authentication state and methods
 *
 * @example
 * const { isAuthenticated, user, login, logout } = useAuth();
 *
 * if (isAuthenticated) {
 *   console.log("Logged in as:", user?.walletAddress);
 * }
 */
export function useAuth(): UseAuthReturn {
  // Thirdweb wallet state
  const activeAccount = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();

  // Local auth state
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    isLoggingIn: false,
    user: null,
    profile: null,
    walletAddress: null,
    error: null,
  });

  // Track previous wallet address to detect changes
  const prevAddressRef = useRef<string | null>(null);

  /**
   * Update state helper
   */
  const updateState = useCallback((updates: Partial<AuthState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * Check existing authentication on mount and when wallet changes
   */
  useEffect(() => {
    const address = activeAccount?.address || null;
    const prevAddress = prevAddressRef.current;
    prevAddressRef.current = address;

    // Check if wallet address changed
    const addressChanged = prevAddress !== null && address !== prevAddress;

    const checkAuth = async () => {
      const token = getAuthToken();

      // If wallet changed while authenticated, clear auth
      if (addressChanged && token) {
        clearAuthToken();
        setState({
          isAuthenticated: false,
          isLoading: false,
          isLoggingIn: false,
          user: null,
          profile: null,
          walletAddress: address,
          error: null,
        });
        return;
      }

      if (!token || !address) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isAuthenticated: false,
          user: null,
          profile: null,
          walletAddress: address,
        }));
        return;
      }

      try {
        // Validate token by fetching profile
        const profile = await fetchProfile();
        setState({
          isLoading: false,
          isLoggingIn: false,
          isAuthenticated: true,
          user: {
            id: profile.id,
            walletAddress: profile.walletAddress,
            createdAt: profile.createdAt,
          },
          profile,
          walletAddress: address,
          error: null,
        });
      } catch (error) {
        // Token is invalid, clear it
        if (error instanceof ApiClientError && error.isUnauthorized()) {
          clearAuthToken();
        }
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isAuthenticated: false,
          user: null,
          profile: null,
          walletAddress: address,
        }));
      }
    };

    checkAuth();
  }, [activeAccount?.address]);

  /**
   * Login with wallet signature
   */
  const login = useCallback(async () => {
    if (!activeAccount) {
      updateState({ error: "No wallet connected" });
      return;
    }

    updateState({ isLoggingIn: true, error: null });

    try {
      const walletAddress = activeAccount.address;

      // Step 1: Get nonce from backend
      const { nonce, message } = await fetchNonce(walletAddress);

      // Step 2: Sign the message with wallet
      const signature = await signMessage({
        account: activeAccount,
        message,
      });

      // Step 3: Verify signature and get JWT
      const { token, user } = await verifySignature(walletAddress, signature, nonce);

      // Step 4: Store token
      setAuthToken(token);

      // Step 5: Fetch full profile
      const profile = await fetchProfile();

      updateState({
        isLoggingIn: false,
        isAuthenticated: true,
        user,
        profile,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      updateState({
        isLoggingIn: false,
        error: message,
      });
      throw error;
    }
  }, [activeAccount, updateState]);

  /**
   * Logout and disconnect wallet
   */
  const logout = useCallback(async () => {
    clearAuthToken();

    // Disconnect wallet if connected
    if (activeWallet) {
      try {
        await disconnect(activeWallet);
      } catch {
        // Ignore disconnect errors
      }
    }

    updateState({
      isAuthenticated: false,
      user: null,
      profile: null,
      error: null,
    });
  }, [activeWallet, disconnect, updateState]);

  /**
   * Refresh profile data
   */
  const refreshProfile = useCallback(async () => {
    if (!state.isAuthenticated) return;

    try {
      const profile = await fetchProfile();
      updateState({ profile });
    } catch (error) {
      if (error instanceof ApiClientError && error.isUnauthorized()) {
        // Token expired, log out
        await logout();
      }
    }
  }, [state.isAuthenticated, logout, updateState]);

  return {
    ...state,
    login,
    logout,
    refreshProfile,
  };
}

export default useAuth;
