const API_BASE = "http://localhost:3001";
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ3YWxsZXRBZGRyZXNzIjoiMHhmMzlmZDZlNTFhYWQ4OGY2ZjRjZTZhYjg4MjcyNzljZmZmYjkyMjY2IiwidXNlcklkIjoiMjJmNThiOWUtZTg1Yi00ODcyLWExNjktMmJkODA4ZmM2ODk1IiwiaWF0IjoxNzcxNjQwOTM0LCJleHAiOjE3NzIyNDU3MzR9.fS7l3x2BR-3ptEmp5Y9mOdxs0cAx8C5ts_HHtBUwIds";

async function main() {
  console.log("=".repeat(60));
  console.log("EARNINGS & DASHBOARD");
  console.log("=".repeat(60));

  // Check agent earnings
  console.log("\n📊 AGENT EARNINGS:");
  const earningsRes = await fetch(`${API_BASE}/agent/earnings`, {
    headers: { "Authorization": `Bearer ${TOKEN}` }
  });
  if (earningsRes.ok) {
    const earnings = await earningsRes.json();
    console.log(JSON.stringify(earnings, null, 2));
  } else {
    console.log(`Status: ${earningsRes.status}`);
    const text = await earningsRes.text();
    console.log(text);
  }

  // Check dashboard summary
  console.log("\n📊 DASHBOARD SUMMARY:");
  const dashRes = await fetch(`${API_BASE}/dashboard/summary`, {
    headers: { "Authorization": `Bearer ${TOKEN}` }
  });
  if (dashRes.ok) {
    const summary = await dashRes.json();
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`Status: ${dashRes.status}`);
    const text = await dashRes.text();
    console.log(text);
  }

  // Check poll statuses
  console.log("\n📊 POLL STATUSES:");
  const pollsRes = await fetch(`${API_BASE}/polls?mine=true`, {
    headers: { "Authorization": `Bearer ${TOKEN}` }
  });
  if (pollsRes.ok) {
    const polls = await pollsRes.json();
    for (const p of polls.polls) {
      console.log(`\n  ${p.title}:`);
      console.log(`    Status: ${p.status}`);
      console.log(`    Responses: ${p.responseCount}`);
      console.log(`    Pool: ${p.cashPoolUsdc} USDC`);
    }
  }

  console.log("\n" + "=".repeat(60));
}

main().catch(console.error);
