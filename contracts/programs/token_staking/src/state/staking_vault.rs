use anchor_lang::prelude::*;

/// Configuration for a staking vault (registered SPL token)
/// One vault per target agent per token
/// PDA seeds: ["vault", target_agent, token_mint]
#[account]
#[derive(InitSpace)]
pub struct StakingVault {
    /// The agent/merchant who owns this vault (receives the endorsements)
    pub target_agent: Pubkey,

    /// The SPL token mint accepted by this vault
    pub token_mint: Pubkey,

    /// Token vault account (PDA-controlled ATA)
    pub vault_token_account: Pubkey,

    /// Minimum stake amount (in token's smallest unit)
    pub min_stake_amount: u64,

    /// Lock period in seconds
    pub lock_period_seconds: i64,

    /// Weight multiplier for trust calculation (100 = 1x, 200 = 2x, etc.)
    pub weight_multiplier: u16,

    /// Total tokens staked in this vault
    pub total_staked: u64,

    /// Total number of stakers
    pub total_stakers: u32,

    /// Authority who can modify vault settings
    pub authority: Pubkey,

    /// Whether the vault is accepting new stakes
    pub is_active: bool,

    /// Whether the vault has been verified by platform
    pub is_verified: bool,

    /// Creation timestamp
    pub created_at: i64,

    /// Last update timestamp
    pub updated_at: i64,

    /// PDA bump
    pub bump: u8,

    /// Vault token account bump
    pub vault_bump: u8,
}

impl StakingVault {
    pub const SEED_PREFIX: &'static [u8] = b"vault";
    pub const VAULT_TOKEN_SEED: &'static [u8] = b"vault_token";

    /// Default minimum stake (1 token, assuming 6 decimals)
    pub const DEFAULT_MIN_STAKE: u64 = 1_000_000;

    /// Default lock period (7 days)
    pub const DEFAULT_LOCK_PERIOD: i64 = 7 * 24 * 60 * 60;

    /// Maximum lock period (365 days)
    pub const MAX_LOCK_PERIOD: i64 = 365 * 24 * 60 * 60;

    /// Space calculation
    pub const LEN: usize = 8 +  // discriminator
        32 +  // target_agent
        32 +  // token_mint
        32 +  // vault_token_account
        8 +   // min_stake_amount
        8 +   // lock_period_seconds
        2 +   // weight_multiplier
        8 +   // total_staked
        4 +   // total_stakers
        32 +  // authority
        1 +   // is_active
        1 +   // is_verified
        8 +   // created_at
        8 +   // updated_at
        1 +   // bump
        1;    // vault_bump

    /// Calculate trust weight from staked amount
    /// Uses log2(amount + 1) * multiplier for diminishing returns
    pub fn calculate_trust_weight(&self, amount: u64) -> u64 {
        let base_weight = (((amount as f64) + 1.0).log2() * 100.0) as u64;
        (base_weight * self.weight_multiplier as u64) / 100
    }
}
