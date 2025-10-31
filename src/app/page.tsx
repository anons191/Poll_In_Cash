import { WalletConnect } from "@/components/WalletConnect";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col p-8">
      <header className="w-full flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Poll in Cash</h1>
        <WalletConnect />
      </header>
      
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
            Decentralized polling platform with USDC rewards on Base
          </p>
          <p className="text-sm text-gray-500">
            Connect your wallet to get started
          </p>
        </div>
      </div>
    </main>
  );
}
