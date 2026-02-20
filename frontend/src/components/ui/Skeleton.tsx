"use client";

/**
 * Skeleton Component
 * Loading skeletons for cards, text, avatars
 */

interface SkeletonProps {
  /** Width of the skeleton */
  width?: string | number;
  /** Height of the skeleton */
  height?: string | number;
  /** Whether to use rounded corners */
  rounded?: "none" | "sm" | "md" | "lg" | "full";
  /** Additional className */
  className?: string;
}

const roundedStyles = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
};

export function Skeleton({
  width,
  height,
  rounded = "md",
  className = "",
}: SkeletonProps) {
  const style: React.CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };

  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-800 ${roundedStyles[rounded]} ${className}`}
      style={style}
    />
  );
}

// ============ Text Skeleton ============

interface TextSkeletonProps {
  /** Number of lines */
  lines?: number;
  /** Whether to show a shorter last line */
  shorterLastLine?: boolean;
  /** Gap between lines */
  gap?: "sm" | "md" | "lg";
  /** Additional className */
  className?: string;
}

const gapStyles = {
  sm: "gap-1.5",
  md: "gap-2",
  lg: "gap-3",
};

export function TextSkeleton({
  lines = 3,
  shorterLastLine = true,
  gap = "md",
  className = "",
}: TextSkeletonProps) {
  return (
    <div className={`flex flex-col ${gapStyles[gap]} ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={16}
          width={
            shorterLastLine && index === lines - 1 ? "60%" : "100%"
          }
          rounded="sm"
        />
      ))}
    </div>
  );
}

// ============ Avatar Skeleton ============

interface AvatarSkeletonProps {
  /** Size of the avatar */
  size?: "sm" | "md" | "lg" | "xl";
  /** Additional className */
  className?: string;
}

const avatarSizes = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
};

export function AvatarSkeleton({ size = "md", className = "" }: AvatarSkeletonProps) {
  return (
    <Skeleton
      className={`${avatarSizes[size]} ${className}`}
      rounded="full"
    />
  );
}

// ============ Card Skeleton ============

interface CardSkeletonProps {
  /** Whether to show header */
  showHeader?: boolean;
  /** Whether to show footer */
  showFooter?: boolean;
  /** Number of content lines */
  contentLines?: number;
  /** Additional className */
  className?: string;
}

export function CardSkeleton({
  showHeader = true,
  showFooter = false,
  contentLines = 3,
  className = "",
}: CardSkeletonProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden ${className}`}
    >
      {showHeader && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AvatarSkeleton size="md" />
              <div className="flex flex-col gap-2">
                <Skeleton width={120} height={14} rounded="sm" />
                <Skeleton width={80} height={12} rounded="sm" />
              </div>
            </div>
            <Skeleton width={60} height={24} rounded="full" />
          </div>
        </div>
      )}
      <div className="p-4">
        <TextSkeleton lines={contentLines} />
      </div>
      {showFooter && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <Skeleton width={100} height={14} rounded="sm" />
            <Skeleton width={80} height={32} rounded="lg" />
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Table Row Skeleton ============

interface TableRowSkeletonProps {
  /** Number of columns */
  columns?: number;
  /** Additional className */
  className?: string;
}

export function TableRowSkeleton({
  columns = 4,
  className = "",
}: TableRowSkeletonProps) {
  return (
    <tr className={className}>
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="px-4 py-3">
          <Skeleton
            height={16}
            width={index === 0 ? "80%" : "60%"}
            rounded="sm"
          />
        </td>
      ))}
    </tr>
  );
}

// ============ Stats Card Skeleton ============

export function StatsCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <Skeleton width={100} height={14} rounded="sm" />
        <Skeleton width={24} height={24} rounded="md" />
      </div>
      <Skeleton width={80} height={28} rounded="sm" className="mb-2" />
      <Skeleton width={60} height={12} rounded="sm" />
    </div>
  );
}

// ============ List Item Skeleton ============

export function ListItemSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 p-3 ${className}`}>
      <AvatarSkeleton size="md" />
      <div className="flex-1">
        <Skeleton width="70%" height={14} rounded="sm" className="mb-2" />
        <Skeleton width="40%" height={12} rounded="sm" />
      </div>
      <Skeleton width={60} height={24} rounded="full" />
    </div>
  );
}

export default Skeleton;
