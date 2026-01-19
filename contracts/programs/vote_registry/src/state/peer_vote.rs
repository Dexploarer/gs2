use anchor_lang::prelude::*;

/// Vote type for peer voting
#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum VoteType {
    Upvote,      // Positive experience
    Downvote,    // Negative experience
    Neutral,     // Mixed/neutral experience
}

/// Quality scores for peer voting (0-100 each)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, InitSpace)]
pub struct QualityScores {
    pub response_quality: u8,    // 0-100: How good was the output?
    pub response_speed: u8,       // 0-100: How fast was response?
    pub accuracy: u8,             // 0-100: Was output accurate?
    pub professionalism: u8,      // 0-100: Professional behavior?
}

/// Peer Vote Account
/// PDA seeds: ["peer_vote", transaction_receipt.key()]
#[account]
#[derive(InitSpace)]
pub struct PeerVote {
    /// Voter agent (must have active identity)
    pub voter: Pubkey,

    /// Agent being voted on
    pub voted_agent: Pubkey,

    /// Vote type
    pub vote_type: VoteType,

    /// Quality scores (0-100 each)
    pub quality_scores: QualityScores,

    /// Optional comment hash (stored off-chain, hash on-chain)
    pub comment_hash: [u8; 32],

    /// Timestamp of vote
    pub timestamp: i64,

    /// Voter's reputation at time of vote (for weighting)
    pub voter_reputation_snapshot: u16,

    /// Transaction receipt that proves interaction
    pub transaction_receipt: Pubkey,

    /// Vote weight based on transaction amount (100 = 1.0x)
    pub vote_weight: u16,

    /// PDA bump
    pub bump: u8,
}

impl PeerVote {
    /// Seed prefix for PDA derivation
    pub const SEED_PREFIX: &'static [u8] = b"peer_vote";

    /// Calculate space for rent
    pub const LEN: usize = 8 + // discriminator
        32 + // voter
        32 + // voted_agent
        1 + // vote_type (enum with 3 variants)
        4 + // quality_scores (4 u8s)
        32 + // comment_hash
        8 + // timestamp
        2 + // voter_reputation_snapshot
        32 + // transaction_receipt
        2 + // vote_weight
        1; // bump

    /// Calculate vote weight based on transaction amount
    ///
    /// x402 Reality: Payments range from $0.001 (single API call) to ~$1.00 (extended service)
    /// Average payment: ~$0.078 (7.8 cents)
    ///
    /// Strategy: Equal weight for all transactions
    /// - Every transaction = 1.0x weight (100)
    /// - Reputation reflects service quality, not payment size
    /// - Micropayments are the norm, not the exception
    ///
    /// Returns constant weight of 100 (1.0x) for all transactions
    pub fn calculate_vote_weight(_transaction_amount: u64) -> u16 {
        // Constant weight: 1 transaction = 1 vote
        // Amount is recorded but doesn't affect vote power
        100
    }
}
