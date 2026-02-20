/**
 * Utility Functions
 * Common helper functions for Poll in Cash frontend
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CONFIDENCE_THRESHOLDS, CONFIDENCE_COLORS, USDC_DECIMALS } from "./constants";

// ============ Class Name Utilities ============

/**
 * Merge class names with Tailwind CSS support
 * Combines clsx for conditional classes with tailwind-merge for deduplication
 *
 * @param classes - Class values to merge
 * @returns Merged class string
 *
 * @example
 * cn("px-4 py-2", isActive && "bg-blue-500", "px-6")
 * // Returns "py-2 px-6 bg-blue-500" (px-6 overrides px-4)
 */
export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes));
}

// ============ Currency Formatting ============

/**
 * Format USDC amount for display
 * Handles both string and number inputs, assumes 6 decimal places
 *
 * @param amount - Amount in smallest units (6 decimals) or as a decimal string
 * @param showSymbol - Whether to include the $ symbol (default: true)
 * @returns Formatted string like "$1,234.56"
 *
 * @example
 * formatUSDC(1234560000) // "$1,234.56"
 * formatUSDC("1234.56") // "$1,234.56"
 * formatUSDC(1000000, false) // "1.00"
 */
export function formatUSDC(amount: string | number, showSymbol: boolean = true): string {
  let value: number;

  if (typeof amount === "string") {
    // Check if it's a decimal string or a raw unit string
    if (amount.includes(".")) {
      value = parseFloat(amount);
    } else {
      // Assume it's in smallest units (6 decimals)
      value = parseInt(amount, 10) / Math.pow(10, USDC_DECIMALS);
    }
  } else {
    // If it's a large number, assume it's in smallest units
    if (amount > 1000000) {
      value = amount / Math.pow(10, USDC_DECIMALS);
    } else {
      value = amount;
    }
  }

  if (isNaN(value)) {
    return showSymbol ? "$0.00" : "0.00";
  }

  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return showSymbol ? `$${formatted}` : formatted;
}

/**
 * Parse USDC amount from user input to smallest units
 *
 * @param amount - User input like "10.50"
 * @returns BigInt in smallest units (6 decimals)
 */
export function parseUSDC(amount: string): bigint {
  const value = parseFloat(amount);
  if (isNaN(value) || value < 0) {
    throw new Error("Invalid USDC amount");
  }
  return BigInt(Math.round(value * Math.pow(10, USDC_DECIMALS)));
}

// ============ Address Formatting ============

/**
 * Truncate an Ethereum address for display
 *
 * @param address - Full wallet address
 * @param startChars - Number of characters to show at start (default: 6)
 * @param endChars - Number of characters to show at end (default: 4)
 * @returns Truncated address like "0x1234...5678"
 *
 * @example
 * truncateAddress("0x1234567890abcdef1234567890abcdef12345678")
 * // "0x1234...5678"
 */
export function truncateAddress(
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string {
  if (!address) return "";
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

// ============ Time Formatting ============

/**
 * Format a date as a relative time string
 *
 * @param date - Date object or ISO string
 * @returns Relative time like "2 hours ago", "3 days ago", "just now"
 *
 * @example
 * timeAgo(new Date(Date.now() - 3600000)) // "1 hour ago"
 * timeAgo("2024-01-01T00:00:00Z") // "3 months ago"
 */
export function timeAgo(date: Date | string): string {
  const now = new Date();
  const past = date instanceof Date ? date : new Date(date);
  const diffMs = now.getTime() - past.getTime();

  // Handle future dates
  if (diffMs < 0) {
    return "in the future";
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) {
    return "just now";
  }

  if (diffMinutes < 60) {
    return diffMinutes === 1 ? "1 minute ago" : `${diffMinutes} minutes ago`;
  }

  if (diffHours < 24) {
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
  }

  if (diffDays < 7) {
    return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
  }

  if (diffWeeks < 4) {
    return diffWeeks === 1 ? "1 week ago" : `${diffWeeks} weeks ago`;
  }

  if (diffMonths < 12) {
    return diffMonths === 1 ? "1 month ago" : `${diffMonths} months ago`;
  }

  return diffYears === 1 ? "1 year ago" : `${diffYears} years ago`;
}

/**
 * Format a date for display
 *
 * @param date - Date object or ISO string
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }
): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("en-US", options);
}

/**
 * Format a date with time
 *
 * @param date - Date object or ISO string
 * @returns Formatted string like "Jan 1, 2024 at 2:30 PM"
 */
export function formatDateTime(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ============ Confidence Score Formatting ============

/**
 * Format a confidence score into a label and color scheme
 *
 * @param score - Confidence score between 0 and 1
 * @returns Object with label and color classes
 *
 * @example
 * formatConfidence(0.95) // { label: "high", color: { bg: "bg-green-100", ... } }
 * formatConfidence(0.6) // { label: "medium", color: { bg: "bg-yellow-100", ... } }
 */
export function formatConfidence(score: number): {
  label: "high" | "medium" | "low";
  color: (typeof CONFIDENCE_COLORS)[keyof typeof CONFIDENCE_COLORS];
} {
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) {
    return { label: "high", color: CONFIDENCE_COLORS.high };
  }
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return { label: "medium", color: CONFIDENCE_COLORS.medium };
  }
  return { label: "low", color: CONFIDENCE_COLORS.low };
}

/**
 * Format confidence score as percentage
 *
 * @param score - Confidence score between 0 and 1
 * @returns Percentage string like "95%"
 */
export function formatConfidencePercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

// ============ Validation Helpers ============

/**
 * Check if a string is a valid Ethereum address
 *
 * @param address - String to validate
 * @returns True if valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Check if a string is a valid poll ID
 *
 * @param id - String to validate
 * @returns True if valid
 */
export function isValidPollId(id: string): boolean {
  return /^[a-zA-Z0-9-_]+$/.test(id);
}

// ============ Number Formatting ============

/**
 * Format a large number with K/M/B suffixes
 *
 * @param num - Number to format
 * @returns Formatted string like "1.2K", "3.5M"
 */
export function formatCompactNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Format a number as percentage
 *
 * @param value - Number to format (0-1 or 0-100)
 * @param decimals - Number of decimal places
 * @returns Percentage string
 */
export function formatPercent(value: number, decimals: number = 0): string {
  // Assume values > 1 are already percentages
  const pct = value > 1 ? value : value * 100;
  return `${pct.toFixed(decimals)}%`;
}

// ============ String Utilities ============

/**
 * Capitalize the first letter of a string
 *
 * @param str - String to capitalize
 * @returns Capitalized string
 */
export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Pluralize a word based on count
 *
 * @param count - Number to check
 * @param singular - Singular form of word
 * @param plural - Plural form (defaults to singular + "s")
 * @returns Appropriate form of word
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural || `${singular}s`);
}
