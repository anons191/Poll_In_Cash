interface StatusMessageProps {
  type: "success" | "error" | "info";
  message: string;
  transactionHash?: string;
  showExplorerLink?: boolean;
  className?: string;
}

/**
 * Reusable status message component for consistent UI feedback
 * Supports success, error, and info states with optional blockchain explorer links
 */
export function StatusMessage({
  type,
  message,
  transactionHash,
  showExplorerLink = true,
  className = "",
}: StatusMessageProps) {
  const baseStyles = "p-3 rounded-md";
  
  const typeStyles = {
    success: "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200",
    error: "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200",
    info: "bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200",
  };

  const getExplorerUrl = (txHash: string) => {
    // Base Sepolia testnet
    return `https://sepolia.basescan.org/tx/${txHash}`;
  };

  return (
    <div className={`${baseStyles} ${typeStyles[type]} ${className}`}>
      <div className="flex items-start gap-2">
        <span className="text-lg">{type === "success" ? "✓" : type === "error" ? "✗" : "ℹ"}</span>
        <div className="flex-1">
          <p className="text-sm font-medium">{message}</p>
          {transactionHash && showExplorerLink && (
            <a
              href={getExplorerUrl(transactionHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline mt-1 inline-block hover:opacity-80"
            >
              View on BaseScan →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

