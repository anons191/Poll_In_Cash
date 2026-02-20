"use client";

/**
 * useDashboard Hook
 * Dashboard data fetching and state management
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchDashboardSummary,
  fetchDashboardActivity,
  ApiClientError,
} from "../lib/api";
import type { DashboardSummary, Activity } from "../lib/types";
import { REFRESH_INTERVALS } from "../lib/constants";

/**
 * Dashboard state interface
 */
export interface DashboardState {
  summary: DashboardSummary | null;
  activity: Activity[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

/**
 * Dashboard hook return type
 */
export interface UseDashboardReturn extends DashboardState {
  refetch: () => Promise<void>;
  refetchSummary: () => Promise<void>;
  refetchActivity: () => Promise<void>;
}

/**
 * Default dashboard summary for loading state
 * Can be used as fallback when data is not yet loaded
 */
export const DEFAULT_DASHBOARD_SUMMARY: DashboardSummary = {
  totalEarnings: "0",
  pendingEarnings: "0",
  activePolls: 0,
  completedPolls: 0,
  totalResponses: 0,
  averageConfidence: 0,
  weeklyChange: {
    earnings: 0,
    polls: 0,
  },
};

/**
 * useDashboard Hook
 *
 * Fetches and manages dashboard data including summary statistics
 * and activity feed. Auto-refreshes every 30 seconds when tab is focused.
 *
 * @param autoRefresh - Whether to enable auto-refresh (default: true)
 * @returns Dashboard state and methods
 *
 * @example
 * const { summary, activity, isLoading, refetch } = useDashboard();
 *
 * if (isLoading) return <Skeleton />;
 *
 * return (
 *   <div>
 *     <h2>Total Earnings: {formatUSDC(summary.totalEarnings)}</h2>
 *     <ActivityFeed items={activity} />
 *   </div>
 * );
 */
export function useDashboard(autoRefresh: boolean = true): UseDashboardReturn {
  const [state, setState] = useState<DashboardState>({
    summary: null,
    activity: [],
    isLoading: true,
    isRefreshing: false,
    error: null,
    lastUpdated: null,
  });

  // Track if component is mounted
  const isMounted = useRef(true);

  // Track if tab is visible
  const isVisible = useRef(true);

  /**
   * Update state helper (only if mounted)
   */
  const updateState = useCallback((updates: Partial<DashboardState>) => {
    if (isMounted.current) {
      setState((prev) => ({ ...prev, ...updates }));
    }
  }, []);

  /**
   * Fetch dashboard summary
   */
  const refetchSummary = useCallback(async () => {
    try {
      const summary = await fetchDashboardSummary();
      updateState({ summary, error: null });
    } catch (error) {
      if (error instanceof ApiClientError) {
        updateState({ error: error.message });
      } else {
        updateState({ error: "Failed to fetch dashboard summary" });
      }
      throw error;
    }
  }, [updateState]);

  /**
   * Fetch activity feed
   */
  const refetchActivity = useCallback(async () => {
    try {
      const activity = await fetchDashboardActivity();
      updateState({ activity, error: null });
    } catch (error) {
      if (error instanceof ApiClientError) {
        updateState({ error: error.message });
      } else {
        updateState({ error: "Failed to fetch activity" });
      }
      throw error;
    }
  }, [updateState]);

  /**
   * Fetch all dashboard data
   */
  const refetch = useCallback(async () => {
    const isInitialLoad = state.summary === null;

    updateState({
      isLoading: isInitialLoad,
      isRefreshing: !isInitialLoad,
      error: null,
    });

    try {
      // Fetch both in parallel
      const [summary, activity] = await Promise.all([
        fetchDashboardSummary(),
        fetchDashboardActivity(),
      ]);

      updateState({
        summary,
        activity,
        isLoading: false,
        isRefreshing: false,
        lastUpdated: new Date(),
        error: null,
      });
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : "Failed to fetch dashboard data";

      updateState({
        isLoading: false,
        isRefreshing: false,
        error: message,
      });
    }
  }, [state.summary, updateState]);

  /**
   * Initial fetch on mount
   */
  useEffect(() => {
    // Using a flag to prevent multiple initial fetches
    let didFetch = false;
    if (!didFetch) {
      didFetch = true;
      refetch();
    }
    // Only run on mount, not when refetch changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Setup auto-refresh interval
   */
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      // Only refresh if tab is visible and not already refreshing
      if (isVisible.current && !state.isRefreshing) {
        refetch();
      }
    }, REFRESH_INTERVALS.DASHBOARD);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refetch, state.isRefreshing]);

  /**
   * Track tab visibility
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisible.current = document.visibilityState === "visible";

      // Refresh when tab becomes visible again
      if (isVisible.current && autoRefresh) {
        refetch();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [autoRefresh, refetch]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return {
    ...state,
    refetch,
    refetchSummary,
    refetchActivity,
  };
}

export default useDashboard;
