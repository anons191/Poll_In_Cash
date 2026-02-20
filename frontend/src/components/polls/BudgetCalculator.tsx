"use client";

/**
 * BudgetCalculator Component
 * Pool size input that calculates and shows per-person payout live
 * based on participant cap
 */

import { useMemo } from "react";
import { Input } from "../ui/Input";
import { Card } from "../ui/Card";

// ============ Types ============

interface BudgetCalculatorProps {
  /** Total pool size in USDC */
  poolSize: number;
  /** Callback when pool size changes */
  onPoolSizeChange: (value: number) => void;
  /** Maximum number of participants */
  participantCap: number;
  /** Callback when participant cap changes */
  onParticipantCapChange: (value: number) => void;
  /** Platform fee percentage (0-100) */
  platformFee?: number;
  /** Minimum payout per person */
  minPayoutPerPerson?: number;
  /** Maximum pool size */
  maxPoolSize?: number;
  /** Additional className */
  className?: string;
}

// ============ Component ============

export function BudgetCalculator({
  poolSize,
  onPoolSizeChange,
  participantCap,
  onParticipantCapChange,
  platformFee = 2.5,
  minPayoutPerPerson = 0.1,
  maxPoolSize = 10000,
  className = "",
}: BudgetCalculatorProps) {
  // Calculate values
  const calculations = useMemo(() => {
    const feeAmount = (poolSize * platformFee) / 100;
    const netPool = poolSize - feeAmount;
    const payoutPerPerson = participantCap > 0 ? netPool / participantCap : 0;
    const isPayoutTooLow = payoutPerPerson < minPayoutPerPerson && participantCap > 0;
    const maxParticipants = netPool > 0 ? Math.floor(netPool / minPayoutPerPerson) : 0;
    const minPoolForCurrentCap = participantCap * minPayoutPerPerson * (100 / (100 - platformFee));

    return {
      feeAmount,
      netPool,
      payoutPerPerson,
      isPayoutTooLow,
      maxParticipants,
      minPoolForCurrentCap,
    };
  }, [poolSize, participantCap, platformFee, minPayoutPerPerson]);

  // Handle pool size input
  const handlePoolSizeChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    onPoolSizeChange(Math.min(numValue, maxPoolSize));
  };

  // Handle participant cap input
  const handleParticipantCapChange = (value: string) => {
    const numValue = parseInt(value) || 0;
    onParticipantCapChange(Math.max(1, numValue));
  };

  // Quick amount buttons
  const quickAmounts = [50, 100, 250, 500, 1000];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Pool Size Input */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Budget
        </h3>

        <div className="mb-4">
          <Input
            label="Total Pool Size (USDC)"
            type="number"
            value={poolSize || ""}
            onChange={(e) => handlePoolSizeChange(e.target.value)}
            leftAddon={<span className="text-sm">$</span>}
            min={0}
            max={maxPoolSize}
            step={0.01}
            helperText={`Maximum: $${maxPoolSize.toLocaleString()} USDC`}
          />
        </div>

        {/* Quick amount buttons */}
        <div className="flex flex-wrap gap-2">
          {quickAmounts.map((amount) => (
            <button
              key={amount}
              onClick={() => onPoolSizeChange(amount)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                poolSize === amount
                  ? "bg-[#1B4D7A] text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              ${amount}
            </button>
          ))}
        </div>
      </Card>

      {/* Participant Cap */}
      <Card padding="md">
        <Input
          label="Maximum Participants"
          type="number"
          value={participantCap || ""}
          onChange={(e) => handleParticipantCapChange(e.target.value)}
          min={1}
          helperText="Number of responses you want to collect"
        />

        {/* Slider for visual adjustment */}
        <div className="mt-4">
          <input
            type="range"
            min={1}
            max={Math.max(calculations.maxParticipants, participantCap, 100)}
            value={participantCap}
            onChange={(e) => onParticipantCapChange(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#1B4D7A]"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>1</span>
            <span>
              Max: {calculations.maxParticipants > 0 ? calculations.maxParticipants : "-"}
            </span>
          </div>
        </div>
      </Card>

      {/* Calculation Summary */}
      <Card padding="md" className="bg-gray-50 dark:bg-gray-800/50">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Summary
        </h3>

        <div className="space-y-3">
          {/* Pool size */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Total Pool
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              ${poolSize.toFixed(2)} USDC
            </span>
          </div>

          {/* Platform fee */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Platform Fee ({platformFee}%)
            </span>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              -${calculations.feeAmount.toFixed(2)}
            </span>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700" />

          {/* Net pool */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Net Pool
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              ${calculations.netPool.toFixed(2)} USDC
            </span>
          </div>

          {/* Participants */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Participants
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {participantCap}
            </span>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700" />

          {/* Payout per person */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Payout per Response
            </span>
            <span
              className={`text-lg font-bold ${
                calculations.isPayoutTooLow
                  ? "text-red-500"
                  : "text-[#22C55E]"
              }`}
            >
              ${calculations.payoutPerPerson.toFixed(2)}
              <span className="text-xs font-normal text-gray-400 ml-1">
                USDC
              </span>
            </span>
          </div>
        </div>

        {/* Warnings */}
        {calculations.isPayoutTooLow && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex gap-2">
              <svg
                className="w-5 h-5 text-red-500 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  Payout too low
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  Minimum payout per response is ${minPayoutPerPerson.toFixed(2)} USDC.
                  Increase pool size to at least ${calculations.minPoolForCurrentCap.toFixed(2)} or reduce participants.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info about payouts */}
        {!calculations.isPayoutTooLow && poolSize > 0 && participantCap > 0 && (
          <div className="mt-4 p-3 bg-[#22C55E]/10 dark:bg-[#22C55E]/20 rounded-lg border border-[#22C55E]/30">
            <div className="flex gap-2">
              <svg
                className="w-5 h-5 text-[#22C55E] flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-[#16A34A] dark:text-[#22C55E]">
                Each qualifying response will receive{" "}
                <strong>${calculations.payoutPerPerson.toFixed(2)} USDC</strong>{" "}
                automatically.
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default BudgetCalculator;
