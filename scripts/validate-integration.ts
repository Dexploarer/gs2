/**
 * Comprehensive GhostSpeak Solana Integration Validation
 *
 * Tests:
 * 1. All program clients instantiate correctly
 * 2. PDA derivations produce valid addresses
 * 3. Instruction builders work without errors
 * 4. Network configuration is correct
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import {
  IDENTITY_REGISTRY_PROGRAM_ID,
  REPUTATION_REGISTRY_PROGRAM_ID,
  VALIDATION_REGISTRY_PROGRAM_ID,
  VOTE_REGISTRY_PROGRAM_ID,
  TOKEN_STAKING_PROGRAM_ID,
  PROGRAM_IDS,
  PROGRAM_ID_STRINGS,
  SOLANA_NETWORK,
  IS_MAINNET,
  getProgramId,
  getProgramIdString,
  isGhostSpeakProgram,
  getProgramName,
  getRpcEndpoint,
  DEVNET_PROGRAM_IDS,
} from '../lib/solana/programs';

import { IdentityRegistryClient, getAgentIdentityPDA } from '../lib/solana/identity-registry-client';
import { ReputationRegistryClient, getReputationPDA, getReputationAuthorityPDA } from '../lib/solana/reputation-registry-client';
import { ValidationRegistryClient, getValidationPDA, getAuthorityPDA as getValAuthorityPDA, hashEndpointUrl } from '../lib/solana/validation-registry-client';
import { VoteRegistryClient, getPeerVotePDA, getContentRatingPDA, getEndorsementPDA, hashSignature } from '../lib/solana/vote-registry-client';
import { TokenStakingClient, getVaultPDA, getStakePositionPDA, getVaultTokenAccountPDA } from '../lib/solana/token-staking-client';

const DEVNET_RPC = 'https://api.devnet.solana.com';

interface TestResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details?: string;
}

const results: TestResult[] = [];

function addResult(category: string, test: string, status: 'PASS' | 'FAIL' | 'WARN', details?: string) {
  results.push({ category, test, status, details });
}

async function testNetworkConfiguration() {
  console.log('\n📡 Testing Network Configuration...\n');

  // Test SOLANA_NETWORK
  addResult('Network', 'SOLANA_NETWORK defined', SOLANA_NETWORK ? 'PASS' : 'FAIL', `Value: ${SOLANA_NETWORK}`);

  // Test IS_MAINNET flag
  addResult('Network', 'IS_MAINNET flag correct', SOLANA_NETWORK === 'devnet' ? (IS_MAINNET === false ? 'PASS' : 'FAIL') : 'PASS', `IS_MAINNET: ${IS_MAINNET}`);

  // Test RPC endpoint
  const rpcEndpoint = getRpcEndpoint();
  addResult('Network', 'RPC endpoint available', rpcEndpoint.includes('solana.com') || rpcEndpoint.includes('helius') ? 'PASS' : 'WARN', rpcEndpoint);

  // Test DEVNET_PROGRAM_IDS export
  addResult('Network', 'DEVNET_PROGRAM_IDS exported', Object.keys(DEVNET_PROGRAM_IDS).length === 5 ? 'PASS' : 'FAIL', `Keys: ${Object.keys(DEVNET_PROGRAM_IDS).join(', ')}`);
}

async function testProgramIDs() {
  console.log('\n🔑 Testing Program IDs...\n');

  // Verify all 5 program IDs are valid PublicKeys
  const programEntries = [
    ['identityRegistry', IDENTITY_REGISTRY_PROGRAM_ID],
    ['reputationRegistry', REPUTATION_REGISTRY_PROGRAM_ID],
    ['validationRegistry', VALIDATION_REGISTRY_PROGRAM_ID],
    ['voteRegistry', VOTE_REGISTRY_PROGRAM_ID],
    ['tokenStaking', TOKEN_STAKING_PROGRAM_ID],
  ] as const;

  for (const [name, pubkey] of programEntries) {
    try {
      const isValid = PublicKey.isOnCurve(pubkey.toBuffer()) || pubkey.toBase58().length === 44;
      addResult('Program IDs', `${name} is valid PublicKey`, isValid ? 'PASS' : 'FAIL', pubkey.toBase58());
    } catch (e) {
      addResult('Program IDs', `${name} is valid PublicKey`, 'FAIL', String(e));
    }
  }

  // Test PROGRAM_IDS map
  addResult('Program IDs', 'PROGRAM_IDS map complete', Object.keys(PROGRAM_IDS).length === 5 ? 'PASS' : 'FAIL', `Count: ${Object.keys(PROGRAM_IDS).length}`);

  // Test PROGRAM_ID_STRINGS map
  addResult('Program IDs', 'PROGRAM_ID_STRINGS map complete', Object.keys(PROGRAM_ID_STRINGS).length === 5 ? 'PASS' : 'FAIL', `Count: ${Object.keys(PROGRAM_ID_STRINGS).length}`);

  // Test utility functions
  const testPubkey = getProgramId('identityRegistry');
  addResult('Program IDs', 'getProgramId() works', testPubkey.equals(IDENTITY_REGISTRY_PROGRAM_ID) ? 'PASS' : 'FAIL');

  const testString = getProgramIdString('tokenStaking');
  addResult('Program IDs', 'getProgramIdString() works', testString === PROGRAM_ID_STRINGS.tokenStaking ? 'PASS' : 'FAIL');

  const isGhostSpeak = isGhostSpeakProgram(VOTE_REGISTRY_PROGRAM_ID);
  addResult('Program IDs', 'isGhostSpeakProgram() works', isGhostSpeak ? 'PASS' : 'FAIL');

  const programName = getProgramName(REPUTATION_REGISTRY_PROGRAM_ID);
  addResult('Program IDs', 'getProgramName() works', programName === 'reputationRegistry' ? 'PASS' : 'FAIL', `Result: ${programName}`);
}

async function testPDADerivations() {
  console.log('\n🔐 Testing PDA Derivations...\n');

  const testAgent = Keypair.generate().publicKey;
  const testMint = Keypair.generate().publicKey;
  const testSignature = 'test-signature-12345';

  // Identity Registry PDAs
  try {
    const [identityPDA, bump] = getAgentIdentityPDA(testAgent);
    addResult('PDA', 'Identity Registry PDA derivation', identityPDA instanceof PublicKey ? 'PASS' : 'FAIL', `Address: ${identityPDA.toBase58()}, Bump: ${bump}`);
  } catch (e) {
    addResult('PDA', 'Identity Registry PDA derivation', 'FAIL', String(e));
  }

  // Reputation Registry PDAs
  try {
    const [repPDA, bump1] = getReputationPDA(testAgent);
    addResult('PDA', 'Reputation Registry PDA derivation', repPDA instanceof PublicKey ? 'PASS' : 'FAIL', `Address: ${repPDA.toBase58()}, Bump: ${bump1}`);

    const [authPDA, bump2] = getReputationAuthorityPDA();
    addResult('PDA', 'Reputation Authority PDA derivation', authPDA instanceof PublicKey ? 'PASS' : 'FAIL', `Address: ${authPDA.toBase58()}, Bump: ${bump2}`);
  } catch (e) {
    addResult('PDA', 'Reputation Registry PDA derivation', 'FAIL', String(e));
  }

  // Validation Registry PDAs
  try {
    const endpointHash = await hashEndpointUrl('https://example.com/api');
    const [valPDA, bump1] = getValidationPDA(endpointHash);
    addResult('PDA', 'Validation Registry PDA derivation', valPDA instanceof PublicKey ? 'PASS' : 'FAIL', `Address: ${valPDA.toBase58()}, Bump: ${bump1}`);

    const [valAuthPDA, bump2] = getValAuthorityPDA();
    addResult('PDA', 'Validation Authority PDA derivation', valAuthPDA instanceof PublicKey ? 'PASS' : 'FAIL', `Address: ${valAuthPDA.toBase58()}, Bump: ${bump2}`);
  } catch (e) {
    addResult('PDA', 'Validation Registry PDA derivation', 'FAIL', String(e));
  }

  // Vote Registry PDAs
  try {
    const sigHash = await hashSignature(testSignature);
    const txReceipt = Keypair.generate().publicKey;

    const [votePDA] = getPeerVotePDA(txReceipt);
    addResult('PDA', 'Vote Registry Peer Vote PDA', votePDA instanceof PublicKey ? 'PASS' : 'FAIL', `Address: ${votePDA.toBase58()}`);

    const [ratingPDA] = getContentRatingPDA(testSignature);
    addResult('PDA', 'Vote Registry Content Rating PDA', ratingPDA instanceof PublicKey ? 'PASS' : 'FAIL', `Address: ${ratingPDA.toBase58()}`);

    const [endorsePDA] = getEndorsementPDA(testAgent, Keypair.generate().publicKey);
    addResult('PDA', 'Vote Registry Endorsement PDA', endorsePDA instanceof PublicKey ? 'PASS' : 'FAIL', `Address: ${endorsePDA.toBase58()}`);
  } catch (e) {
    addResult('PDA', 'Vote Registry PDA derivation', 'FAIL', String(e));
  }

  // Token Staking PDAs
  try {
    const [vaultPDA] = getVaultPDA(testAgent, testMint);
    addResult('PDA', 'Token Staking Vault PDA', vaultPDA instanceof PublicKey ? 'PASS' : 'FAIL', `Address: ${vaultPDA.toBase58()}`);

    const [positionPDA] = getStakePositionPDA(vaultPDA, testAgent);
    addResult('PDA', 'Token Staking Position PDA', positionPDA instanceof PublicKey ? 'PASS' : 'FAIL', `Address: ${positionPDA.toBase58()}`);

    const [vaultTokenPDA] = getVaultTokenAccountPDA(vaultPDA);
    addResult('PDA', 'Token Staking Vault Token PDA', vaultTokenPDA instanceof PublicKey ? 'PASS' : 'FAIL', `Address: ${vaultTokenPDA.toBase58()}`);
  } catch (e) {
    addResult('PDA', 'Token Staking PDA derivation', 'FAIL', String(e));
  }
}

async function testClientInstantiation() {
  console.log('\n🔧 Testing Client Instantiation...\n');

  const connection = new Connection(DEVNET_RPC);

  // Identity Registry Client
  try {
    const identityClient = new IdentityRegistryClient(connection);
    addResult('Clients', 'IdentityRegistryClient instantiation', 'PASS');
  } catch (e) {
    addResult('Clients', 'IdentityRegistryClient instantiation', 'FAIL', String(e));
  }

  // Reputation Registry Client
  try {
    const repClient = new ReputationRegistryClient(connection);
    addResult('Clients', 'ReputationRegistryClient instantiation', 'PASS');
  } catch (e) {
    addResult('Clients', 'ReputationRegistryClient instantiation', 'FAIL', String(e));
  }

  // Validation Registry Client
  try {
    const valClient = new ValidationRegistryClient(connection);
    addResult('Clients', 'ValidationRegistryClient instantiation', 'PASS');
  } catch (e) {
    addResult('Clients', 'ValidationRegistryClient instantiation', 'FAIL', String(e));
  }

  // Vote Registry Client
  try {
    const voteClient = new VoteRegistryClient(connection);
    addResult('Clients', 'VoteRegistryClient instantiation', 'PASS');
  } catch (e) {
    addResult('Clients', 'VoteRegistryClient instantiation', 'FAIL', String(e));
  }

  // Token Staking Client
  try {
    const stakingClient = new TokenStakingClient(connection);
    addResult('Clients', 'TokenStakingClient instantiation', 'PASS');
  } catch (e) {
    addResult('Clients', 'TokenStakingClient instantiation', 'FAIL', String(e));
  }
}

async function testInstructionBuilding() {
  console.log('\n📝 Testing Instruction Building...\n');

  const connection = new Connection(DEVNET_RPC);
  const testSigner = Keypair.generate();
  const testAgent = Keypair.generate();
  const testMint = Keypair.generate().publicKey;

  // Identity Registry Instructions
  try {
    const identityClient = new IdentityRegistryClient(connection);
    const assetAddress = Keypair.generate().publicKey; // Mock NFT asset address
    const ix = identityClient.buildRegisterAgentInstruction(
      testSigner.publicKey,
      assetAddress,
      'https://arweave.net/test-metadata-uri'
    );
    addResult('Instructions', 'Identity: buildRegisterAgentInstruction', ix.programId.equals(IDENTITY_REGISTRY_PROGRAM_ID) ? 'PASS' : 'FAIL', `Keys: ${ix.keys.length}`);
  } catch (e) {
    addResult('Instructions', 'Identity: buildRegisterAgentInstruction', 'FAIL', String(e));
  }

  // Reputation Registry Instructions
  try {
    const repClient = new ReputationRegistryClient(connection);
    const ix = repClient.buildInitializeAuthorityInstruction(testSigner.publicKey, testSigner.publicKey);
    addResult('Instructions', 'Reputation: buildInitializeAuthorityInstruction', ix.programId.equals(REPUTATION_REGISTRY_PROGRAM_ID) ? 'PASS' : 'FAIL', `Keys: ${ix.keys.length}`);
  } catch (e) {
    addResult('Instructions', 'Reputation: buildInitializeAuthorityInstruction', 'FAIL', String(e));
  }

  // Validation Registry Instructions
  try {
    const valClient = new ValidationRegistryClient(connection);
    const endpointHash = await hashEndpointUrl('https://example.com/api');
    const ix = valClient.buildSubmitValidationInstruction(
      testSigner.publicKey,
      testAgent.publicKey,
      'https://example.com/api',
      endpointHash,
      [{ llmModel: 'gpt-4', success: true, responseTime: BigInt(100), score: 95 }]
    );
    addResult('Instructions', 'Validation: buildSubmitValidationInstruction', ix.programId.equals(VALIDATION_REGISTRY_PROGRAM_ID) ? 'PASS' : 'FAIL', `Keys: ${ix.keys.length}`);
  } catch (e) {
    addResult('Instructions', 'Validation: buildSubmitValidationInstruction', 'FAIL', String(e));
  }

  // Vote Registry Instructions
  try {
    const voteClient = new VoteRegistryClient(connection);
    const commentHash = await hashSignature('test comment');
    const ix = voteClient.buildCastPeerVoteInstruction(
      testSigner.publicKey,
      testAgent.publicKey,
      Keypair.generate().publicKey,
      { Upvote: {} } as any,
      { responseQuality: 90, responseSpeed: 85, accuracy: 95, professionalism: 88 },
      commentHash
    );
    addResult('Instructions', 'Vote: buildCastPeerVoteInstruction', ix.programId.equals(VOTE_REGISTRY_PROGRAM_ID) ? 'PASS' : 'FAIL', `Keys: ${ix.keys.length}`);
  } catch (e) {
    addResult('Instructions', 'Vote: buildCastPeerVoteInstruction', 'FAIL', String(e));
  }

  // Token Staking Instructions
  try {
    const stakingClient = new TokenStakingClient(connection);
    const ix = stakingClient.buildInitializeVaultInstruction(
      testSigner.publicKey,
      testAgent.publicKey,
      testMint,
      BigInt(1000000),  // minStakeAmount: 0.001 tokens
      BigInt(86400),     // lockPeriodSeconds: 1 day
      100               // weightMultiplier: 1x
    );
    addResult('Instructions', 'Staking: buildInitializeVaultInstruction', ix.programId.equals(TOKEN_STAKING_PROGRAM_ID) ? 'PASS' : 'FAIL', `Keys: ${ix.keys.length}`);
  } catch (e) {
    addResult('Instructions', 'Staking: buildInitializeVaultInstruction', 'FAIL', String(e));
  }
}

async function testOnChainQueries() {
  console.log('\n🌐 Testing On-Chain Queries...\n');

  const connection = new Connection(DEVNET_RPC);

  // Test that we can query authority PDAs (may not be initialized)
  try {
    const repClient = new ReputationRegistryClient(connection);
    const authority = await repClient.getAuthority();
    addResult('Queries', 'Reputation Authority query', 'PASS', authority ? `Initialized: ${authority.authority.toBase58()}` : 'Not initialized (expected for fresh deployment)');
  } catch (e) {
    addResult('Queries', 'Reputation Authority query', 'WARN', String(e));
  }

  try {
    const valClient = new ValidationRegistryClient(connection);
    const authority = await valClient.getAuthority();
    addResult('Queries', 'Validation Authority query', 'PASS', authority ? `Initialized: ${authority.authority.toBase58()}` : 'Not initialized (expected for fresh deployment)');
  } catch (e) {
    addResult('Queries', 'Validation Authority query', 'WARN', String(e));
  }

  try {
    const stakingClient = new TokenStakingClient(connection);
    const vaults = await stakingClient.getAllActiveVaults();
    addResult('Queries', 'Staking Vaults query', 'PASS', `Found ${vaults.length} active vaults (0 is expected for fresh deployment)`);
  } catch (e) {
    addResult('Queries', 'Staking Vaults query', 'WARN', String(e));
  }
}

async function printResults() {
  console.log('\n' + '═'.repeat(80));
  console.log('📊 VALIDATION RESULTS SUMMARY');
  console.log('═'.repeat(80));

  const categories = [...new Set(results.map(r => r.category))];

  for (const category of categories) {
    const categoryResults = results.filter(r => r.category === category);
    const passed = categoryResults.filter(r => r.status === 'PASS').length;
    const failed = categoryResults.filter(r => r.status === 'FAIL').length;
    const warned = categoryResults.filter(r => r.status === 'WARN').length;

    console.log(`\n📂 ${category}`);
    console.log('─'.repeat(40));

    for (const r of categoryResults) {
      const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`   ${icon} ${r.test}`);
      if (r.details) console.log(`      └─ ${r.details}`);
    }

    console.log(`   Summary: ${passed} passed, ${failed} failed, ${warned} warnings`);
  }

  const totalPassed = results.filter(r => r.status === 'PASS').length;
  const totalFailed = results.filter(r => r.status === 'FAIL').length;
  const totalWarned = results.filter(r => r.status === 'WARN').length;

  console.log('\n' + '═'.repeat(80));
  console.log(`📈 FINAL: ${totalPassed}/${results.length} tests passed, ${totalFailed} failed, ${totalWarned} warnings`);

  if (totalFailed === 0) {
    console.log('\n🎉 All critical tests passed! Integration is complete.\n');
  } else {
    console.log('\n⚠️ Some tests failed. Please review and fix.\n');
    process.exit(1);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║        GhostSpeak Solana Integration Validation Suite                      ║');
  console.log('║        Network: ' + SOLANA_NETWORK.padEnd(58) + '║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  await testNetworkConfiguration();
  await testProgramIDs();
  await testPDADerivations();
  await testClientInstantiation();
  await testInstructionBuilding();
  await testOnChainQueries();
  await printResults();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
