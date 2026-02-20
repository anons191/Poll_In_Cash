"use client";

/**
 * usePolls Hook
 * Poll data fetching and mutation state management
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchPolls,
  fetchPoll,
  createPoll,
  closePoll,
  cancelPoll,
  fundPoll as fundPollApi,
  fetchPollResponses,
  ApiClientError,
} from "../lib/api";
import type {
  Poll,
  PollFilters,
  CreatePollInput,
  PollResponse,
} from "../lib/types";

// ============ usePolls Hook ============

/**
 * Polls list state interface
 */
export interface PollsState {
  polls: Poll[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
}

/**
 * Polls hook return type
 */
export interface UsePollsReturn extends PollsState {
  refetch: (filters?: PollFilters) => Promise<void>;
  filters: PollFilters;
  setFilters: (filters: PollFilters) => void;
}

/**
 * usePolls Hook
 *
 * Fetches and manages poll list with filtering support.
 *
 * @param initialFilters - Initial filter values
 * @returns Polls state and methods
 *
 * @example
 * const { polls, isLoading, refetch, setFilters } = usePolls({ status: "active" });
 *
 * // Filter by creator
 * setFilters({ isCreator: true });
 */
export function usePolls(initialFilters?: PollFilters): UsePollsReturn {
  const [state, setState] = useState<PollsState>({
    polls: [],
    isLoading: true,
    isRefreshing: false,
    error: null,
  });

  const [filters, setFilters] = useState<PollFilters>(initialFilters || {});
  const isMounted = useRef(true);

  const updateState = useCallback((updates: Partial<PollsState>) => {
    if (isMounted.current) {
      setState((prev) => ({ ...prev, ...updates }));
    }
  }, []);

  const refetch = useCallback(async (newFilters?: PollFilters) => {
    const activeFilters = newFilters || filters;
    const isInitialLoad = state.polls.length === 0;

    updateState({
      isLoading: isInitialLoad,
      isRefreshing: !isInitialLoad,
      error: null,
    });

    try {
      const polls = await fetchPolls(activeFilters);
      updateState({
        polls,
        isLoading: false,
        isRefreshing: false,
        error: null,
      });
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : "Failed to fetch polls";
      updateState({
        isLoading: false,
        isRefreshing: false,
        error: message,
      });
    }
  }, [filters, state.polls.length, updateState]);

  // Fetch when filters change
  useEffect(() => {
    refetch(filters);
  }, [filters]);

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
    filters,
    setFilters,
  };
}

// ============ usePoll Hook ============

/**
 * Single poll state interface
 */
export interface PollState {
  poll: Poll | null;
  responses: PollResponse[];
  isLoading: boolean;
  isLoadingResponses: boolean;
  error: string | null;
}

/**
 * Poll hook return type
 */
export interface UsePollReturn extends PollState {
  refetch: () => Promise<void>;
  fetchResponses: () => Promise<void>;
  close: () => Promise<void>;
  cancel: () => Promise<void>;
  isClosing: boolean;
  isCancelling: boolean;
}

/**
 * usePoll Hook
 *
 * Fetches and manages a single poll with mutations.
 *
 * @param pollId - Poll ID to fetch
 * @returns Poll state and methods
 *
 * @example
 * const { poll, responses, close, cancel } = usePoll(pollId);
 *
 * // Close the poll
 * await close();
 */
