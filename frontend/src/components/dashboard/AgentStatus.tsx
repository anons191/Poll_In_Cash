"use client";

/**
 * AgentStatus Component
 * Green/yellow/red dot indicator with status text and last active time
 */

import { useMemo } from "react";

// ============ Types ============

type AgentStatusType = "active" | "idle" | "offline" | "busy" | "error";

interface AgentStatusProps {
  /** Current status */
  status: AgentStatusType;
  /** Last active timestamp */
  lastActive?: Date | string;
  /** Custom status text (overrides default) */
  statusText?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Whether to show the pulsing animation */
  showPulse?: boolean;
  /** Additional className */
  className?: string;
}

// ============ Status Config ============

interface StatusConfig {
  color: string;
  pulseColor: string;
  label: string;
  description: string;
}

const statusConfig: Record<AgentStatusType, StatusConfig> = {
  active: {
    color: "bg-[#22C55E]",
    pulseColor: "bg-[#22C55E]/50",
    label: "Active",
    description: "Agent is running and ready",
  },
  idle: {
    color: "bg-yellow-500",
    pulseColor: "bg-yellow-500/50",
    label: "Idle",
    description: "Agent is waiting for polls",
  },
  offline: {
    color: "bg-gray-400",
    pulseColor: "bg-gray-400/50",
    label: "Offline",
    description: "Agent is not running",
  },
  busy: {
    color: "bg-[#1B4D7A]",
    pulseColor: "bg-[#1B4D7A]/50",
    label: "Busy",
    description: "Agent is processing a poll",
  },
  error: {
    color: "bg-red-500",
    pulseColor: "bg-red-500/50",
    label: "Error",
    description: "Agent encountered an error",
  },
};

// ============ Size Config ============

const sizeConfig = {
  sm: {
    dot: "w-2 h-2",
    pulse: "w-2 h-2",
    text: "text-xs",
    gap: "gap-1.5",
  },
  md: {
    dot: "w-2.5 h-2.5",
    pulse: "w-2.5 h-2.5",
    text: "text-sm",
    gap: "gap-2",
  },
  lg: {
    dot: "w-3 h-3",
    pulse: "w-3 h-3",
    text: "text-base",
    gap: "gap-2.5",
  },
};

// ============ Helper Functions ============

function formatLastActive(timestamp: Date | string): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ============ Component ============

export function AgentStatus({
  status,
  lastActive,
  statusText,
  size = "md",
  showPulse = true,
  className = "",
}: AgentStatusProps) {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];

  const formattedLastActive = useMemo(() => {
    if (!lastActive) return null;
    return formatLastActive(lastActive);
  }, [lastActive]);

  const shouldPulse = showPulse && (status === "active" || status === "busy");

  return (
    <div className={`flex items-center ${sizes.gap} ${className}`}>
      {/* Status dot with optional pulse */}
      <div className="relative flex items-center justify-center">
        {shouldPulse && (
          <span
            className={`absolute ${sizes.pulse} rounded-full ${config.pulseColor} animate-ping`}
          />
        )}
        <span
          className={`relative ${sizes.dot} rounded-full ${config.color}`}
        />
      </div>

      {/* Status text and last active */}
      <div className="flex flex-col">
        <span
          className={`font-medium text-gray-900 dark:text-white ${sizes.text}`}
        >
          {statusText || config.label}
        </span>
        {formattedLastActive && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Last active: {formattedLastActive}
          </span>
        )}
      </div>
    </div>
  );
}

// ============ Compact Variant ============

interface AgentStatusDotProps {
  status: AgentStatusType;
  showPulse?: boolean;
  className?: string;
}

export function AgentStatusDot({
  status,
  showPulse = true,
  className = "",
}: AgentStatusDotProps) {
  const config = statusConfig[status];
  const shouldPulse = showPulse && (status === "active" || status === "busy");

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      title={config.label}
    >
      {shouldPulse && (
        <span
          className={`absolute w-2.5 h-2.5 rounded-full ${config.pulseColor} animate-ping`}
        />
      )}
      <span className={`relative w-2.5 h-2.5 rounded-full ${config.color}`} />
    </div>
  );
}

// ============ Detailed Card Variant ============

interface AgentStatusCardProps {
  status: AgentStatusType;
  lastActive?: Date | string;
  agentName?: string;
  pollsCompleted?: number;
  className?: string;
}

export function AgentStatusCard({
  status,
  lastActive,
  agentName = "AI Agent",
  pollsCompleted,
  className = "",
}: AgentStatusCardProps) {
  const config = statusConfig[status];

  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Agent avatar */}
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1B4D7A] to-[#14B8A6] flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            {/* Status dot overlay */}
            <AgentStatusDot
              status={status}
              className="absolute -bottom-0.5 -right-0.5 border-2 border-white dark:border-gray-900 rounded-full"
            />
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              {agentName}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {config.description}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
          <AgentStatus status={status} size="sm" className="mt-1" />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Last Active</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
            {lastActive ? formatLastActive(lastActive) : "Never"}
          </p>
        </div>
        {pollsCompleted !== undefined && (
          <div className="col-span-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">Polls Completed</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
              {pollsCompleted}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AgentStatus;
