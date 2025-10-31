"use client";

import { ConnectButton } from "thirdweb/react";
import { client, chain } from "@/lib/thirdweb";

export function WalletConnect() {
  return (
    <div className="flex items-center justify-end">
      <ConnectButton 
        client={client}
        chain={chain}
        connectModal={{
          size: "compact",
        }}
      />
    </div>
  );
}

