/**
 * Vault Monitoring for BYOT Token Staking
 *
 * Reads on-chain token balances from vault addresses to verify stakes.
 * This allows staking to work WITHOUT a custom Solana program by monitoring
 * token transfers to designated vault addresses.
 */

import { createSolanaRpc } from '@solana/rpc'
import { address, type Address } from '@solana/addresses'
import { SOLANA_CONFIG } from './config'

// Types for vault monitoring
export interface VaultBalance {
  vaultAddress: string
  tokenMint: string
  balance: bigint
  balanceUi: number
  decimals: number
  lastUpdated: number
}

export interface TokenHolder {
  ownerAddress: string
  balance: bigint
  balanceUi: number
}

export interface VaultStakeInfo {
  vaultAddress: string
  tokenMint: string
  totalBalance: bigint
  totalBalanceUi: number
  holders: TokenHolder[]
}

/**
 * Fetch the balance of a specific token account (vault)
 */
export async function getVaultBalance(
  vaultAddress: string,
  rpcUrl: string = SOLANA_CONFIG.rpcUrl
): Promise<VaultBalance | null> {
  const rpc = createSolanaRpc(rpcUrl)

  try {
    const result = await rpc
      .getTokenAccountBalance(address(vaultAddress as Address))
      .send()

    if (!result.value) {
      return null
    }

    return {
      vaultAddress,
      tokenMint: '', // Token mint isn't returned from getTokenAccountBalance
      balance: BigInt(result.value.amount),
      balanceUi: result.value.uiAmount ?? 0,
      decimals: result.value.decimals,
      lastUpdated: Date.now(),
    }
  } catch (error) {
    console.error(`Failed to get vault balance for ${vaultAddress}:`, error)
    return null
  }
}

/**
 * Fetch token account info including mint address
 */
export async function getTokenAccountInfo(
  accountAddress: string,
  rpcUrl: string = SOLANA_CONFIG.rpcUrl
): Promise<{
  mint: string
  owner: string
  amount: bigint
  decimals: number
} | null> {
  const rpc = createSolanaRpc(rpcUrl)

  try {
    const result = await rpc
      .getAccountInfo(address(accountAddress as Address), {
        encoding: 'jsonParsed',
      })
      .send()

    if (!result.value || !result.value.data) {
      return null
    }

    const data = result.value.data as {
      parsed?: {
        info?: {
          mint?: string
          owner?: string
          tokenAmount?: {
            amount?: string
            decimals?: number
          }
        }
        type?: string
      }
      program?: string
    }

    if (data.program !== 'spl-token' || data.parsed?.type !== 'account') {
      return null
    }

    const info = data.parsed?.info
    if (!info?.mint || !info?.owner || !info?.tokenAmount) {
      return null
    }

    return {
      mint: info.mint,
      owner: info.owner,
      amount: BigInt(info.tokenAmount.amount || '0'),
      decimals: info.tokenAmount.decimals || 0,
    }
  } catch (error) {
    console.error(`Failed to get token account info for ${accountAddress}:`, error)
    return null
  }
}

/**
 * Get all token accounts for a specific owner and mint
 * This finds who has sent tokens to a vault
 */
export async function getTokenAccountsByOwner(
  ownerAddress: string,
  mintAddress: string,
  rpcUrl: string = SOLANA_CONFIG.rpcUrl
): Promise<
  {
    pubkey: string
    amount: bigint
    decimals: number
  }[]
> {
  const rpc = createSolanaRpc(rpcUrl)

  try {
    const result = await rpc
      .getTokenAccountsByOwner(
        address(ownerAddress as Address),
        { mint: address(mintAddress as Address) },
        { encoding: 'jsonParsed' }
      )
      .send()

    if (!result.value) {
      return []
    }

    return result.value.map((account) => {
      const data = account.account.data as {
        parsed?: {
          info?: {
            tokenAmount?: {
              amount?: string
              decimals?: number
            }
          }
        }
      }

      return {
        pubkey: account.pubkey,
        amount: BigInt(data.parsed?.info?.tokenAmount?.amount || '0'),
        decimals: data.parsed?.info?.tokenAmount?.decimals || 0,
      }
    })
  } catch (error) {
    console.error(`Failed to get token accounts for ${ownerAddress}:`, error)
    return []
  }
}

/**
 * Get recent token transfers to a vault address
 * Uses getSignaturesForAddress to find recent transactions
 */
export async function getRecentVaultDeposits(
  vaultAddress: string,
  limit: number = 100,
  rpcUrl: string = SOLANA_CONFIG.rpcUrl
): Promise<
  {
    signature: string
    slot: bigint
    blockTime: number | null
  }[]
> {
  const rpc = createSolanaRpc(rpcUrl)

  try {
    const result = await rpc
      .getSignaturesForAddress(address(vaultAddress as Address), {
        limit,
      })
      .send()

    return result.map((sig) => ({
      signature: String(sig.signature),
      slot: sig.slot,
      blockTime: sig.blockTime ? Number(sig.blockTime) : null,
    }))
  } catch (error) {
    console.error(`Failed to get recent deposits for ${vaultAddress}:`, error)
    return []
  }
}

