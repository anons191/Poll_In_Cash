"use client";

import { ThirdwebProvider } from "thirdweb/react";
import { chain } from "@/lib/thirdweb";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThirdwebProvider>
      {children}
    </ThirdwebProvider>
  );
}
