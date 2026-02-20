"use client";

/**
 * PollCard Component
 * Compact poll preview card (title, payout amount, status badge, time remaining)
 */

import { useMemo } from "react";
import { Card } from "../ui/Card";
import { StatusBadge } from "../ui/Badge";

// ============ Types ============

type PollStatus = "active" | "closed" | "draft" | "pending" | "completed";

interface PollCardProps {
  /** Poll ID */
  id: string;
  /** Poll title */
  title: string;
  /** Poll description (optional, truncated) */
  description?: string;
  /** Current status */
  status: PollStatus;
  /** Total payout amount in USDC */
  payoutAmount: number;
  /** Payout per participant */
  payoutPerPerson?: number;
  /** End timestamp */
  endTime?: Date | string;
  /** Total participants allowed */
  participantCap?: number;
  /** Current participant count */
  participantCount?: number;
  /** Whether the user has responded */
  hasResponded?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Additional className */
  className?: string;
}

// ============ Helper Functions ============

function formatTimeRemaining(endTime: Date | string): string {
  const end = typeof endTime === "string" ? new Date(endTime) : endTime;
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) return "Ended";

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h left`;
  if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m left`;
  return `${diffMins}m left`;
}

// ============ Component ============

export function PollCard({
  id,
  title,
  description,
  status,
  payoutAmount,
  payoutPerPerson,
  endTime,
  participantCap,
  participantCount,
  hasResponded = false,
  onClick,
  className = "",
}: PollCardProps) {
  const timeRemaining = useMemo(() => {
    if (!endTime) return null;
    return formatTimeRemaining(endTime);
  }, [endTime]);

  const participantProgress = useMemo(() => {
    if (participantCap === undefined || participantCount === undefined) return null;
    return (participantCount / participantCap) * 100;
  }, [participantCap, participantCount]);

  const isActive = status === "active";
  const canRespond = isActive && !hasResponded;

  return (
    <Card
      className={className}
      hoverable={!!onClick}
      onClick={onClick}
      padding="md"
    >
      {/* Header with status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2">
          {title}
        </h3>
        <StatusBadge status={status} />
      </div>

      {/* Description */}
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
          {description}
        </p>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-between gap-4 mb-3">
        {/* Payout */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {payoutPerPerson !== undefined ? "Per Response" : "Total Pool"}
          </p>
          <p className="text-lg font-bold text-[#22C55E]">
            ${(payoutPerPerson ?? payoutAmount).toFixed(2)}
            <span className="text-xs font-normal text-gray-400 ml-1">USDC</span>
          </p>
        </div>

        {/* Time remaining */}
        {timeRemaining && (
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">Time Left</p>
            <p
              className={`text-sm font-medium ${
                timeRemaining === "Ended"
                  ? "text-gray-400"
                  : "text-gray-900 dark:text-white"
              }`}
            >
              {timeRemaining}
            </p>
          </div>
        )}
      </div>

      {/* Participant progress */}
      {participantProgress !== null && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500 dark:text-gray-400">Responses</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {participantCount}/{participantCap}
            </span>
          </div>
          <div className="h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#14B8A6] rounded-full transition-all duration-300"
              style={{ width: `${Math.min(participantProgress, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Responded indicator */}
      {hasResponded && (
        <div className="flex items-center gap-1.5 text-xs text-[#22C55E]">
          <svg
            className="w-3.5 h-3.5"
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
          You have responded
        </div>
      )}

      {/* Call to action for active polls */}
      {canRespond && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Eligible to respond
          </span>
          <span className="text-xs font-medium text-[#1B4D7A] dark:text-[#14B8A6]">
            Take poll
            <svg
              className="w-3 h-3 ml-1 inline"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </span>
        </div>
      )}
    </Card>
  );
}

// ============ Compact List Variant ============

interface PollListItemProps {
  id: string;
  title: string;
  status: PollStatus;
  payoutAmount: number;
  endTime?: Date | string;
  onClick?: () => void;
  className?: string;
}

export function PollListItem({
  id,
  title,
  status,
  payoutAmount,
  endTime,
  onClick,
  className = "",
}: PollListItemProps) {
  const timeRemaining = useMemo(() => {
    if (!endTime) return null;
    return formatTimeRemaining(endTime);
  }, [endTime]);

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
        onClick
          ? "hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
          : ""
      } ${className}`}
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
      <div className="flex-1 min-w-0 mr-4">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {title}
        </p>
        {timeRemaining && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {timeRemaining}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-[#22C55E]">
          ${payoutAmount.toFixed(2)}
        </span>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

export default PollCard;
