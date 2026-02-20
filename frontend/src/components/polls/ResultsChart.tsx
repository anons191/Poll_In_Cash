"use client";

/**
 * ResultsChart Component
 * Bar and pie chart components for visualizing poll responses
 * Uses recharts library
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card } from "../ui/Card";

// ============ Types ============

interface ChartDataPoint {
  name: string;
  value: number;
  percentage?: number;
}

interface ResultsBarChartProps {
  /** Chart data */
  data: ChartDataPoint[];
  /** Chart title */
  title?: string;
  /** Whether to show percentages */
  showPercentages?: boolean;
  /** Bar color */
  color?: string;
  /** Chart height */
  height?: number;
  /** Additional className */
  className?: string;
}

interface ResultsPieChartProps {
  /** Chart data */
  data: ChartDataPoint[];
  /** Chart title */
  title?: string;
  /** Chart height */
  height?: number;
  /** Whether to show legend */
  showLegend?: boolean;
  /** Additional className */
  className?: string;
}

// ============ Colors ============

const CHART_COLORS = [
  "#1B4D7A", // Primary blue
  "#14B8A6", // Teal
  "#22C55E", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#6366F1", // Indigo
];

// ============ Bar Chart ============

export function ResultsBarChart({
  data,
  title,
  showPercentages = true,
  color = "#1B4D7A",
  height = 300,
  className = "",
}: ResultsBarChartProps) {
  // Calculate total for percentages
  const total = data.reduce((sum, d) => sum + d.value, 0);

  // Add percentages to data
  const dataWithPercentages = data.map((d) => ({
    ...d,
    percentage: total > 0 ? (d.value / total) * 100 : 0,
  }));

  return (
    <Card className={className} padding="md">
      {title && (
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={dataWithPercentages}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={true}
            vertical={false}
            stroke="#E5E7EB"
          />
          <XAxis
            type="number"
            tick={{ fill: "#6B7280", fontSize: 12 }}
            axisLine={{ stroke: "#E5E7EB" }}
          />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fill: "#374151", fontSize: 12 }}
            axisLine={{ stroke: "#E5E7EB" }}
            width={100}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {data.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {data.value} responses
                      {showPercentages && ` (${data.percentage.toFixed(1)}%)`}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar
            dataKey="value"
            fill={color}
            radius={[0, 4, 4, 0]}
            barSize={24}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Legend with values */}
      <div className="mt-4 space-y-2">
        {dataWithPercentages.map((item, index) => (
          <div
            key={item.name}
            className="flex items-center justify-between text-sm"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: color }}
              />
              <span className="text-gray-700 dark:text-gray-300">
                {item.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-white">
                {item.value}
              </span>
              {showPercentages && (
                <span className="text-gray-500 dark:text-gray-400">
                  ({item.percentage.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============ Pie Chart ============

export function ResultsPieChart({
  data,
  title,
  height = 300,
  showLegend = true,
  className = "",
}: ResultsPieChartProps) {
  // Calculate total for percentages
  const total = data.reduce((sum, d) => sum + d.value, 0);

  // Add percentages to data
  const dataWithPercentages = data.map((d) => ({
    ...d,
    percentage: total > 0 ? (d.value / total) * 100 : 0,
  }));

  return (
    <Card className={className} padding="md">
      {title && (
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={dataWithPercentages}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {dataWithPercentages.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {data.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {data.value} responses ({data.percentage.toFixed(1)}%)
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Custom Legend */}
      {showLegend && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {dataWithPercentages.map((item, index) => (
            <div key={item.name} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
              <span className="text-gray-700 dark:text-gray-300 truncate">
                {item.name}
              </span>
              <span className="text-gray-500 dark:text-gray-400 ml-auto">
                {item.percentage.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ============ Rating Distribution Chart ============

interface RatingDistributionProps {
  /** Rating data (index 0 = rating 1, etc.) */
  ratings: number[];
  /** Minimum rating value */
  minRating?: number;
  /** Maximum rating value */
  maxRating?: number;
  /** Chart title */
  title?: string;
  /** Additional className */
  className?: string;
}

export function RatingDistributionChart({
  ratings,
  minRating = 1,
  maxRating = 5,
  title = "Rating Distribution",
  className = "",
}: RatingDistributionProps) {
  // Convert ratings array to chart data
  const data = ratings.map((count, index) => ({
    name: `${minRating + index}`,
    value: count,
    label: `${minRating + index} Star${minRating + index !== 1 ? "s" : ""}`,
  }));

  // Calculate average rating
  const total = ratings.reduce((sum, count) => sum + count, 0);
  const weightedSum = ratings.reduce(
    (sum, count, index) => sum + count * (minRating + index),
    0
  );
  const average = total > 0 ? weightedSum / total : 0;

  return (
    <Card className={className} padding="md">
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <div className="flex items-center gap-1">
            <svg
              className="w-5 h-5 text-yellow-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {average.toFixed(1)}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              / {maxRating}
            </span>
          </div>
        </div>
      )}

      {/* Horizontal bar distribution */}
      <div className="space-y-2">
        {data.reverse().map((item, index) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div key={item.name} className="flex items-center gap-2">
              <span className="w-8 text-sm text-gray-600 dark:text-gray-400">
                {item.name}
              </span>
              <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-12 text-sm text-right text-gray-600 dark:text-gray-400">
                {item.value}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
        Based on {total} response{total !== 1 ? "s" : ""}
      </p>
    </Card>
  );
}

export default ResultsBarChart;
