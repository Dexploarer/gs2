use anchor_lang::prelude::*;

/// Endorsement category for token stakes
#[derive(Debug, AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum StakeCategory {
    General,        // General endorsement
    Quality,        // High-quality outputs
    Reliability,    // Dependable & responsive
    Capability,     // Verified capabilities
    Security,       // Security best practices
}

impl Default for StakeCategory {
    fn default() -> Self {
        Self::General
    }
}

/// Individual stake position
/// PDA seeds: ["stake", vault, staker]
#[account]
#[derive(InitSpace)]
pub struct StakePosition {
    /// The vault this stake belongs to
    pub vault: Pubkey,

    /// The staker (endorser)
    pub staker: Pubkey,

    /// Target agent being endorsed
    pub target_agent: Pubkey,

    /// Token mint
    pub token_mint: Pubkey,

    /// Amount staked
    pub amount: u64,

    /// Endorsement category
    pub category: StakeCategory,

    /// Calculated trust weight at time of staking
    pub trust_weight: u64,

    /// When the stake was created
    pub staked_at: i64,

    /// When the stake can be unlocked
    pub locked_until: i64,

    /// When the stake was withdrawn (0 if still active)
    pub unstaked_at: i64,

    /// Whether the stake is active
    pub is_active: bool,

    /// Whether the stake has been slashed
    pub is_slashed: bool,

    /// PDA bump
    pub bump: u8,
}

impl StakePosition {
    pub const SEED_PREFIX: &'static [u8] = b"stake";

    pub const LEN: usize = 8 +  // discriminator
        32 +  // vault
        32 +  // staker
        32 +  // target_agent
        32 +  // token_mint
        8 +   // amount
        1 +   // category
        8 +   // trust_weight
        8 +   // staked_at
        8 +   // locked_until
        8 +   // unstaked_at
        1 +   // is_active
        1 +   // is_slashed
        1;    // bump

    /// Check if the stake can be unlocked
    pub fn can_unlock(&self, current_timestamp: i64) -> bool {
        self.is_active && current_timestamp >= self.locked_until
    }
}
