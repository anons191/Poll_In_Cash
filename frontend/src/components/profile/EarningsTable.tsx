"use client";

/**
 * EarningsTable Component
 * Sortable table of past payouts with columns:
 * date, poll title, amount, tx hash (links to BaseScan)
 */

import { useState, useMemo } from "react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

// ============ Types ============

interface Payout {
  id: string;
  date: Date | string;
  pollTitle: string;
  pollId: string;
  amount: number;
  txHash: string;
  status: "completed" | "pending" | "failed";
}

type SortField = "date" | "amount" | "pollTitle";
type SortDirection = "asc" | "desc";

interface EarningsTableProps {
  /** List of payouts */
  payouts: Payout[];
  /** Whether to show loading state */
  loading?: boolean;
  /** Base URL for explorer (defaults to BaseScan) */
  explorerUrl?: string;
  /** Callback when row is clicked */
  onRowClick?: (payout: Payout) => void;
  /** Additional className */
  className?: string;
}

// ============ Helper Functions ============

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortenHash(hash: string): string {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

// ============ Component ============

export function EarningsTable({
  payouts,
  loading = false,
  explorerUrl = "https://basescan.org",
  onRowClick,
  className = "",
}: EarningsTableProps) {
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Sort payouts
  const sortedPayouts = useMemo(() => {
    const sorted = [...payouts].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "date":
          const dateA = typeof a.date === "string" ? new Date(a.date) : a.date;
          const dateB = typeof b.date === "string" ? new Date(b.date) : b.date;
          comparison = dateA.getTime() - dateB.getTime();
          break;
        case "amount":
          comparison = a.amount - b.amount;
          break;
        case "pollTitle":
          comparison = a.pollTitle.localeCompare(b.pollTitle);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [payouts, sortField, sortDirection]);

  // Calculate totals
  const totals = useMemo(() => {
    return {
      completed: payouts
        .filter((p) => p.status === "completed")
        .reduce((sum, p) => sum + p.amount, 0),
      pending: payouts
        .filter((p) => p.status === "pending")
        .reduce((sum, p) => sum + p.amount, 0),
      count: payouts.filter((p) => p.status === "completed").length,
    };
  }, [payouts]);

  // Sort icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      );
    }
    return sortDirection === "asc" ? (
      <svg
        className="w-4 h-4 text-[#1B4D7A] dark:text-[#14B8A6]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 15l7-7 7 7"
        />
      </svg>
    ) : (
      <svg
        className="w-4 h-4 text-[#1B4D7A] dark:text-[#14B8A6]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    );
  };

  if (loading) {
    return (
      <Card className={className} padding="none">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
            <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-10 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
        </div>
      </Card>
    );
  }

  if (payouts.length === 0) {
    return (
      <Card className={className} padding="lg">
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            No earnings yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Complete polls to start earning USDC.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={className} padding="none">
      {/* Summary */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total Earned
            </p>
            <p className="text-2xl font-bold text-[#22C55E]">
              ${totals.completed.toFixed(2)}
              <span className="text-sm font-normal text-gray-400 ml-1">
                USDC
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {totals.count} completed
              {totals.pending > 0 && (
                <span className="ml-2">
                  | ${totals.pending.toFixed(2)} pending
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800">
              <th className="text-left px-4 py-3">
                <button
                  onClick={() => handleSort("date")}
                  className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Date
                  <SortIcon field="date" />
                </button>
              </th>
              <th className="text-left px-4 py-3">
                <button
                  onClick={() => handleSort("pollTitle")}
                  className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Poll
                  <SortIcon field="pollTitle" />
                </button>
              </th>
              <th className="text-right px-4 py-3">
                <button
                  onClick={() => handleSort("amount")}
                  className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300 ml-auto"
                >
                  Amount
                  <SortIcon field="amount" />
                </button>
              </th>
              <th className="text-left px-4 py-3">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </span>
              </th>
              <th className="text-right px-4 py-3">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Transaction
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {sortedPayouts.map((payout) => (
              <tr
                key={payout.id}
                className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
                onClick={() => onRowClick?.(payout)}
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDate(payout.date)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatTime(payout.date)}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-gray-900 dark:text-white truncate max-w-[200px]">
                    {payout.pollTitle}
                  </p>
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="text-sm font-semibold text-[#22C55E]">
                    +${payout.amount.toFixed(2)}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      payout.status === "completed"
                        ? "success"
                        : payout.status === "pending"
                        ? "warning"
                        : "danger"
                    }
                    size="sm"
                  >
                    {payout.status.charAt(0).toUpperCase() +
                      payout.status.slice(1)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={`${explorerUrl}/tx/${payout.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-[#1B4D7A] dark:text-[#14B8A6] hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {shortenHash(payout.txHash)}
                    <svg
                      className="w-3 h-3"
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Export button */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <Button variant="ghost" size="sm">
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Export CSV
        </Button>
      </div>
    </Card>
  );
}

export default EarningsTable;
