import { WalletConnect } from "@/components/WalletConnect";
import { CreatePollForm } from "@/components/CreatePollForm";
import { PollList } from "@/components/PollList";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col p-8">
      <header className="w-full flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Poll in Cash</h1>
        <WalletConnect />
      </header>
      
      <div className="flex-1 max-w-4xl mx-auto w-full">
        <div className="text-center mb-8">
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
            Decentralized polling platform with USDC rewards on Base Sepolia
          </p>
        </div>
        
        <div className="space-y-8">
          <CreatePollForm />
          <PollList />
        </div>
      </div>
    </main>
  );
}
