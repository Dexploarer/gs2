/**
 * Solana Program Verification Script
 * Verifies all 5 GhostSpeak programs are deployed on devnet
 */

const DEVNET_RPC = 'https://api.devnet.solana.com';

const PROGRAMS = {
  identityRegistry: '2pELseyWXsBRXWBEPZAMqXsyBsRKADAz6LhSgV8Szc2e',
  reputationRegistry: 'A99rMj3Nu975ShFzyhPyae9raBPxDYQiwi8g6RPC73Mp',
  validationRegistry: '9wwukuFjurWGDXREvnyBLPyePP4wssP5HCuRd1FJsaKc',
  voteRegistry: 'EKqkjsLHK8rFr7pdySSFKZjhQfnEWeVqPRdZekw1t1j6',
  tokenStaking: '4JNxNBFEH3BD6VRjQoi2pNDpbEa8L46LKbHnUTrdAWeL',
};

interface AccountResult {
  name: string;
  address: string;
  status: string;
  owner?: string;
  executable?: boolean;
  lamports?: number;
  dataSize?: number;
}

async function getAccountInfo(address: string) {
  const response = await fetch(DEVNET_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [address, { encoding: 'base64' }],
    }),
  });
  return response.json();
}

async function main() {
  console.log('🔍 Verifying GhostSpeak Programs on Solana Devnet\n');
  console.log('═'.repeat(70));

  const results: AccountResult[] = [];

  for (const [name, address] of Object.entries(PROGRAMS)) {
    try {
      const result = await getAccountInfo(address);

      if (result.error) {
        results.push({ name, address, status: '❌ ERROR', owner: result.error.message });
        continue;
      }

      const accountInfo = result.result?.value;

      if (!accountInfo) {
        results.push({ name, address, status: '❌ NOT FOUND' });
        continue;
      }

      const owner = accountInfo.owner;
      const executable = accountInfo.executable;
      const lamports = accountInfo.lamports;
      const dataSize = accountInfo.data?.[0] ? Buffer.from(accountInfo.data[0], 'base64').length : 0;

      // BPF Loader v2 or v3 indicates a deployed program
      const isBPFProgram = owner === 'BPFLoaderUpgradeab1e11111111111111111111111' ||
                          owner === 'BPFLoader2111111111111111111111111111111111';

      if (executable && isBPFProgram) {
        results.push({
          name,
          address,
          status: '✅ DEPLOYED',
          owner,
          executable,
          lamports,
          dataSize
        });
      } else {
        results.push({
          name,
          address,
          status: '⚠️ NOT EXECUTABLE',
          owner,
          executable,
          lamports,
          dataSize
        });
      }
    } catch (error) {
      results.push({ name, address, status: '❌ ERROR', owner: String(error) });
    }
  }

  // Print results
  for (const r of results) {
    console.log(`\n📦 ${r.name}`);
    console.log(`   Address:    ${r.address}`);
    console.log(`   Status:     ${r.status}`);
    if (r.owner) console.log(`   Owner:      ${r.owner}`);
    if (r.executable !== undefined) console.log(`   Executable: ${r.executable}`);
    if (r.lamports !== undefined) console.log(`   Balance:    ${(r.lamports / 1e9).toFixed(4)} SOL`);
    if (r.dataSize !== undefined) console.log(`   Data Size:  ${r.dataSize} bytes`);
    console.log(`   Explorer:   https://explorer.solana.com/address/${r.address}?cluster=devnet`);
  }

  console.log('\n' + '═'.repeat(70));

  const deployed = results.filter(r => r.status === '✅ DEPLOYED').length;
  console.log(`\n📊 Summary: ${deployed}/${results.length} programs deployed on devnet`);

  if (deployed === results.length) {
    console.log('✅ All programs verified successfully!\n');
  } else {
    console.log('⚠️ Some programs need attention.\n');
  }
}

main().catch(console.error);
