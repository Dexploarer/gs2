/**
 * Agent Identity NFT Integration (Metaplex Core - 2026)
 *
 * Creates agent identity NFTs using Metaplex Core standard
 * Implements ERC-8004 Identity Registry on Solana
 *
 * Metaplex Core Benefits:
 * - 87% cheaper (0.0029 SOL vs 0.022 SOL per NFT)
 * - Single-account design (vs 4 accounts in Token Metadata)
 * - Plugin system for extensibility
 * - Automatic indexing support
 */

import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  mplCore,
  create,
  fetchAsset,
  addPlugin,
  ruleSet,
} from '@metaplex-foundation/mpl-core';
import {
  generateSigner,
  percentAmount as _percentAmount,
  publicKey,
  signerIdentity,
  type PublicKey as _PublicKey,
  type Signer,
} from '@metaplex-foundation/umi';
import { SOLANA_CONFIG } from './config';

// ============================================================================
// Types
// ============================================================================

/**
 * Agent Identity Metadata (Metaplex Core JSON Standard)
 * Stored on Arweave/IPFS and referenced by Core asset
 */
export interface AgentIdentityMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string; // URL to agent avatar/logo
  external_url?: string; // URL to agent profile
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties: {
    category: 'agent';
    files: Array<{
      uri: string;
      type: string;
    }>;
    creators: Array<{
      address: string;
      share: number;
    }>;
  };
}

/**
 * Asset Creation Result
 */
export interface AssetCreationResult {
  success: boolean;
  assetAddress: string;
  metadataUri: string;
  signature: string;
  error?: string;
}

/**
 * Agent Registration Data
 */
export interface AgentRegistrationData {
  agentId: string;
  name: string;
  description: string;
  avatarUrl?: string;
  website?: string;
  walletAddress: string;
  capabilities: string[];
  endpointUrl?: string;
}

// ============================================================================
// Umi Instance
// ============================================================================

/**
 * Create and configure Umi instance
 */
export function createUmiInstance(): ReturnType<typeof createUmi> {
  const umi = createUmi(SOLANA_CONFIG.rpcUrl);
  umi.use(mplCore());
  return umi;
}

// ============================================================================
// Metadata Upload (Arweave/IPFS)
// ============================================================================

/**
 * Upload agent metadata to decentralized storage
 * Uses Umi's built-in uploader (Irys/Bundlr for Arweave)
 *
 * @param metadata - Agent identity metadata
 * @param umi - Configured Umi instance
 * @returns URI to uploaded metadata
 */
