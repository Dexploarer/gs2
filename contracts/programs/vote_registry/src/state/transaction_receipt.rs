use anchor_lang::prelude::*;
use super::ContentType;

/// Transaction Receipt Account
/// Created after every x402 payment to enable vote verification
/// PDA seeds: ["tx_receipt", payer, recipient, signature_hash]
#[account]
#[derive(InitSpace)]
pub struct TransactionReceipt {
    /// Transaction signature (x402 payment)
    #[max_len(88)]
    pub signature: String,

    /// Payer (customer/client)
    pub payer: Pubkey,

    /// Recipient (service provider)
    pub recipient: Pubkey,

    /// Amount paid (in lamports)
    pub amount: u64,

    /// Timestamp of transaction
    pub timestamp: i64,

    /// Content type delivered
    pub content_type: ContentType,

    /// Whether a vote has been cast using this receipt
    pub vote_cast: bool,

    /// PDA bump
    pub bump: u8,
}

impl TransactionReceipt {
    /// Seed prefix for PDA derivation
    pub const SEED_PREFIX: &'static [u8] = b"tx_receipt";

    /// Voting window: can only vote within 30 days of transaction
    /// Note: x402 payments are typically micropayments ($0.001 - $1.00)
    /// Any payment amount enables voting to support the micropayment use case
    pub const VOTING_WINDOW_SECONDS: i64 = 30 * 24 * 60 * 60;

    /// Calculate space for rent
    pub const LEN: usize = 8 + // discriminator
        4 + 88 + // signature (String with max 88 chars)
        32 + // payer
        32 + // recipient
        8 + // amount
        8 + // timestamp
        1 + // content_type (enum)
        1 + // vote_cast
        1; // bump
}
