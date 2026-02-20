"use client";

/**
 * Card Component
 * Reusable card with header, body, footer slots
 * Features: shadow, rounded corners, dark mode support
 */

import { ReactNode } from "react";

interface CardProps {
  /** Card header content */
  header?: ReactNode;
  /** Card body content */
  children: ReactNode;
  /** Card footer content */
  footer?: ReactNode;
  /** Additional className for the card container */
  className?: string;
  /** Padding size */
  padding?: "none" | "sm" | "md" | "lg";
  /** Whether to show hover effect */
  hoverable?: boolean;
  /** Whether to add a subtle border */
  bordered?: boolean;
  /** Click handler */
  onClick?: () => void;
}

const paddingStyles = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export function Card({
  header,
  children,
  footer,
  className = "",
  padding = "md",
  hoverable = false,
  bordered = true,
  onClick,
}: CardProps) {
  const baseStyles =
    "bg-white dark:bg-gray-900 rounded-xl shadow-sm transition-all duration-200";
  const borderStyles = bordered
    ? "border border-gray-200 dark:border-gray-800"
    : "";
  const hoverStyles = hoverable
    ? "hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 cursor-pointer"
    : "";
  const clickableStyles = onClick ? "cursor-pointer" : "";

  return (
    <div
      className={`${baseStyles} ${borderStyles} ${hoverStyles} ${clickableStyles} ${className}`}
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
      {header && (
        <div
          className={`border-b border-gray-200 dark:border-gray-800 ${paddingStyles[padding]}`}
        >
          {header}
        </div>
      )}
      <div className={paddingStyles[padding]}>{children}</div>
      {footer && (
        <div
          className={`border-t border-gray-200 dark:border-gray-800 ${paddingStyles[padding]}`}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * Card Header component for consistent header styling
 */
interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({
  title,
  subtitle,
  action,
  className = "",
}: CardHeaderProps) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export default Card;
