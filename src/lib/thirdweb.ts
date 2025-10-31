import { createThirdwebClient } from "thirdweb";
import { base, baseSepolia } from "thirdweb/chains";

export const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!, // from thirdweb dashboard
});

export const chain =
  process.env.NEXT_PUBLIC_CHAIN === "base-sepolia" ? baseSepolia : base;

