const API_BASE = "http://localhost:3001";
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ3YWxsZXRBZGRyZXNzIjoiMHhmMzlmZDZlNTFhYWQ4OGY2ZjRjZTZhYjg4MjcyNzljZmZmYjkyMjY2IiwidXNlcklkIjoiMjJmNThiOWUtZTg1Yi00ODcyLWExNjktMmJkODA4ZmM2ODk1IiwiaWF0IjoxNzcxNjQwOTM0LCJleHAiOjE3NzIyNDU3MzR9.fS7l3x2BR-3ptEmp5Y9mOdxs0cAx8C5ts_HHtBUwIds";

const POLL_1_ID = "4d50b5f3-7563-4030-87a0-c3fcddac274e";
const POLL_3_ID = "526e48ae-f497-4491-8d0d-02426fd215da";

async function getPoll(pollId: string, name: string) {
  const response = await fetch(`${API_BASE}/polls/${pollId}`, {
    headers: {
      "Authorization": `Bearer ${TOKEN}`
    }
  });

  const data = await response.json();
  console.log(`\n${name}:`);
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  console.log("Checking poll data via API...");

  await getPoll(POLL_1_ID, "Poll 1 (Veterans in Nevada)");
  await getPoll(POLL_3_ID, "Poll 3 (Las Vegas Food Service)");
}

main().catch(console.error);
