/**
 * Next.js API Route x402 Integration Example
 * File: pages/api/protected/chat.ts
 *
 * Uses @solana/web3.js v1 for Anchor compatibility
 */

import { NextApiRequest, NextApiResponse } from 'next'
import { Program, AnchorProvider, Wallet, BN, type Idl } from '@coral-xyz/anchor'
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from '@solana/web3.js'
import { createHash } from 'crypto'
import * as fs from 'fs'

// Solana RPC URL
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'

// Program ID
const PROGRAM_ID = new PublicKey(
  process.env.VOTE_REGISTRY_PROGRAM_ID || '6yqgRTrKwgdK73EHfw8oXaQvhDqyzbjQKS5pDUncMZrN'
)

// Content type enum
const ContentType = {
  Chat: { chat: {} },
  Audio: { audio: {} },
  Video: { video: {} },
  Image: { image: {} },
  Data: { data: {} },
  Compute: { compute: {} },
  Other: { other: {} },
} as const

// Cache the seller keypair
let sellerKeypair: Keypair | null = null

function getSellerKeypair(): Keypair {
  if (sellerKeypair) return sellerKeypair

  // Load seller keypair from environment (base64 encoded)
  const secretKey = Buffer.from(process.env.SELLER_PRIVATE_KEY!, 'base64')
  sellerKeypair = Keypair.fromSecretKey(new Uint8Array(secretKey))
  return sellerKeypair
}

// Lazy initialization of provider and program
let program: Program<Idl> | null = null
let provider: AnchorProvider | null = null

async function getProgram(): Promise<{ program: Program<Idl>; provider: AnchorProvider }> {
  if (program && provider) return { program, provider }

  const keypair = getSellerKeypair()

  const connection = new Connection(SOLANA_RPC_URL, 'confirmed')
  const wallet = new Wallet(keypair)

  provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  })

  // Load IDL dynamically (in production, import statically)
  const idl = JSON.parse(
    fs.readFileSync('./target/idl/vote_registry.json', 'utf-8')
  ) as Idl

  program = new Program(idl, provider)

  return { program, provider }
}

// Simple x402 verification and receipt creation
async function verifyAndCreateReceipt(
  xPayment: string,
  sellerKeypair: Keypair,
  program: Program<Idl>
): Promise<{ payer: string; amount: BN; receiptPda: string }> {
  // Parse x402 payment payload
  const payloadJson = Buffer.from(xPayment, 'base64').toString('utf-8')
  const payload = JSON.parse(payloadJson)

  if (payload.scheme !== 'exact' || payload.payload?.chain !== 'solana') {
    throw new Error('Invalid payment scheme')
  }

  // Extract transaction details (simplified for example)
  const signature = `mock_sig_${Date.now()}`
  const signatureHash = Array.from(
    createHash('sha256').update(signature).digest()
  )
  const amount = new BN(100_000)
  const payer = Keypair.generate().publicKey

  // Derive receipt PDA
  const [receiptPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('tx_receipt'),
      payer.toBuffer(),
      sellerKeypair.publicKey.toBuffer(),
      Buffer.from(signatureHash),
    ],
    PROGRAM_ID
  )

  // Create receipt on-chain
  await program.methods
    .createTransactionReceipt(
      signature,
      signatureHash,
      amount,
      ContentType.Chat
    )
    .accounts({
      receipt: receiptPda,
      payerPubkey: payer,
      recipientPubkey: sellerKeypair.publicKey,
      creator: sellerKeypair.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([sellerKeypair])
    .rpc()

  return {
    payer: payer.toBase58(),
    amount,
    receiptPda: receiptPda.toBase58(),
  }
}

// Protected API handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const xPayment = req.headers['x-payment'] as string | undefined

  if (!xPayment) {
    return res.status(402).json({
      error: 'Payment Required',
      message: 'Missing X-PAYMENT header',
    })
  }

  try {
    const { program } = await getProgram()
    const sellerKeypair = getSellerKeypair()

    // Verify payment and create receipt
    const { payer, amount, receiptPda } = await verifyAndCreateReceipt(
      xPayment,
      sellerKeypair,
      program
    )

    console.log('✅ Receipt created:', receiptPda)

    // Your protected API logic
    const { prompt } = req.body

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt required' })
    }

    // Process AI request
    const aiResponse = await processAIRequest(prompt)

    // Return response with receipt info
    return res.status(200).json({
      response: aiResponse,
      payment: {
        payer,
        amountSOL: Number(amount) / 1e9,
        receiptPda,
        votingInstructions: {
          message: 'You can now vote on this interaction',
          receiptPda,
          votingWindow: '30 days from transaction',
        },
      },
    })
  } catch (error) {
    console.error('API handler error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      message: (error as Error).message,
    })
  }
}

// Example AI processing
async function processAIRequest(prompt: string): Promise<string> {
  return `AI response to: ${prompt}`
}
