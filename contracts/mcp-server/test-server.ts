/**
 * Simple test script for GhostSpeak MCP Server
 *
 * Tests basic functionality without requiring MCP client
 */

import { Connection, PublicKey } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

const REPUTATION_REGISTRY_PROGRAM_ID = 'A99rMj3Nu975ShFzyhPyae9raBPxDYQiwi8g6RPC73Mp';
const VOTE_REGISTRY_PROGRAM_ID = 'EKqkjsLHK8rFr7pdySSFKZjhQfnEWeVqPRdZekw1t1j6';

async function testFetchReputationAccounts() {
  console.log('Testing: Fetch all reputation accounts...\n');

  try {
    const accounts = await connection.getProgramAccounts(
      new PublicKey(REPUTATION_REGISTRY_PROGRAM_ID)
    );

    console.log(`Found ${accounts.length} reputation accounts`);

    if (accounts.length > 0) {
      console.log('\nFirst account:');
      console.log('  Address:', accounts[0].pubkey.toBase58());
      console.log('  Data size:', accounts[0].account.data.length, 'bytes');

      // Parse agent pubkey and reputation score
      const data = accounts[0].account.data;
      const agentPubkey = new PublicKey(data.slice(8, 40));
      const reputationScore = data.readUInt16LE(40);

      console.log('  Agent:', agentPubkey.toBase58());
      console.log('  Reputation Score:', reputationScore);
    }

    return accounts.length > 0;
  } catch (error) {
    console.error('Error:', error);
    return false;
  }
}

async function testFetchVoteAccounts() {
  console.log('\n\nTesting: Fetch all vote accounts...\n');

  try {
    const accounts = await connection.getProgramAccounts(
      new PublicKey(VOTE_REGISTRY_PROGRAM_ID)
    );

    console.log(`Found ${accounts.length} vote accounts`);

    if (accounts.length > 0) {
      console.log('\nFirst vote:');
      console.log('  Address:', accounts[0].pubkey.toBase58());

      const data = accounts[0].account.data;
      const votedAgent = new PublicKey(data.slice(40, 72));
      const voter = new PublicKey(data.slice(72, 104));
      const voteType = data.readUInt8(104) === 0 ? 'upvote' : 'downvote';

      console.log('  Voted Agent:', votedAgent.toBase58());
      console.log('  Voter:', voter.toBase58());
      console.log('  Vote Type:', voteType);
    }

    return accounts.length > 0;
  } catch (error) {
    console.error('Error:', error);
    return false;
  }
}

async function testConnectionToProgramsDeployed() {
  console.log('\n\nTesting: Check if programs are deployed...\n');

  const programs = [
    { name: 'Reputation Registry', id: REPUTATION_REGISTRY_PROGRAM_ID },
    { name: 'Vote Registry', id: VOTE_REGISTRY_PROGRAM_ID },
  ];

  for (const program of programs) {
    try {
      const accountInfo = await connection.getAccountInfo(new PublicKey(program.id));

      if (accountInfo) {
        console.log(`✅ ${program.name}: DEPLOYED`);
        console.log(`   Owner: ${accountInfo.owner.toBase58()}`);
        console.log(`   Executable: ${accountInfo.executable}`);
      } else {
        console.log(`❌ ${program.name}: NOT FOUND`);
      }
    } catch (error) {
      console.log(`❌ ${program.name}: ERROR - ${error}`);
    }
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('GhostSpeak MCP Server - Connection Test');
  console.log('='.repeat(60));
  console.log();

  await testConnectionToProgramsDeployed();
  await testFetchReputationAccounts();
  await testFetchVoteAccounts();

  console.log('\n' + '='.repeat(60));
  console.log('Test complete!');
  console.log('='.repeat(60));
}

main();
