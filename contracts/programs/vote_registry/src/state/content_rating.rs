use anchor_lang::prelude::*;

/// Content type categories
#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ContentType {
    ApiResponse,
    GeneratedText,
    GeneratedImage,
    GeneratedCode,
    DataFeed,
    Other,
}

/// Content Rating Account
/// PDA seeds: ["content_rating", x402_signature_hash]
#[account]
#[derive(InitSpace)]
pub struct ContentRating {
    /// Agent who produced the content
    pub agent: Pubkey,

    /// Rater (could be another agent or human)
    pub rater: Pubkey,

    /// x402 transaction signature (proof of payment)
    #[max_len(88)]
    pub x402_signature: String,

    /// Content quality rating (0-100)
    pub quality_rating: u8,

    /// Content type (API response, generated text, image, etc.)
    pub content_type: ContentType,

    /// Amount paid in x402 transaction (in lamports)
    pub amount_paid: u64,

    /// Timestamp of rating
    pub timestamp: i64,

    /// Rater's reputation at time of rating (for weighting)
    pub rater_reputation_snapshot: u16,

    /// PDA bump
    pub bump: u8,
}

impl ContentRating {
    /// Seed prefix for PDA derivation
    pub const SEED_PREFIX: &'static [u8] = b"content_rating";

    /// Calculate space for rent
    pub const LEN: usize = 8 + // discriminator
        32 + // agent
        32 + // rater
        4 + 88 + // x402_signature (String with max 88 chars)
        1 + // quality_rating
        1 + // content_type (enum)
        8 + // amount_paid
        8 + // timestamp
        2 + // rater_reputation_snapshot
        1; // bump
}
