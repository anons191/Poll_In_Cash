"use client";

/**
 * Providers Component
 * Wraps the application with necessary context providers
 */

import { ThirdwebProvider } from "thirdweb/react";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThirdwebProvider>
      {children}
    </ThirdwebProvider>
  );
}

export default Providers;
