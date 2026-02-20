"use client";

/**
 * useProfile Hook
 * Profile and earnings data fetching and state management
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchProfile,
  updateProfile,
  fetchEarnings,
  ApiClientError,
} from "../lib/api";
import type {
  Profile,
  UpdateProfileInput,
  Earning,
  AgentPreferences,
} from "../lib/types";

// ============ useProfile Hook ============

/**
 * Profile state interface
 */
export interface ProfileState {
  profile: Profile | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
}

/**
 * Profile hook return type
 */
export interface UseProfileReturn extends ProfileState {
  refetch: () => Promise<void>;
  update: (data: UpdateProfileInput) => Promise<Profile>;
}

/**
 * useProfile Hook
 *
 * Fetches and manages user profile data with update capabilities.
 *
 * @returns Profile state and methods
 *
 * @example
 * const { profile, isLoading, update } = useProfile();
 *
 * const handleUpdateName = async (name: string) => {
 *   await update({ displayName: name });
 * };
 */
export function useProfile(): UseProfileReturn {
  const [state, setState] = useState<ProfileState>({
    profile: null,
    isLoading: true,
    isUpdating: false,
    error: null,
  });

  const isMounted = useRef(true);

  const updateState = useCallback((updates: Partial<ProfileState>) => {
    if (isMounted.current) {
      setState((prev) => ({ ...prev, ...updates }));
    }
  }, []);

  const refetch = useCallback(async () => {
    updateState({ isLoading: true, error: null });

    try {
      const profile = await fetchProfile();
      updateState({
        profile,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : "Failed to fetch profile";
      updateState({
        isLoading: false,
        error: message,
      });
    }
  }, [updateState]);

  const update = useCallback(async (data: UpdateProfileInput): Promise<Profile> => {
    updateState({ isUpdating: true, error: null });

    try {
      const profile = await updateProfile(data);
      updateState({
        profile,
        isUpdating: false,
        error: null,
      });
      return profile;
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : "Failed to update profile";
      updateState({
        isUpdating: false,
        error: message,
      });
      throw error;
    }
  }, [updateState]);

  // Initial fetch
  useEffect(() => {
    refetch();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return {
    ...state,
    refetch,
    update,
  };
}

// ============ useEarnings Hook ============

/**
 * Earnings state interface
 */
export interface EarningsState {
  earnings: Earning[];
  isLoading: boolean;
  error: string | null;
  summary: {
    total: number;
    pending: number;
    paid: number;
    thisWeek: number;
    thisMonth: number;
  };
}

/**
 * Earnings hook return type
 */
export interface UseEarningsReturn extends EarningsState {
  refetch: () => Promise<void>;
}

/**
 * Calculate earnings summary from earnings array
 */
function calculateEarningsSummary(earnings: Earning[]): EarningsState["summary"] {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let total = 0;
  let pending = 0;
  let paid = 0;
  let thisWeek = 0;
  let thisMonth = 0;

  for (const earning of earnings) {
    const amount = parseFloat(earning.amount) || 0;
    const createdAt = new Date(earning.createdAt);

    total += amount;

    if (earning.status === "pending") {
      pending += amount;
    } else if (earning.status === "paid") {
      paid += amount;
    }

    if (createdAt >= weekAgo) {
      thisWeek += amount;
    }

    if (createdAt >= monthAgo) {
      thisMonth += amount;
    }
  }

  return { total, pending, paid, thisWeek, thisMonth };
}

/**
 * useEarnings Hook
 *
 * Fetches and manages earnings history with calculated summary.
 *
 * @returns Earnings state and methods
 *
 * @example
 * const { earnings, summary, isLoading } = useEarnings();
 *
 * console.log(`Total earned: ${formatUSDC(summary.total)}`);
 */
export function useEarnings(): UseEarningsReturn {
  const [state, setState] = useState<EarningsState>({
    earnings: [],
    isLoading: true,
    error: null,
    summary: {
      total: 0,
      pending: 0,
      paid: 0,
      thisWeek: 0,
      thisMonth: 0,
    },
  });

  const isMounted = useRef(true);

  const updateState = useCallback((updates: Partial<EarningsState>) => {
    if (isMounted.current) {
      setState((prev) => ({ ...prev, ...updates }));
    }
  }, []);

  const refetch = useCallback(async () => {
    updateState({ isLoading: true, error: null });

    try {
      const earnings = await fetchEarnings();
      const summary = calculateEarningsSummary(earnings);
      updateState({
        earnings,
        summary,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : "Failed to fetch earnings";
      updateState({
        isLoading: false,
        error: message,
      });
    }
  }, [updateState]);

  // Initial fetch
  useEffect(() => {
    refetch();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return {
    ...state,
    refetch,
  };
}

// ============ useAgentPreferences Hook ============

/**
 * Agent preferences state interface
 */
export interface AgentPreferencesState {
  preferences: AgentPreferences | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

/**
 * Agent preferences hook return type
 */
export interface UseAgentPreferencesReturn extends AgentPreferencesState {
  updatePreferences: (preferences: Partial<AgentPreferences>) => Promise<void>;
  toggleAgent: () => Promise<void>;
}

/**
 * Default agent preferences
 */
const defaultAgentPreferences: AgentPreferences = {
  enabled: false,
  categories: [],
  minPayout: "0.10",
  maxDailyPolls: 50,
  excludedTopics: [],
};

/**
 * useAgentPreferences Hook
 *
 * Manages agent preferences for automated poll participation.
 *
 * @returns Agent preferences state and methods
 *
 * @example
 * const { preferences, toggleAgent, updatePreferences } = useAgentPreferences();
 *
 * // Toggle agent on/off
 * await toggleAgent();
 *
 * // Update specific preferences
 * await updatePreferences({ minPayout: "0.50" });
 */
export function useAgentPreferences(): UseAgentPreferencesReturn {
  const [state, setState] = useState<AgentPreferencesState>({
    preferences: null,
    isLoading: true,
    isSaving: false,
    error: null,
  });

  const isMounted = useRef(true);

  const updateState = useCallback((updates: Partial<AgentPreferencesState>) => {
    if (isMounted.current) {
      setState((prev) => ({ ...prev, ...updates }));
    }
  }, []);

  // Fetch initial preferences from profile
  const fetchPreferences = useCallback(async () => {
    updateState({ isLoading: true, error: null });

    try {
      const profile = await fetchProfile();
      const preferences = profile.agentPreferences || {
        ...defaultAgentPreferences,
        enabled: profile.agentEnabled,
      };
      updateState({
        preferences,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : "Failed to fetch preferences";
      updateState({
        isLoading: false,
        error: message,
      });
    }
  }, [updateState]);

  const updatePreferences = useCallback(async (newPreferences: Partial<AgentPreferences>) => {
    updateState({ isSaving: true, error: null });

    try {
      const profile = await updateProfile({
        agentPreferences: newPreferences,
      });
      const preferences = profile.agentPreferences || {
        ...defaultAgentPreferences,
        enabled: profile.agentEnabled,
      };
      updateState({
        preferences,
        isSaving: false,
        error: null,
      });
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : "Failed to update preferences";
      updateState({
        isSaving: false,
        error: message,
      });
      throw error;
    }
  }, [updateState]);

  const toggleAgent = useCallback(async () => {
    const currentEnabled = state.preferences?.enabled ?? false;
    await updatePreferences({ enabled: !currentEnabled });
  }, [state.preferences?.enabled, updatePreferences]);

  // Initial fetch
  useEffect(() => {
    fetchPreferences();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return {
    ...state,
    updatePreferences,
    toggleAgent,
  };
}

export default useProfile;
