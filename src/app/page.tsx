export default function Home() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Welcome</h2>
      <p>
        You’re looking at the Day 1 scaffold. Next steps: connect wallets (Thirdweb),
        set up Stripe Identity, create polls, and handle instant payouts in USDC on Base.
      </p>
      <ol className="list-decimal ml-6 space-y-2 opacity-90">
        <li>Fill .env.local with Firebase + Thirdweb client ID.</li>
        <li>Run <code>npm run dev</code> and confirm the app loads.</li>
        <li>Commit and push to GitHub.</li>
      </ol>
    </div>
  );
}
