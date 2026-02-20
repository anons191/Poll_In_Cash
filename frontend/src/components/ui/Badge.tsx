"use client";

/**
 * Badge Component
 * For verified attributes, poll status (active, closed, draft, etc.)
 */

import { ReactNode } from "react";

type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";
type BadgeSize = "sm" | "md" | "lg";

interface BadgeProps {
  /** Badge content */
  children: ReactNode;
  /** Badge variant */
  variant?: BadgeVariant;
  /** Badge size */
  size?: BadgeSize;
  /** Optional icon */
  icon?: ReactNode;
  /** Whether to show a dot indicator */
  dot?: boolean;
  /** Dot color (only when dot is true) */
  dotColor?: "green" | "yellow" | "red" | "blue" | "gray";
  /** Additional className */
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  primary:
    "bg-[#1B4D7A]/10 text-[#1B4D7A] dark:bg-[#1B4D7A]/20 dark:text-[#5A9BD4]",
  success:
    "bg-[#22C55E]/10 text-[#16A34A] dark:bg-[#22C55E]/20 dark:text-[#22C55E]",
  warning:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500",
  danger:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  info:
    "bg-[#14B8A6]/10 text-[#0D9488] dark:bg-[#14B8A6]/20 dark:text-[#14B8A6]",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
};

const dotColors: Record<string, string> = {
  green: "bg-[#22C55E]",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
  blue: "bg-[#1B4D7A]",
  gray: "bg-gray-400",
};

export function Badge({
  children,
  variant = "default",
  size = "md",
  icon,
  dot = false,
  dotColor = "gray",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${dotColors[dotColor]}`}
        />
      )}
      {icon && <span className="w-3 h-3">{icon}</span>}
      {children}
    </span>
  );
}

// ============ Status Badge Presets ============

type PollStatus = "active" | "closed" | "draft" | "pending" | "completed";

interface StatusBadgeProps {
  status: PollStatus;
  className?: string;
}

const statusConfig: Record<
  PollStatus,
  { variant: BadgeVariant; label: string; dotColor: "green" | "yellow" | "red" | "blue" | "gray" }
> = {
  active: { variant: "success", label: "Active", dotColor: "green" },
  closed: { variant: "default", label: "Closed", dotColor: "gray" },
  draft: { variant: "warning", label: "Draft", dotColor: "yellow" },
  pending: { variant: "info", label: "Pending", dotColor: "blue" },
  completed: { variant: "primary", label: "Completed", dotColor: "blue" },
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge
      variant={config.variant}
      dot
      dotColor={config.dotColor}
      className={className}
    >
      {config.label}
    </Badge>
  );
}

// ============ Verified Badge ============

interface VerifiedBadgeProps {
  label: string;
  verified?: boolean;
  className?: string;
}

export function VerifiedBadge({
  label,
  verified = true,
  className = "",
}: VerifiedBadgeProps) {
  return (
    <Badge
      variant={verified ? "success" : "default"}
      icon={
        verified ? (
          <svg
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ) : undefined
      }
      className={className}
    >
      {label}
    </Badge>
  );
}

// ============ Confidence Badge ============

type ConfidenceLevel = "high" | "medium" | "low";

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  className?: string;
}

const confidenceConfig: Record<
  ConfidenceLevel,
  { variant: BadgeVariant; label: string }
> = {
  high: { variant: "success", label: "High Confidence" },
  medium: { variant: "warning", label: "Medium Confidence" },
  low: { variant: "danger", label: "Low Confidence" },
};

export function ConfidenceBadge({ level, className = "" }: ConfidenceBadgeProps) {
  const config = confidenceConfig[level];
  return (
    <Badge variant={config.variant} size="sm" className={className}>
      {config.label}
    </Badge>
  );
}

export default Badge;
