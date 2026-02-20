"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { RequireWallet } from "@/components/RequireWallet";
import { useDashboard } from "@/hooks/useDashboard";
import { usePolls } from "@/hooks/usePolls";
import { useProfile, useAgentPreferences, useEarnings } from "@/hooks/useProfile";
import type { DashboardSummary, Activity, Poll, Earning } from "@/lib/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

// ============ Skeleton Components ============

function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-gray-800 animate-pulse rounded ${className}`} />
  );
}

function AgentStatusCardSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <SkeletonBox className="h-6 w-28" />
        <SkeletonBox className="h-6 w-24 rounded-full" />
      </div>
      <SkeletonBox className="h-5 w-64 mb-3" />
      <div className="flex gap-4 mb-4">
        <SkeletonBox className="h-10 w-24" />
        <SkeletonBox className="h-10 w-24" />
      </div>
      <SkeletonBox className="h-4 w-48" />
    </div>
  );
}

function ActivityLogSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <SkeletonBox className="h-6 w-36 mb-6" />
      <div className="space-y-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-start gap-4 p-3 rounded-lg bg-gray-800/50">
            <SkeletonBox className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <SkeletonBox className="h-5 w-48 mb-2" />
              <SkeletonBox className="h-4 w-32" />
            </div>
            <SkeletonBox className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EarningsDashboardSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <SkeletonBox className="h-6 w-40 mb-6" />
      <SkeletonBox className="h-12 w-32 mb-2" />
      <SkeletonBox className="h-4 w-24 mb-6" />
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-800/50 rounded-xl p-4">
          <SkeletonBox className="h-4 w-16 mb-2" />
          <SkeletonBox className="h-6 w-20" />
        </div>
        <div className="bg-gray-800/50 rounded-xl p-4">
          <SkeletonBox className="h-4 w-16 mb-2" />
          <SkeletonBox className="h-6 w-20" />
        </div>
      </div>
      <SkeletonBox className="h-40 w-full rounded-lg" />
    </div>
  );
}

function AgentProfileSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <SkeletonBox className="h-6 w-40 mb-6" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBox key={i} className="h-8 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function YourPollsSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <SkeletonBox className="h-6 w-28 mb-6" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-800/50 rounded-xl p-4">
            <SkeletonBox className="h-5 w-48 mb-2" />
            <SkeletonBox className="h-4 w-32 mb-3" />
            <SkeletonBox className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function WalletSectionSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <SkeletonBox className="h-6 w-24 mb-6" />
      <SkeletonBox className="h-10 w-32 mb-4" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <SkeletonBox key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <SkeletonBox className="h-9 w-48 mb-2" />
          <SkeletonBox className="h-5 w-80" />
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <AgentStatusCardSkeleton />
            <ActivityLogSkeleton />
          </div>
          <div className="space-y-6">
            <EarningsDashboardSkeleton />
            <AgentProfileSkeleton />
            <YourPollsSkeleton />
            <WalletSectionSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Error State ============

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-red-500"
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
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Failed to load agent activity
        </h2>
        <p className="text-gray-400 mb-6">{message}</p>
        <button
          onClick={onRetry}
          className="px-6 py-3 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

// ============ Agent Status Card ============

function AgentStatusCard({
  isConnected,
  lastAction,
  pollsToday,
  earnedToday,
  walletAddress,
}: {
  isConnected: boolean;
  lastAction?: { action: string; pollTitle: string; timeAgo: string };
  pollsToday: number;
  earnedToday: string;
  walletAddress?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Agent Status</h3>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            isConnected
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-gray-700/50 text-gray-400"
          }`}
        >
          <span className="relative flex h-2 w-2">
            {isConnected && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isConnected ? "bg-emerald-400" : "bg-gray-500"
              }`}
            ></span>
          </span>
          {isConnected ? "Connected" : "Disconnected"}
        </div>
      </div>

      {lastAction ? (
        <p className="text-gray-300 mb-4">
          <span className="text-gray-500">Last action:</span>{" "}
          {lastAction.action} &apos;{lastAction.pollTitle}&apos;{" "}
          <span className="text-gray-500">{lastAction.timeAgo}</span>
        </p>
      ) : (
        <p className="text-gray-500 mb-4 italic">
          Waiting for your agent to connect...
        </p>
      )}

      <div className="flex gap-6 mb-4">
        <div>
          <p className="text-2xl font-bold text-white">{pollsToday}</p>
          <p className="text-sm text-gray-500">Polls completed today</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-emerald-400">
            ${parseFloat(earnedToday).toFixed(2)}
          </p>
          <p className="text-sm text-gray-500">USDC earned today</p>
        </div>
      </div>

      {walletAddress && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Agent wallet:</span>
          <code className="text-sm text-gray-300 bg-gray-800 px-2 py-1 rounded font-mono">
            {truncateAddress(walletAddress)}
          </code>
          <button
            onClick={copyAddress}
            className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors text-gray-400 hover:text-white"
            title="Copy address"
          >
            {copied ? (
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ============ Activity Log ============

function ActivityLog({ activity }: { activity: Activity[] }) {
  const getActivityConfig = (type: Activity["type"]) => {
    switch (type) {
      case "poll_completed":
      case "agent_response":
        return {
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          bgColor: "bg-emerald-500/10",
          iconColor: "text-emerald-400",
          label: "Response submitted",
        };
      case "payment_received":
        return {
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          bgColor: "bg-blue-500/10",
          iconColor: "text-blue-400",
          label: "Payment received",
        };
      case "poll_created":
        return {
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          ),
          bgColor: "bg-purple-500/10",
          iconColor: "text-purple-400",
          label: "Poll created",
        };
      case "poll_closed":
        return {
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ),
          bgColor: "bg-amber-500/10",
          iconColor: "text-amber-400",
          label: "Poll closed",
        };
      default:
        return {
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          bgColor: "bg-gray-700/50",
          iconColor: "text-gray-400",
          label: "Activity",
        };
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (activity.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-6">Agent Activity Log</h3>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-400 font-medium mb-1">Waiting for your agent to connect...</p>
          <p className="text-gray-600 text-sm">Activity will appear here once your agent starts working</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Agent Activity Log</h3>
        <span className="text-sm text-gray-500">Real-time updates</span>
      </div>
      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        {activity.map((item) => {
          const config = getActivityConfig(item.type);
          return (
            <div
              key={item.id}
              className="flex items-start gap-4 p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/50 transition-colors"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${config.bgColor} ${config.iconColor}`}
              >
                {config.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {config.label}
                  </span>
                </div>
                <p className="font-medium text-white truncate">
                  {item.pollTitle || item.title}
                </p>
                <p className="text-sm text-gray-500">{formatTimestamp(item.timestamp)}</p>
              </div>
              {item.amount && (
                <span className="text-emerald-400 font-semibold whitespace-nowrap">
                  +${parseFloat(item.amount).toFixed(2)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ Earnings Dashboard ============

function EarningsDashboard({
  totalLifetime,
  pending,
  confirmed,
  earnings,
}: {
  totalLifetime: string;
  pending: string;
  confirmed: string;
  earnings: Earning[];
}) {
  // Safe number formatting helper
  const formatAmount = (value: string | number) => {
    const parsed = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(parsed)) return "0.00";
    return parsed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const chartData = useMemo(() => {
    const last7Days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const dayEarnings = earnings
        .filter((e) => e.createdAt.startsWith(dateStr))
        .reduce((sum, e) => sum + (parseFloat(e.amount || "0") || 0), 0);

      last7Days.push({
        date: date.toLocaleDateString("en-US", { weekday: "short" }),
        earnings: dayEarnings,
      });
    }

    return last7Days;
  }, [earnings]);

  const recentEarnings = earnings.slice(0, 5);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-white mb-6">Your Agent&apos;s Earnings</h3>

      <div className="mb-6">
        <p className="text-4xl font-bold text-white">
          ${formatAmount(totalLifetime)}
        </p>
        <p className="text-sm text-gray-500">Total lifetime earnings</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-amber-500/10 rounded-xl p-4">
          <p className="text-sm text-amber-400 mb-1">Pending</p>
          <p className="text-xl font-semibold text-white">
            ${formatAmount(pending)}
          </p>
        </div>
        <div className="bg-emerald-500/10 rounded-xl p-4">
          <p className="text-sm text-emerald-400 mb-1">Confirmed</p>
          <p className="text-xl font-semibold text-white">
            ${formatAmount(confirmed)}
          </p>
        </div>
      </div>

      <div className="h-40 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6b7280", fontSize: 12 }}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                color: "#fff",
              }}
              formatter={(value) => [`$${Number(value).toFixed(2)}`, "Earned"]}
            />
            <Area
              type="monotone"
              dataKey="earnings"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#earningsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {recentEarnings.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-3">Recent earnings by poll</h4>
          <div className="space-y-2">
            {recentEarnings.map((earning) => (
              <div
                key={earning.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-800/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{earning.pollTitle || "Poll response"}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(earning.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`text-sm font-medium ${
                    earning.status === "pending" ? "text-amber-400" : "text-emerald-400"
                  }`}
                >
                  ${parseFloat(earning.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Agent Profile Card ============

function AgentProfileCard({
  categories,
  eligiblePolls,
  lastUpdated,
}: {
  categories: string[];
  eligiblePolls: number;
  lastUpdated?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Your Agent&apos;s Profile</h3>
        <Link
          href="/profile"
          className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Edit
        </Link>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-500 mb-2">Verified attributes</p>
        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <span
                key={cat}
                className="px-3 py-1 rounded-full text-sm bg-gray-800 text-gray-300 border border-gray-700"
              >
                {cat}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600 italic">No verified attributes yet</p>
        )}
      </div>

      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
        <p className="text-emerald-400 font-medium">
          Eligible for {eligiblePolls} active poll{eligiblePolls !== 1 ? "s" : ""}
        </p>
      </div>

      {lastUpdated && (
        <p className="text-xs text-gray-600">
          Profile last updated: {new Date(lastUpdated).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

// ============ Your Polls (Creator) ============

function YourPollsCard({
  polls,
  isLoading,
}: {
  polls: Poll[];
  isLoading: boolean;
}) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "active":
        return { label: "Active", color: "text-emerald-400 bg-emerald-500/10" };
      case "closed":
        return { label: "Closed", color: "text-gray-400 bg-gray-700/50" };
      case "distributed":
        return { label: "Distributed", color: "text-blue-400 bg-blue-500/10" };
      default:
        return { label: status, color: "text-gray-400 bg-gray-700/50" };
    }
  };

  if (isLoading) {
    return <YourPollsSkeleton />;
  }

  if (polls.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Your Polls</h3>
        <div className="text-center py-6">
          <p className="text-gray-500 mb-4">You haven&apos;t created any polls yet</p>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Poll
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Your Polls</h3>
        <Link
          href="/create"
          className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Create new
        </Link>
      </div>

      <div className="space-y-4">
        {polls.slice(0, 5).map((poll) => {
          const statusConfig = getStatusConfig(poll.status);
          const progress =
            poll.participantCap > 0
              ? Math.round((poll.participantCount / poll.participantCap) * 100)
              : 0;

          return (
            <Link
              key={poll.id}
              href={`/polls/${poll.id}`}
              className="block p-4 rounded-xl bg-gray-800/30 hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <p className="font-medium text-white truncate flex-1 mr-2">
                  {poll.title}
                </p>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}
                >
                  {statusConfig.label}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                <span>{poll.participantCount} / {poll.participantCap} responses</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-emerald-500 rounded-full h-1.5 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ============ Wallet Section ============

function WalletSection({
  balance,
  walletAddress,
}: {
  balance: string;
  walletAddress?: string;
}) {
  const [minting, setMinting] = useState(false);

  const handleMintTestUSDC = async () => {
    setMinting(true);
    // Simulate mint - in real implementation this would call a faucet
    setTimeout(() => {
      setMinting(false);
    }, 2000);
  };

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  // Format balance safely - handle NaN and invalid values
  const formatBalance = (value: string) => {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return "0.00";
    return parsed.toFixed(2);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-white mb-6">Wallet</h3>

      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">Total Earnings (USDC)</p>
        <p className="text-3xl font-bold text-white">
          ${formatBalance(balance)}
        </p>
      </div>

      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-3">Recent payouts</p>
        <div className="text-center py-4 text-gray-500 text-sm">
          No payouts yet. Complete polls to earn USDC!
        </div>
      </div>

      <button
        onClick={handleMintTestUSDC}
        disabled={minting}
        className="w-full py-3 rounded-xl bg-gray-800 text-white font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {minting ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Minting...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Mint Test USDC
          </>
        )}
      </button>

      <p className="text-xs text-gray-600 text-center mt-2">
        Testnet only - Base Sepolia faucet
      </p>
    </div>
  );
}

// ============ Main Page Component ============

export default function DashboardPage() {
  const { summary, activity, isLoading, error, refetch } = useDashboard();
  const { polls: creatorPolls, isLoading: pollsLoading } = usePolls({ isCreator: true });
  const { preferences } = useAgentPreferences();
  const { profile, isLoading: profileLoading } = useProfile();
  const { earnings, summary: earningsSummary, isLoading: earningsLoading } = useEarnings();

  // Show loading state
  if (isLoading && !summary) {
    return <DashboardSkeleton />;
  }

  // Show error state
  if (error && !summary) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  // Use default values if summary is null
  const dashboardSummary: DashboardSummary = summary || {
    totalEarnings: "0",
    pendingEarnings: "0",
    activePolls: 0,
    completedPolls: 0,
    totalResponses: 0,
    averageConfidence: 0,
    weeklyChange: { earnings: 0, polls: 0 },
  };

  // Derive agent status from activity
  const isAgentConnected = preferences?.enabled ?? false;
  const lastActivity = activity[0];
  const lastAction = lastActivity
    ? {
        action: lastActivity.type === "agent_response" || lastActivity.type === "poll_completed"
          ? "Responded to"
          : lastActivity.type === "payment_received"
          ? "Received payment for"
          : "Interacted with",
        pollTitle: lastActivity.pollTitle || lastActivity.title,
        timeAgo: formatTimeAgo(lastActivity.timestamp),
      }
    : undefined;

  function formatTimeAgo(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  // Calculate today's stats from activity
  const today = new Date().toISOString().split("T")[0];
  const todayActivity = activity.filter((a) =>
    a.timestamp.startsWith(today) && (a.type === "poll_completed" || a.type === "agent_response")
  );
  const pollsToday = todayActivity.length;
  const earnedToday = todayActivity
    .reduce((sum, a) => sum + parseFloat(a.amount || "0"), 0)
    .toFixed(2);

  return (
    <RequireWallet
      title="Connect to View Dashboard"
      description="Connect your wallet to view your agent's activity and earnings."
    >
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Mission Control</h1>
          <p className="text-gray-400">
            Observe your agent&apos;s activity and track earnings in real-time
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Primary Focus */}
          <div className="lg:col-span-2 space-y-6">
            {/* Agent Status Card */}
            <AgentStatusCard
              isConnected={isAgentConnected}
              lastAction={lastAction}
              pollsToday={pollsToday}
              earnedToday={earnedToday}
              walletAddress={profile?.walletAddress}
            />

            {/* Activity Log - Primary Focus */}
            <ActivityLog activity={activity} />
          </div>

          {/* Right Column - Secondary Info */}
          <div className="space-y-6">
            {/* Earnings Dashboard */}
            {earningsLoading ? (
              <EarningsDashboardSkeleton />
            ) : (
              <EarningsDashboard
                totalLifetime={dashboardSummary.totalEarnings}
                pending={dashboardSummary.pendingEarnings}
                confirmed={String(earningsSummary.paid)}
                earnings={earnings}
              />
            )}

            {/* Agent Profile */}
            {profileLoading ? (
              <AgentProfileSkeleton />
            ) : (
              <AgentProfileCard
                categories={preferences?.categories || []}
                eligiblePolls={dashboardSummary.activePolls}
                lastUpdated={profile?.updatedAt}
              />
            )}

            {/* Your Polls (if creator) */}
            <YourPollsCard polls={creatorPolls} isLoading={pollsLoading} />

            {/* Wallet Section */}
            <WalletSection
              balance={dashboardSummary.totalEarnings}
              walletAddress={profile?.walletAddress}
            />
          </div>
        </div>
      </div>
    </div>
    </RequireWallet>
  );
}
