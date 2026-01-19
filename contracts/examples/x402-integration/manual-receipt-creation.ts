/**
 * Manual Receipt Creation Example
 * For cases where you want full control over receipt creation
 *
 * Uses @solana/web3.js v1 for Anchor compatibility
 */

import { Program, AnchorProvider, Wallet, BN, type Idl } from '@coral-xyz/anchor'
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  VersionedTransaction,
} from '@solana/web3.js'
import { createHash } from 'crypto'
import * as fs from 'fs'

// Solana RPC URL
const SOLANA_RPC_URL = 'https://api.devnet.solana.com'

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

// Load seller keypair
function loadSellerKeypair(): Keypair {
  const secretKey = Uint8Array.from(
    JSON.parse(fs.readFileSync('./seller-keypair.json', 'utf-8'))
  )
  return Keypair.fromSecretKey(secretKey)
}

// Parse x402 transaction to extract payment details
interface X402PaymentData {
  signature: string
  signatureHash: number[]
  payer: PublicKey
  recipient: PublicKey
  amount: BN
}

async function parseX402Transaction(
  txBase64: string,
  connection: Connection
): Promise<X402PaymentData> {
  // Deserialize transaction
  const txBuffer = Buffer.from(txBase64, 'base64')
  const transaction = VersionedTransaction.deserialize(txBuffer)

  // Extract signature (first 64 bytes)
  const signatureBytes = transaction.signatures[0]
  const signature = Buffer.from(signatureBytes).toString('hex').slice(0, 88)

  // Hash signature for PDA seed
  const signatureHash = Array.from(
    createHash('sha256').update(signature).digest()
  )

  // Get account keys from message
  const accountKeys = transaction.message.staticAccountKeys

  // Payer is first account
  const payer = accountKeys[0]

  // Recipient is second account (for simple transfer)
  const recipient = accountKeys[1]

  // Parse amount from instruction data
  const instruction = transaction.message.compiledInstructions[0]
  const data = instruction.data

  // SystemProgram.transfer data layout: [instruction_index(u32), lamports(u64)]
  const amount = new BN(data.slice(4, 12), 'le')

  return {
    signature,
    signatureHash,
    payer,
    recipient,
    amount,
  }
}

// Derive receipt PDA
function deriveReceiptPda(
  payer: PublicKey,
  recipient: PublicKey,
  signatureHash: number[]
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('tx_receipt'),
      payer.toBuffer(),
      recipient.toBuffer(),
      Buffer.from(signatureHash),
    ],
    PROGRAM_ID
  )
}

async function main() {
  // Setup Solana connection
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed')

  // Load seller keypair
  const sellerKeypair = loadSellerKeypair()

  // Create wallet and provider
  const wallet = new Wallet(sellerKeypair)
  const provider = new AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  })

  // Load program IDL
  const idl = JSON.parse(
    fs.readFileSync('./target/idl/vote_registry.json', 'utf-8')
  ) as Idl

  const program = new Program(idl, provider)

  // Example: Parse x402 payment payload
  // In production, this would come from the X-PAYMENT header
  const examplePayload = {
    scheme: 'exact',
    payload: {
      chain: 'solana',
      transaction: 'BASE64_ENCODED_TRANSACTION_HERE',
    },
  }

  try {
    // 1. Parse transaction
    console.log('Parsing x402 transaction...')

    // For this example, we'll create mock data since we don't have a real transaction
    const mockPayer = Keypair.generate()
    const mockSignature = `5oDkVACdJHLXvphAYEi${Date.now()}`
    const mockSignatureHash = Array.from(
      createHash('sha256').update(mockSignature).digest()
    )
    const mockAmount = new BN(100_000_000) // 0.1 SOL

    console.log('Transaction parsed:', {
      signature: mockSignature,
      payer: mockPayer.publicKey.toBase58(),
      recipient: sellerKeypair.publicKey.toBase58(),
      amount: mockAmount.toString(),
    })

    // 2. Derive receipt PDA
    const [receiptPda, bump] = deriveReceiptPda(
      mockPayer.publicKey,
      sellerKeypair.publicKey,
      mockSignatureHash
    )

    console.log('Receipt PDA:', receiptPda.toBase58())
    console.log('Bump:', bump)

    // 3. Create receipt on-chain
    console.log('Creating receipt on-chain...')
    const txSignature = await program.methods
      .createTransactionReceipt(
        mockSignature,
        mockSignatureHash,
        mockAmount,
        ContentType.Chat
      )
      .accounts({
        receipt: receiptPda,
        payerPubkey: mockPayer.publicKey,
        recipientPubkey: sellerKeypair.publicKey,
        creator: sellerKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([sellerKeypair])
      .rpc()

    console.log('✅ Receipt created successfully!')
    console.log('Transaction signature:', txSignature)

    // 4. Fetch and display receipt data
    const receipt = await (program.account as any)['transactionReceipt'].fetch(receiptPda)
    console.log('\nReceipt data:', {
      signature: receipt.signature,
      payer: (receipt.payer as PublicKey).toBase58(),
      recipient: (receipt.recipient as PublicKey).toBase58(),
      amount: (receipt.amount as BN).toString(),
      timestamp: new Date(Number(receipt.timestamp) * 1000).toISOString(),
      contentType: Object.keys(receipt.contentType as object)[0],
      voteCast: receipt.voteCast,
    })
  } catch (error) {
    console.error('Error:', (error as Error).message)
    process.exit(1)
  }
}

main()
