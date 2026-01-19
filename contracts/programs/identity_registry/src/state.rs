use anchor_lang::prelude::*;

// ============================================================================
// CONSTANTS (2026 Best Practices)
// ============================================================================

/// Minimum stake amount: 0.1 SOL (100_000_000 lamports)
pub const MIN_STAKE_AMOUNT: u64 = 100_000_000;

/// Stake unlock period: 7 days in seconds
pub const STAKE_UNLOCK_PERIOD: i64 = 7 * 24 * 60 * 60;

/// Maximum slash percentage: 50% (5000 basis points)
pub const MAX_SLASH_BPS: u16 = 5000;

// ============================================================================
// AGENT IDENTITY (Enhanced with Staking)
// ============================================================================

/// Agent Identity Account
/// PDA seeds: ["agent", agent_address]
#[account]
#[derive(InitSpace)]
pub struct AgentIdentity {
    /// The agent's wallet address (owner)
    pub agent_address: Pubkey,

    /// Metaplex Core NFT asset address
    pub asset_address: Pubkey,

    /// URI pointing to off-chain metadata (Arweave/IPFS)
    #[max_len(200)]
    pub metadata_uri: String,

    /// Unix timestamp of registration
    pub registration_timestamp: i64,

    /// Last time the agent was active (any instruction call)
    pub last_active_timestamp: i64,

    /// Total number of on-chain interactions
    pub activity_count: u64,

    /// Whether the identity is active
    pub is_active: bool,

    // ========== STAKING FIELDS (2026 Enhancement) ==========

    /// Amount of SOL staked as collateral (lamports)
    pub staked_amount: u64,

    /// Timestamp when stake can be unlocked (0 if not staking)
    pub stake_unlock_timestamp: i64,

    /// Number of times this agent has been slashed
    pub slash_count: u32,

    /// Total amount slashed historically (lamports)
    pub total_slashed: u64,

    /// PDA bump seed
    pub bump: u8,
}

impl AgentIdentity {
    /// Seed prefix for PDA derivation
    pub const SEED_PREFIX: &'static [u8] = b"agent";

    /// Calculate space for rent (updated with staking fields)
    pub const LEN: usize = 8 + // discriminator
        32 + // agent_address
        32 + // asset_address
        4 + 200 + // metadata_uri (String with max 200 chars)
        8 + // registration_timestamp
        8 + // last_active_timestamp
        8 + // activity_count
        1 + // is_active
        8 + // staked_amount
        8 + // stake_unlock_timestamp
        4 + // slash_count
        8 + // total_slashed
        1; // bump

    /// Check if agent has minimum stake
    pub fn has_minimum_stake(&self) -> bool {
        self.staked_amount >= MIN_STAKE_AMOUNT
    }

    /// Check if stake can be unlocked
    pub fn can_unlock_stake(&self, current_timestamp: i64) -> bool {
        self.stake_unlock_timestamp > 0 && current_timestamp >= self.stake_unlock_timestamp
    }

    /// Calculate slash amount using quadratic curve (2026 best practice)
    /// - 5% violation → ~0.25% slashed
    /// - 33% violation → ~11% slashed
    /// - 70% violation → 49% slashed (capped at MAX_SLASH_BPS)
    pub fn calculate_slash_amount(&self, violation_severity_bps: u16) -> u64 {
        // Quadratic slashing: slash_pct = (severity_bps / 10000)^2 * 100%
        // Capped at MAX_SLASH_BPS
        // All arithmetic uses checked/saturating operations for safety
        let severity = violation_severity_bps.min(10000) as u64;
        let slash_bps = severity
            .saturating_mul(severity)
            .saturating_div(10000)
            .min(MAX_SLASH_BPS as u64);

        // Apply to staked amount (checked arithmetic)
        self.staked_amount
            .checked_mul(slash_bps)
            .and_then(|v| v.checked_div(10000))
            .unwrap_or(0)
    }
}

// ============================================================================
// STAKING POOL (Global Configuration)
// ============================================================================

