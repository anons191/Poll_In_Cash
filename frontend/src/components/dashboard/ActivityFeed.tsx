"use client";

/**
 * ActivityFeed Component
 * Scrollable list of recent events (responses, payouts) with timestamps
 */

import { useMemo } from "react";
import { Badge } from "../ui/Badge";

// ============ Types ============

type ActivityType = "response" | "payout" | "poll_created" | "poll_closed" | "verification";

interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  amount?: number;
  timestamp: Date | string;
  pollTitle?: string;
  txHash?: string;
}

interface ActivityFeedProps {
  /** List of activities */
  activities: Activity[];
  /** Maximum height before scrolling */
  maxHeight?: string;
  /** Whether to show empty state */
  showEmptyState?: boolean;
  /** Additional className */
  className?: string;
  /** Click handler for activity items */
  onActivityClick?: (activity: Activity) => void;
}

// ============ Activity Icons ============

const activityIcons: Record<ActivityType, { icon: React.ReactNode; bg: string }> = {
  response: {
    bg: "bg-[#1B4D7A]/10",
    icon: (
      <svg
        className="w-4 h-4 text-[#1B4D7A]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  payout: {
    bg: "bg-[#22C55E]/10",
    icon: (
      <svg
        className="w-4 h-4 text-[#22C55E]"
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
    ),
  },
  poll_created: {
    bg: "bg-[#14B8A6]/10",
    icon: (
      <svg
        className="w-4 h-4 text-[#14B8A6]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
        />
      </svg>
    ),
  },
  poll_closed: {
    bg: "bg-gray-100 dark:bg-gray-800",
    icon: (
      <svg
        className="w-4 h-4 text-gray-500"
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
    ),
  },
  verification: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    icon: (
      <svg
        className="w-4 h-4 text-yellow-600 dark:text-yellow-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
  },
};

// ============ Helper Functions ============

function formatTimestamp(timestamp: Date | string): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ============ Component ============

export function ActivityFeed({
  activities,
  maxHeight = "400px",
  showEmptyState = true,
  className = "",
  onActivityClick,
}: ActivityFeedProps) {
  const sortedActivities = useMemo(() => {
    return [...activities].sort((a, b) => {
      const dateA = typeof a.timestamp === "string" ? new Date(a.timestamp) : a.timestamp;
      const dateB = typeof b.timestamp === "string" ? new Date(b.timestamp) : b.timestamp;
      return dateB.getTime() - dateA.getTime();
    });
  }, [activities]);

  if (activities.length === 0 && showEmptyState) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No recent activity
        </p>
      </div>
    );
  }

  return (
    <div
      className={`overflow-y-auto ${className}`}
      style={{ maxHeight }}
    >
      <div className="space-y-1">
        {sortedActivities.map((activity) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            onClick={onActivityClick ? () => onActivityClick(activity) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ============ Activity Item ============

interface ActivityItemProps {
  activity: Activity;
  onClick?: () => void;
}

function ActivityItem({ activity, onClick }: ActivityItemProps) {
  const iconConfig = activityIcons[activity.type];

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
        onClick
          ? "hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
          : ""
      }`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {/* Icon */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${iconConfig.bg}`}
      >
        {iconConfig.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {activity.title}
            </p>
            {activity.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {activity.description}
              </p>
            )}
            {activity.pollTitle && (
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                {activity.pollTitle}
              </p>
            )}
          </div>

          {/* Amount or timestamp */}
          <div className="flex-shrink-0 text-right">
            {activity.amount !== undefined && (
              <Badge variant="success" size="sm">
                +${activity.amount.toFixed(2)}
              </Badge>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {formatTimestamp(activity.timestamp)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ActivityFeed;
