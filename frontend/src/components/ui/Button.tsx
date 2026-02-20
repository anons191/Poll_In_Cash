"use client";

/**
 * Button Component
 * Variants: primary, secondary, outline, ghost
 * States: loading, disabled
 * Sizes: sm, md, lg
 */

import { ButtonHTMLAttributes, ReactNode, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Loading state */
  loading?: boolean;
  /** Left icon */
  leftIcon?: ReactNode;
  /** Right icon */
  rightIcon?: ReactNode;
  /** Full width button */
  fullWidth?: boolean;
  /** Children content */
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[#1B4D7A] hover:bg-[#164266] text-white shadow-sm hover:shadow-md active:shadow-sm",
  secondary:
    "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white",
  outline:
    "border-2 border-[#1B4D7A] text-[#1B4D7A] hover:bg-[#1B4D7A]/10 dark:border-[#14B8A6] dark:text-[#14B8A6] dark:hover:bg-[#14B8A6]/10",
  ghost:
    "text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800",
  danger:
    "bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow-md active:shadow-sm",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2.5",
};

const iconSizes: Record<ButtonSize, string> = {
  sm: "w-4 h-4",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      className = "",
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#1B4D7A]/50 focus:ring-offset-2 dark:focus:ring-offset-gray-900";
    const disabledStyles = "opacity-50 cursor-not-allowed";
    const widthStyles = fullWidth ? "w-full" : "";

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${
          isDisabled ? disabledStyles : ""
        } ${widthStyles} ${className}`}
        {...props}
      >
        {loading ? (
          <LoadingSpinner className={iconSizes[size]} />
        ) : (
          leftIcon && <span className={iconSizes[size]}>{leftIcon}</span>
        )}
        {children}
        {!loading && rightIcon && (
          <span className={iconSizes[size]}>{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

/**
 * Loading Spinner component
 */
function LoadingSpinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/**
 * Icon Button variant
 */
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Icon content */
  icon: ReactNode;
  /** Accessible label */
  "aria-label": string;
}

export function IconButton({
  variant = "ghost",
  size = "md",
  icon,
  className = "",
  disabled,
  ...props
}: IconButtonProps) {
  const iconButtonSizes: Record<ButtonSize, string> = {
    sm: "p-1.5",
    md: "p-2",
    lg: "p-3",
  };

  const baseStyles =
    "inline-flex items-center justify-center rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#1B4D7A]/50 focus:ring-offset-2 dark:focus:ring-offset-gray-900";
  const disabledStyles = disabled ? "opacity-50 cursor-not-allowed" : "";

  return (
    <button
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${iconButtonSizes[size]} ${disabledStyles} ${className}`}
      {...props}
    >
      <span className={iconSizes[size]}>{icon}</span>
    </button>
  );
}

export default Button;