/// Global staking configuration
/// PDA seeds: ["staking_pool"]
#[account]
#[derive(InitSpace)]
pub struct StakingPool {
    /// Authority that can configure the pool
    pub authority: Pubkey,

    /// Total amount staked across all agents (lamports)
    pub total_staked: u64,

    /// Total number of active stakers
    pub total_stakers: u32,

    /// Total amount slashed historically (lamports)
    pub total_slashed: u64,

    /// Minimum stake amount (can be adjusted by authority)
    pub min_stake_amount: u64,

    /// Unlock period in seconds (can be adjusted by authority)
    pub unlock_period: i64,

    /// Whether staking is paused (emergency)
    pub is_paused: bool,

    /// PDA bump seed
    pub bump: u8,
}

impl StakingPool {
    /// Seed prefix for PDA derivation
    pub const SEED_PREFIX: &'static [u8] = b"staking_pool";

    /// Calculate space for rent
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        8 + // total_staked
        4 + // total_stakers
        8 + // total_slashed
        8 + // min_stake_amount
        8 + // unlock_period
        1 + // is_paused
        1; // bump
}

// ============================================================================
// PROGRAM CONFIG (Emergency Pause & Rate Limiting)
// ============================================================================

/// Program-wide configuration for pause and rate limiting
/// PDA seeds: ["program_config"]
#[account]
#[derive(InitSpace)]
pub struct ProgramConfig {
    /// Admin authority for program-wide operations
    pub admin: Pubkey,

    /// Whether the entire program is paused
    pub is_paused: bool,

    /// Timestamp when pause was activated (0 if not paused)
    pub paused_at: i64,

    /// Reason for pause (e.g., "Security incident detected")
    #[max_len(100)]
    pub pause_reason: String,

    /// Maximum instructions per user per minute
    pub rate_limit_per_minute: u32,

    /// PDA bump seed
    pub bump: u8,
}

impl ProgramConfig {
    /// Seed prefix for PDA derivation
    pub const SEED_PREFIX: &'static [u8] = b"program_config";

    /// Calculate space for rent
    pub const LEN: usize = 8 + // discriminator
        32 + // admin
        1 + // is_paused
        8 + // paused_at
        4 + 100 + // pause_reason
        4 + // rate_limit_per_minute
        1; // bump

    /// Default rate limit: 60 instructions per minute
    pub const DEFAULT_RATE_LIMIT: u32 = 60;
}

// ============================================================================
// USER RATE LIMIT (Per-User Throttling)
// ============================================================================

/// Per-user rate limiting state
/// PDA seeds: ["rate_limit", user_address]
#[account]
#[derive(InitSpace)]
pub struct UserRateLimit {
    /// User's wallet address
    pub user: Pubkey,

    /// Timestamp of rate limit window start
    pub window_start: i64,

    /// Number of instructions in current window
    pub instruction_count: u32,

    /// Last instruction timestamp
    pub last_instruction: i64,

    /// PDA bump seed
    pub bump: u8,
}

impl UserRateLimit {
    /// Seed prefix for PDA derivation
    pub const SEED_PREFIX: &'static [u8] = b"rate_limit";

    /// Calculate space for rent
    pub const LEN: usize = 8 + // discriminator
        32 + // user
        8 + // window_start
        4 + // instruction_count
        8 + // last_instruction
        1; // bump

    /// Window size: 60 seconds
    pub const WINDOW_SIZE: i64 = 60;

    /// Check if rate limit is exceeded
    pub fn is_rate_limited(&self, current_timestamp: i64, max_per_minute: u32) -> bool {
        // If window has passed, reset
        if current_timestamp - self.window_start >= Self::WINDOW_SIZE {
            return false;
        }
        self.instruction_count >= max_per_minute
    }

    /// Update rate limit state
    pub fn record_instruction(&mut self, current_timestamp: i64) {
        // Reset window if needed
        if current_timestamp - self.window_start >= Self::WINDOW_SIZE {
            self.window_start = current_timestamp;
            self.instruction_count = 0;
        }
        self.instruction_count = self.instruction_count.saturating_add(1);
        self.last_instruction = current_timestamp;
    }
}
