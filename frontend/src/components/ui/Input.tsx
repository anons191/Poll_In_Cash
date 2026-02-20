"use client";

/**
 * Input Component
 * Types: text, number, select, textarea
 * Features: labels, error states, validation styling
 */

import {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  forwardRef,
  ReactNode,
} from "react";

// ============ Base Input ============

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Input label */
  label?: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Left addon (icon or text) */
  leftAddon?: ReactNode;
  /** Right addon (icon or text) */
  rightAddon?: ReactNode;
  /** Full width input */
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftAddon,
      rightAddon,
      fullWidth = true,
      className = "",
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    const baseInputStyles =
      "w-full px-4 py-2.5 text-sm bg-white dark:bg-gray-900 border rounded-lg transition-all duration-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1B4D7A]/50 focus:border-[#1B4D7A]";
    const normalStyles =
      "border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white";
    const errorStyles =
      "border-red-500 dark:border-red-500 text-red-900 dark:text-red-400 focus:ring-red-500/50 focus:border-red-500";
    const disabledStyles =
      "disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60";

    const containerWidth = fullWidth ? "w-full" : "";

    return (
      <div className={`${containerWidth} ${className}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftAddon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
              {leftAddon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`${baseInputStyles} ${
              error ? errorStyles : normalStyles
            } ${disabledStyles} ${leftAddon ? "pl-10" : ""} ${
              rightAddon ? "pr-10" : ""
            }`}
            {...props}
          />
          {rightAddon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
              {rightAddon}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

// ============ Select ============

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Select label */
  label?: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Options */
  options: { value: string; label: string }[];
  /** Placeholder option */
  placeholder?: string;
  /** Full width select */
  fullWidth?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      options,
      placeholder,
      fullWidth = true,
      className = "",
      id,
      ...props
    },
    ref
  ) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");

    const baseSelectStyles =
      "w-full px-4 py-2.5 text-sm bg-white dark:bg-gray-900 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#1B4D7A]/50 focus:border-[#1B4D7A] appearance-none cursor-pointer";
    const normalStyles =
      "border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white";
    const errorStyles =
      "border-red-500 dark:border-red-500 text-red-900 dark:text-red-400 focus:ring-red-500/50 focus:border-red-500";
    const disabledStyles =
      "disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60";

    const containerWidth = fullWidth ? "w-full" : "";

    return (
      <div className={`${containerWidth} ${className}`}>
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`${baseSelectStyles} ${
              error ? errorStyles : normalStyles
            } ${disabledStyles}`}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

// ============ Textarea ============

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Textarea label */
  label?: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Full width textarea */
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = true,
      className = "",
      id,
      ...props
    },
    ref
  ) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");

    const baseTextareaStyles =
      "w-full px-4 py-2.5 text-sm bg-white dark:bg-gray-900 border rounded-lg transition-all duration-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#1B4D7A]/50 focus:border-[#1B4D7A] resize-y min-h-[100px]";
    const normalStyles =
      "border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white";
    const errorStyles =
      "border-red-500 dark:border-red-500 text-red-900 dark:text-red-400 focus:ring-red-500/50 focus:border-red-500";
    const disabledStyles =
      "disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60";

    const containerWidth = fullWidth ? "w-full" : "";

    return (
      <div className={`${containerWidth} ${className}`}>
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`${baseTextareaStyles} ${
            error ? errorStyles : normalStyles
          } ${disabledStyles}`}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

// ============ Checkbox ============

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Checkbox label */
  label: string;
  /** Error message */
  error?: string;
  /** Description text */
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, description, className = "", id, ...props }, ref) => {
    const checkboxId = id || label.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className={className}>
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              ref={ref}
              type="checkbox"
              id={checkboxId}
              className="w-4 h-4 text-[#1B4D7A] bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 rounded focus:ring-2 focus:ring-[#1B4D7A]/50 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors cursor-pointer"
              {...props}
            />
          </div>
          <div className="ml-3">
            <label
              htmlFor={checkboxId}
              className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
            >
              {label}
            </label>
            {description && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {description}
              </p>
            )}
          </div>
        </div>
        {error && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";

export default Input;