/**
 * Parse a transaction to extract token transfer details
 * Returns sender, amount if it's a token transfer to the vault
 */
export async function parseTokenTransfer(
  signature: string,
  vaultAddress: string,
  rpcUrl: string = SOLANA_CONFIG.rpcUrl
): Promise<{
  sender: string
  amount: bigint
  amountUi: number
  decimals: number
  tokenMint: string
  blockTime: number
} | null> {
  const rpc = createSolanaRpc(rpcUrl)

  try {
    const result = await rpc
      .getTransaction(signature as unknown as Parameters<typeof rpc.getTransaction>[0], {
        encoding: 'jsonParsed',
        maxSupportedTransactionVersion: 0,
      })
      .send()

    if (!result || !result.meta || !result.transaction) {
      return null
    }

    // Check pre/post token balances for the vault
    const preBalances = result.meta.preTokenBalances || []
    const postBalances = result.meta.postTokenBalances || []

    // Find the vault's token account in post balances
    const vaultPostBalance = postBalances.find(
      (b) => b.owner === vaultAddress
    )

    if (!vaultPostBalance) {
      return null // Not a transfer to this vault
    }

    // Find the corresponding pre balance
    const vaultPreBalance = preBalances.find(
      (b) =>
        b.owner === vaultAddress &&
        b.mint === vaultPostBalance.mint
    )

    const preAmount = BigInt(vaultPreBalance?.uiTokenAmount?.amount || '0')
    const postAmount = BigInt(vaultPostBalance.uiTokenAmount?.amount || '0')

    // Calculate the transfer amount
    if (postAmount <= preAmount) {
      return null // Not a deposit
    }

    const amount = postAmount - preAmount

    // Find the sender (whose balance decreased)
    const sender = preBalances.find((pb) => {
      const post = postBalances.find(
        (postB) => postB.owner === pb.owner && postB.mint === pb.mint
      )
      if (!post) return false

      const preAmt = BigInt(pb.uiTokenAmount?.amount || '0')
      const postAmt = BigInt(post.uiTokenAmount?.amount || '0')

      return preAmt > postAmt && pb.mint === vaultPostBalance.mint
    })

    if (!sender?.owner) {
      return null
    }

    return {
      sender: sender.owner,
      amount,
      amountUi: Number(amount) / 10 ** (vaultPostBalance.uiTokenAmount?.decimals || 0),
      decimals: vaultPostBalance.uiTokenAmount?.decimals || 0,
      tokenMint: vaultPostBalance.mint || '',
      blockTime: result.blockTime ? Number(result.blockTime) : Date.now(),
    }
  } catch (error) {
    console.error(`Failed to parse transaction ${signature}:`, error)
    return null
  }
}

/**
 * Main function: Monitor a vault for new deposits
 * Returns list of deposits since a given time
 */
export async function monitorVaultDeposits(
  vaultAddress: string,
  tokenMint: string,
  sinceTimestamp: number,
  rpcUrl: string = SOLANA_CONFIG.rpcUrl
): Promise<
  {
    signature: string
    sender: string
    amount: bigint
    amountUi: number
    blockTime: number
  }[]
> {
  // Get recent signatures for the vault
  const signatures = await getRecentVaultDeposits(vaultAddress, 100, rpcUrl)

  const deposits: {
    signature: string
    sender: string
    amount: bigint
    amountUi: number
    blockTime: number
  }[] = []

  // Process each signature
  for (const sig of signatures) {
    // Skip if before our timestamp
    if (sig.blockTime && sig.blockTime * 1000 < sinceTimestamp) {
      break // Signatures are ordered newest first
    }

    // Parse the transaction
    const transfer = await parseTokenTransfer(sig.signature, vaultAddress, rpcUrl)

    if (transfer && transfer.tokenMint === tokenMint) {
      deposits.push({
        signature: sig.signature,
        sender: transfer.sender,
        amount: transfer.amount,
        amountUi: transfer.amountUi,
        blockTime: transfer.blockTime,
      })
    }
  }

  return deposits
}

/**
 * Verify a vault has the expected balance (for stake verification)
 */
export async function verifyVaultBalance(
  vaultAddress: string,
  expectedMinBalance: number,
  rpcUrl: string = SOLANA_CONFIG.rpcUrl
): Promise<{
  verified: boolean
  actualBalance: number
  expectedMinBalance: number
}> {
  const balance = await getVaultBalance(vaultAddress, rpcUrl)

  if (!balance) {
    return {
      verified: false,
      actualBalance: 0,
      expectedMinBalance,
    }
  }

  return {
    verified: balance.balanceUi >= expectedMinBalance,
    actualBalance: balance.balanceUi,
    expectedMinBalance,
  }
}
