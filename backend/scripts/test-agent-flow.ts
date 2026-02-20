/**
 * Test the agent poll response flow
 */
import 'dotenv/config';

const API_URL = 'http://localhost:3001';
const POLL_ID = 'dd7068db-a70a-41a7-a61b-74c592d8bbbe';

// Test agent wallet (we'll create a fake one for testing)
const TEST_AGENT_WALLET = '0x1234567890123456789012345678901234567890';

async function main() {
  console.log('=== Testing Agent Poll Flow ===\n');

  // Step 1: Discover polls with matching criteria
  console.log('Step 1: Discover polls (with matching criteria)...');
  const discoverRes = await fetch(
    `${API_URL}/agent/polls/discover?isVeteran=true&isRegisteredVoter=true`
  );
  const discoverData = await discoverRes.json();
  console.log('Discovered polls:', JSON.stringify(discoverData, null, 2));
  
  if (discoverData.polls.length === 0) {
    console.log('No eligible polls found!');
    return;
  }

  const poll = discoverData.polls[0];
  console.log(`\nFound eligible poll: ${poll.title}`);
  console.log(`Payout estimate: $${poll.payoutEstimate}`);
  console.log(`Spots remaining: ${poll.spotsRemaining}`);

  // For steps 2 and 3, we need authentication
  // Let's use the existing user's token or create a test user

  // First, let's check what questions the poll has
  console.log('\n--- Poll Questions ---');
  
  // Get poll details from the public endpoint
  const pollRes = await fetch(`${API_URL}/polls/${POLL_ID}`, {
    headers: {
      'Authorization': 'Bearer test' // This will fail, but let's see the response
    }
  });
  
  if (!pollRes.ok) {
    console.log('Need valid auth token to proceed with match/respond');
    console.log('Poll questions from discover response:');
    console.log('(Questions are not included in discover - need to fetch poll details)');
  }

  console.log('\n=== To complete the test, you need: ===');
  console.log('1. A valid JWT token from authenticating with a wallet');
  console.log('2. The poll questions to answer');
  console.log('\nYou can get a token by:');
  console.log('- Using the frontend to connect a different wallet');
  console.log('- Or creating a test token programmatically');
}

main().catch(console.error);