export function usePoll(pollId: string | null): UsePollReturn {
  const [state, setState] = useState<PollState>({
    poll: null,
    responses: [],
    isLoading: true,
    isLoadingResponses: false,
    error: null,
  });

  const [isClosing, setIsClosing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const isMounted = useRef(true);

  const updateState = useCallback((updates: Partial<PollState>) => {
    if (isMounted.current) {
      setState((prev) => ({ ...prev, ...updates }));
    }
  }, []);

  const refetch = useCallback(async () => {
    if (!pollId) {
      updateState({ poll: null, isLoading: false });
      return;
    }

    updateState({ isLoading: true, error: null });

    try {
      const poll = await fetchPoll(pollId);
      updateState({
        poll,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : "Failed to fetch poll";
      updateState({
        isLoading: false,
        error: message,
      });
    }
  }, [pollId, updateState]);

  const fetchResponsesHandler = useCallback(async () => {
    if (!pollId) return;

    updateState({ isLoadingResponses: true });

    try {
      const responses = await fetchPollResponses(pollId);
      updateState({
        responses,
        isLoadingResponses: false,
      });
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : "Failed to fetch responses";
      updateState({
        isLoadingResponses: false,
        error: message,
      });
    }
  }, [pollId, updateState]);

  const closeHandler = useCallback(async () => {
    if (!pollId) return;

    setIsClosing(true);
    try {
      await closePoll(pollId);
      await refetch();
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : "Failed to close poll";
      updateState({ error: message });
      throw error;
    } finally {
      setIsClosing(false);
    }
  }, [pollId, refetch, updateState]);

  const cancelHandler = useCallback(async () => {
    if (!pollId) return;

    setIsCancelling(true);
    try {
      await cancelPoll(pollId);
      await refetch();
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : "Failed to cancel poll";
      updateState({ error: message });
      throw error;
    } finally {
      setIsCancelling(false);
    }
  }, [pollId, refetch, updateState]);

  // Fetch poll when ID changes
  useEffect(() => {
    refetch();
  }, [pollId]);

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
    fetchResponses: fetchResponsesHandler,
    close: closeHandler,
    cancel: cancelHandler,
    isClosing,
    isCancelling,
  };
}

// ============ useCreatePoll Hook ============

/**
 * Create poll mutation state
 */
export interface CreatePollState {
  isCreating: boolean;
  error: string | null;
  createdPoll: Poll | null;
}

/**
 * Create poll hook return type
 */
export interface UseCreatePollReturn extends CreatePollState {
  create: (data: CreatePollInput) => Promise<Poll>;
  reset: () => void;
}

/**
 * useCreatePoll Hook
 *
 * Manages poll creation mutation state.
 *
 * @returns Create poll state and methods
 *
 * @example
 * const { create, isCreating, error } = useCreatePoll();
 *
 * const handleSubmit = async (data) => {
 *   try {
 *     const poll = await create(data);
 *     router.push(`/polls/${poll.id}`);
 *   } catch (e) {
 *     // Error is also available in `error`
 *   }
 * };
 */
export function useCreatePoll(): UseCreatePollReturn {
  const [state, setState] = useState<CreatePollState>({
    isCreating: false,
    error: null,
    createdPoll: null,
  });

  const create = useCallback(async (data: CreatePollInput): Promise<Poll> => {
    setState({ isCreating: true, error: null, createdPoll: null });

    try {
      const poll = await createPoll(data);
      setState({
        isCreating: false,
        error: null,
        createdPoll: poll,
      });
      return poll;
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : "Failed to create poll";
      setState({
        isCreating: false,
        error: message,
        createdPoll: null,
      });
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isCreating: false,
      error: null,
      createdPoll: null,
    });
  }, []);

  return {
    ...state,
    create,
    reset,
  };
}

// ============ usePollResponses Hook ============

/**
 * Poll responses state interface
 */
export interface PollResponsesState {
  responses: PollResponse[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Poll responses hook return type
 */
export interface UsePollResponsesReturn extends PollResponsesState {
  refetch: () => Promise<void>;
}

/**
 * usePollResponses Hook
 *
 * Fetches responses for a poll (creator only).
 *
 * @param pollId - Poll ID
 * @returns Poll responses state and methods
 */
export function usePollResponses(pollId: string | null): UsePollResponsesReturn {
  const [state, setState] = useState<PollResponsesState>({
    responses: [],
    isLoading: true,
    error: null,
  });

  const isMounted = useRef(true);

  const updateState = useCallback((updates: Partial<PollResponsesState>) => {
    if (isMounted.current) {
      setState((prev) => ({ ...prev, ...updates }));
    }
  }, []);

  const refetch = useCallback(async () => {
    if (!pollId) {
      updateState({ responses: [], isLoading: false });
      return;
    }

    updateState({ isLoading: true, error: null });

    try {
      const responses = await fetchPollResponses(pollId);
      updateState({
        responses,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const message = error instanceof ApiClientError
        ? error.message
        : "Failed to fetch responses";
      updateState({
        isLoading: false,
        error: message,
      });
    }
  }, [pollId, updateState]);

  // Fetch when poll ID changes
  useEffect(() => {
    refetch();
  }, [pollId]);

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

export default usePolls;