export async function uploadAgentMetadata(
  metadata: AgentIdentityMetadata,
  umi: ReturnType<typeof createUmi>
): Promise<string> {
  try {
    const metadataJson = JSON.stringify(metadata);
    // Create a generic file from the JSON string
    const file = {
      buffer: new TextEncoder().encode(metadataJson),
      fileName: 'metadata.json',
      displayName: 'metadata.json',
      uniqueName: `metadata-${Date.now()}.json`,
      contentType: 'application/json',
      extension: 'json',
      tags: [],
    };
    const [uri] = await umi.uploader.upload([file]);
    return uri;
  } catch (error) {
    throw new Error(
      `Failed to upload metadata: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Build metadata JSON from agent registration data
 */
export function buildAgentMetadata(
  data: AgentRegistrationData
): AgentIdentityMetadata {
  return {
    name: data.name,
    symbol: 'GHOST',
    description: data.description,
    image: data.avatarUrl || 'https://ghostspeak.xyz/default-avatar.png',
    external_url: data.website || `https://ghostspeak.xyz/agents/${data.agentId}`,
    attributes: [
      {
        trait_type: 'Agent Type',
        value: 'Autonomous',
      },
      {
        trait_type: 'Capabilities',
        value: data.capabilities.length,
      },
      {
        trait_type: 'Registration Date',
        value: new Date().toISOString(),
      },
      ...(data.endpointUrl
        ? [
            {
              trait_type: 'Endpoint',
              value: data.endpointUrl,
            },
          ]
        : []),
    ],
    properties: {
      category: 'agent',
      files: [
        {
          uri: data.avatarUrl || 'https://ghostspeak.xyz/default-avatar.png',
          type: 'image/png',
        },
      ],
      creators: [
        {
          address: data.walletAddress,
          share: 100,
        },
      ],
    },
  };
}

// ============================================================================
// Core Asset Creation (Metaplex Core)
// ============================================================================

/**
 * Create agent identity Core asset on Solana
 *
 * This uses Metaplex Core's single-account design for efficient NFTs
 * Cost: ~0.0029 SOL (87% cheaper than Token Metadata)
 *
 * @param registrationData - Agent registration information
 * @param payerSigner - Signer for transaction (agent's wallet)
 * @returns Asset creation result
 */
export async function createAgentIdentityAsset(
  registrationData: AgentRegistrationData,
  payerSigner: Signer
): Promise<AssetCreationResult> {
  try {
    // 1. Initialize Umi
    const umi = createUmiInstance();
    umi.use(signerIdentity(payerSigner));

    // 2. Build and upload metadata
    const metadata = buildAgentMetadata(registrationData);
    const metadataUri = await uploadAgentMetadata(metadata, umi);

    // 3. Generate asset signer
    const asset = generateSigner(umi);

    // 4. Create Core asset (single instruction!)
    const result = await create(umi, {
      asset,
      name: metadata.name,
      uri: metadataUri,
    }).sendAndConfirm(umi);

    // Convert signature bytes to base58 string
    const bs58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const sigBytes = new Uint8Array(result.signature);
    let sigBase58 = '';
    let num = BigInt(0);
    for (const byte of sigBytes) {
      num = num * BigInt(256) + BigInt(byte);
    }
    while (num > 0) {
      sigBase58 = bs58Chars[Number(num % BigInt(58))] + sigBase58;
      num = num / BigInt(58);
    }
    // Add leading zeros
    for (const byte of sigBytes) {
      if (byte === 0) sigBase58 = '1' + sigBase58;
      else break;
    }

    return {
      success: true,
      assetAddress: asset.publicKey.toString(),
      metadataUri,
      signature: sigBase58,
    };
  } catch (error) {
    return {
      success: false,
      assetAddress: '',
      metadataUri: '',
      signature: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Plugin Management
// ============================================================================

/**
 * Add royalty enforcement plugin to asset
 * Ensures creator receives royalties on secondary sales
 *
 * @param assetAddress - Core asset address
 * @param creatorAddress - Creator address for royalties
 * @param basisPoints - Royalty percentage (500 = 5%)
 * @param payerSigner - Signer for transaction
 */
export async function addRoyaltyPlugin(
  assetAddress: string,
  creatorAddress: string,
  basisPoints: number = 500, // 5% default
  payerSigner: Signer
): Promise<boolean> {
  try {
    const umi = createUmiInstance();
    umi.use(signerIdentity(payerSigner));

    await addPlugin(umi, {
      asset: publicKey(assetAddress),
      plugin: {
        type: 'Royalties',
        basisPoints,
        creators: [
          {
            address: publicKey(creatorAddress),
            percentage: 100,
          },
        ],
        ruleSet: ruleSet('None'),
      },
    }).sendAndConfirm(umi);

    return true;
  } catch (error) {
    console.error('Failed to add royalty plugin:', error);
    return false;
  }
}

/**
 * Add custom attributes plugin to asset
 * Stores on-chain attributes (could include reputation data!)
 *
 * @param assetAddress - Core asset address
 * @param attributeList - Key-value pairs to store
 * @param payerSigner - Signer for transaction
 */
export async function addAttributesPlugin(
  assetAddress: string,
  attributeList: Array<{ key: string; value: string }>,
  payerSigner: Signer
): Promise<boolean> {
  try {
    const umi = createUmiInstance();
    umi.use(signerIdentity(payerSigner));

    await addPlugin(umi, {
      asset: publicKey(assetAddress),
      plugin: {
        type: 'Attributes',
        attributeList,
      },
    }).sendAndConfirm(umi);

    return true;
  } catch (error) {
    console.error('Failed to add attributes plugin:', error);
    return false;
  }
}

/**
 * Freeze asset (prevent transfers)
 * Useful during validation or reputation disputes
 *
 * @param assetAddress - Core asset address
 * @param frozen - True to freeze, false to unfreeze
 * @param payerSigner - Signer for transaction
 */
export async function freezeAsset(
  assetAddress: string,
  frozen: boolean,
  payerSigner: Signer
): Promise<boolean> {
  try {
    const umi = createUmiInstance();
    umi.use(signerIdentity(payerSigner));

    await addPlugin(umi, {
      asset: publicKey(assetAddress),
      plugin: {
        type: 'FreezeDelegate',
        frozen,
        authority: {
          type: 'Owner',
        },
      },
    }).sendAndConfirm(umi);

    return true;
  } catch (error) {
    console.error('Failed to freeze/unfreeze asset:', error);
    return false;
  }
}

// ============================================================================
// Verification
// ============================================================================

/**
 * Verify asset ownership
 * Ensures the wallet claiming to be an agent owns the identity asset
 *
 * @param assetAddress - Core asset address
 * @param walletAddress - Wallet claiming ownership
 * @returns True if wallet owns the asset
 */
export async function verifyAssetOwnership(
  assetAddress: string,
  walletAddress: string
): Promise<boolean> {
  try {
    const umi = createUmiInstance();
    const asset = await fetchAsset(umi, publicKey(assetAddress));

    return asset.owner.toString() === walletAddress;
  } catch (error) {
    console.error('Failed to verify asset ownership:', error);
    return false;
  }
}

/**
 * Fetch agent identity metadata from on-chain asset
 * Retrieves the full metadata JSON from Arweave/IPFS
 *
 * @param assetAddress - Core asset address
 * @returns Agent identity metadata
 */
export async function fetchAgentMetadata(
  assetAddress: string
): Promise<AgentIdentityMetadata | null> {
  try {
    const umi = createUmiInstance();
    const asset = await fetchAsset(umi, publicKey(assetAddress));

    // Fetch metadata from URI
    const response = await fetch(asset.uri);
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.statusText}`);
    }

    const metadata = await response.json();
    return metadata as AgentIdentityMetadata;
  } catch (error) {
    console.error('Failed to fetch agent metadata:', error);
    return null;
  }
}

// ============================================================================
// Integration with Convex
// ============================================================================

/**
 * Complete agent registration flow
 * Creates Core asset and syncs to Convex database
 *
 * This is the main function to call when registering a new agent
 *
 * @param registrationData - Agent registration information
 * @param payerSigner - Wallet signer for transaction signing
 * @param convexUrl - Convex deployment URL
 * @returns Registration result
 */
export async function registerAgentOnChain(
  registrationData: AgentRegistrationData,
  payerSigner: Signer,
  convexUrl: string
): Promise<AssetCreationResult & { convexSynced: boolean }> {
  try {
    // 1. Create Core asset
    const assetResult = await createAgentIdentityAsset(
      registrationData,
      payerSigner
    );

    if (!assetResult.success) {
      return { ...assetResult, convexSynced: false };
    }

    // 2. Derive PDA (for smart contract integration)
    if (!SOLANA_CONFIG.programId) {
      console.warn('GHOSTSPEAK_PROGRAM_ID not configured - skipping PDA derivation');
    }

    const identityPDA = assetResult.assetAddress; // For Core, asset address IS the identity

    // 3. Sync to Convex
    let convexSynced = false;
    try {
      const { ConvexHttpClient } = await import('convex/browser');
      const { api } = await import('@/convex/_generated/api');
      const convex = new ConvexHttpClient(convexUrl);

      await convex.mutation(api.erc8004.onchainSync.syncAgentRegistrationPublic, {
        agentAddress: registrationData.walletAddress, // Use wallet address to look up agent
        assetAddress: assetResult.assetAddress,
        identityPDA,
        metadataUri: assetResult.metadataUri,
        registrationTx: assetResult.signature,
      });
      convexSynced = true;
      // Sync success logged for debugging - remove in production if needed
    } catch (syncError) {
      console.error('Failed to sync to Convex, continuing without sync:', syncError);
    }

    // Registration success - data available in return value

    return {
      ...assetResult,
      convexSynced,
    };
  } catch (error) {
    return {
      success: false,
      assetAddress: '',
      metadataUri: '',
      signature: '',
      convexSynced: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Export Summary
// ============================================================================

/**
 * Main exports for agent identity NFT integration:
 *
 * Core Functions:
 * - buildAgentMetadata() - Create metadata JSON
 * - uploadAgentMetadata() - Upload to Arweave/IPFS
 * - createAgentIdentityAsset() - Create Core asset
 * - registerAgentOnChain() - Complete registration flow
 *
 * Plugin Functions:
 * - addRoyaltyPlugin() - Add royalty enforcement
 * - addAttributesPlugin() - Add custom on-chain attributes
 * - freezeAsset() - Lock/unlock transfers
 *
 * Verification:
 * - verifyAssetOwnership() - Check asset ownership
 * - fetchAgentMetadata() - Get metadata from chain
 *
 * Usage Example:
 * ```typescript
 * import { registerAgentOnChain } from '@/lib/solana/nft-identity';
 * import { generateSigner } from '@metaplex-foundation/umi';
 *
 * const signer = generateSigner(umi); // Or use wallet adapter
 *
 * const result = await registerAgentOnChain(
 *   {
 *     agentId: 'agent_123',
 *     name: 'Trading Agent',
 *     description: 'Autonomous trading bot',
 *     walletAddress: signer.publicKey.toString(),
 *     capabilities: ['trading', 'analytics'],
 *   },
 *   signer,
 *   process.env.NEXT_PUBLIC_CONVEX_URL!
 * );
 *
 * if (result.success) {
 *   console.log('Core Asset:', result.assetAddress);
 *   console.log('Metadata URI:', result.metadataUri);
 *
 *   // Add reputation attributes
 *   await addAttributesPlugin(
 *     result.assetAddress,
 *     [
 *       { key: 'reputation_score', value: '850' },
 *       { key: 'verified_agent', value: 'true' },
 *     ],
 *     signer
 *   );
 * }
 * ```
 *
 * Cost Comparison:
 * - Token Metadata (old): 0.022 SOL (~$5.00)
 * - Metaplex Core (new): 0.0029 SOL (~$0.65)
 * - Savings: 87% reduction
 */
