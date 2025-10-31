"use client";

import { ConnectButton } from "thirdweb/react";
import { client } from "@/lib/thirdweb";

export function WalletConnect() {
  return (
    <div className="flex items-center justify-end">
      <ConnectButton 
        client={client}
        connectModal={{
          size: "compact",
        }}
      />
    </div>
  );
}

