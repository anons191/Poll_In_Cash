"use client";

/**
 * Providers Component
 * Minimal wrapper - no wallet providers needed for spectator-only frontend
 */

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return <>{children}</>;
}

export default Providers;
