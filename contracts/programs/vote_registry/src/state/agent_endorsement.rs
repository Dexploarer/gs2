use anchor_lang::prelude::*;

/// Endorsement category
#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum EndorsementCategory {
    Technical,      // Technical expertise
    Reliability,    // Consistent uptime/availability
    Quality,        // High-quality outputs
    Trustworthy,    // Honest, ethical behavior
    Collaborative,  // Good to work with
}

/// Agent Endorsement Account
/// PDA seeds: ["endorsement", endorser, endorsed]
#[account]
#[derive(InitSpace)]
pub struct AgentEndorsement {
    /// Endorser agent
    pub endorser: Pubkey,

    /// Endorsed agent
    pub endorsed: Pubkey,

    /// Endorsement strength (0-100)
    pub strength: u8,

    /// Endorsement category
    pub category: EndorsementCategory,

    /// Timestamp of endorsement
    pub timestamp: i64,

    /// Endorser's reputation at time of endorsement
    pub endorser_reputation_snapshot: u16,

    /// Stake locked for this endorsement (in lamports)
    pub stake_amount: u64,

    /// Whether endorsement is active
    pub is_active: bool,

    /// PDA bump
    pub bump: u8,
}

impl AgentEndorsement {
    /// Seed prefix for PDA derivation
    pub const SEED_PREFIX: &'static [u8] = b"endorsement";

    /// Minimum stake required (0.01 SOL)
    pub const MIN_STAKE: u64 = 10_000_000; // 0.01 SOL in lamports

    /// Calculate space for rent
    pub const LEN: usize = 8 + // discriminator
        32 + // endorser
        32 + // endorsed
        1 + // strength
        1 + // category (enum)
        8 + // timestamp
        2 + // endorser_reputation_snapshot
        8 + // stake_amount
        1 + // is_active
        1; // bump
}
