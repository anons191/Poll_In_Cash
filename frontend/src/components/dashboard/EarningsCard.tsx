"use client";

/**
 * EarningsCard Component
 * Displays total earned amount with optional sparkline trend indicator
 */

import { useMemo } from "react";
import { Card } from "../ui/Card";

interface EarningsCardProps {
  /** Total earnings amount in USDC */
  totalEarnings: number;
  /** Previous period earnings for comparison */
  previousEarnings?: number;
  /** Earnings history for sparkline (last 7 data points recommended) */
  earningsHistory?: number[];
  /** Currency symbol */
  currency?: string;
  /** Period label (e.g., "This Month", "All Time") */
  periodLabel?: string;
  /** Additional className */
  className?: string;
}

export function EarningsCard({
  totalEarnings,
  previousEarnings,
  earningsHistory = [],
  currency = "USDC",
  periodLabel = "Total Earnings",
  className = "",
}: EarningsCardProps) {
  // Calculate percentage change
  const percentageChange = useMemo(() => {
    if (!previousEarnings || previousEarnings === 0) return null;
    return ((totalEarnings - previousEarnings) / previousEarnings) * 100;
  }, [totalEarnings, previousEarnings]);

  // Normalize sparkline data for SVG
  const sparklineData = useMemo(() => {
    if (earningsHistory.length < 2) return null;
    const max = Math.max(...earningsHistory);
    const min = Math.min(...earningsHistory);
    const range = max - min || 1;
    return earningsHistory.map((value) => ((value - min) / range) * 100);
  }, [earningsHistory]);

  const isPositive = percentageChange && percentageChange > 0;
  const isNegative = percentageChange && percentageChange < 0;

  return (
    <Card className={className} padding="lg">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {periodLabel}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              ${totalEarnings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {currency}
            </span>
          </div>

          {/* Percentage change indicator */}
          {percentageChange !== null && (
            <div className="mt-2 flex items-center gap-1">
              {isPositive && (
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
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                  />
                </svg>
              )}
              {isNegative && (
                <svg
                  className="w-4 h-4 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              )}
              <span
                className={`text-sm font-medium ${
                  isPositive
                    ? "text-[#22C55E]"
                    : isNegative
                    ? "text-red-500"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {percentageChange > 0 ? "+" : ""}
                {percentageChange.toFixed(1)}%
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                vs previous
              </span>
            </div>
          )}
        </div>

        {/* Icon */}
        <div className="p-3 bg-[#22C55E]/10 rounded-xl">
          <svg
            className="w-6 h-6 text-[#22C55E]"
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
      </div>

      {/* Sparkline */}
      {sparklineData && sparklineData.length > 1 && (
        <div className="mt-4 h-12">
          <Sparkline data={sparklineData} isPositive={!isNegative} />
        </div>
      )}
    </Card>
  );
}

// ============ Sparkline Component ============

interface SparklineProps {
  data: number[];
  isPositive?: boolean;
}

function Sparkline({ data, isPositive = true }: SparklineProps) {
  const width = 200;
  const height = 48;
  const padding = 4;

  const points = data
    .map((value, index) => {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - (value / 100) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `${padding},${height - padding} ${points} ${
    width - padding
  },${height - padding}`;

  const color = isPositive ? "#22C55E" : "#EF4444";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      {/* Gradient fill */}
      <defs>
        <linearGradient id={`sparkline-gradient-${isPositive}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <polygon
        points={areaPoints}
        fill={`url(#sparkline-gradient-${isPositive})`}
      />

      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default EarningsCard;
