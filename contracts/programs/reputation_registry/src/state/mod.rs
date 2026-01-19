use anchor_lang::prelude::*;

/// Component scores for reputation (0-100 each)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, InitSpace)]
pub struct ComponentScores {
    pub trust: u8,
    pub quality: u8,
    pub reliability: u8,
    pub economic: u8,
    pub social: u8,
}

/// Reputation statistics
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, InitSpace)]
pub struct ReputationStats {
    pub total_votes: u32,
    pub positive_votes: u32,
    pub negative_votes: u32,
    pub total_reviews: u32,
    pub avg_review_rating: u8, // 0-50 (multiplied by 10 for precision)
}

/// Decay configuration constants
pub const DECAY_HALF_LIFE_DAYS: i64 = 90; // Score halves every 90 days of inactivity
pub const DECAY_MIN_SCORE: u16 = 100; // Minimum score after decay
pub const DECAY_GRACE_PERIOD_DAYS: i64 = 30; // No decay for first 30 days
pub const SECONDS_PER_DAY: i64 = 86400;

/// Agent Reputation Account
/// PDA seeds: ["reputation", agent_address]
#[account]
#[derive(InitSpace)]
pub struct AgentReputation {
    /// The agent's wallet address
    pub agent_address: Pubkey,

    /// Overall reputation score (0-1000)
    pub overall_score: u16,

    /// Component scores
    pub component_scores: ComponentScores,

    /// Reputation statistics
    pub stats: ReputationStats,

    /// Merkle root of payment proofs
    pub payment_proofs_merkle_root: [u8; 32],

    /// Last update timestamp
    pub last_updated: i64,

    /// PDA bump seed
    pub bump: u8,

    // ==================== DECAY FIELDS (2026 Enhancement) ====================

    /// Base score before any decay applied
    pub base_score: u16,

    /// Last activity timestamp (transaction, vote, etc.)
    pub last_activity: i64,

    /// Whether decay is enabled for this agent
    pub decay_enabled: bool,

    /// Custom decay rate multiplier (100 = normal, 50 = half decay)
    pub decay_rate_bps: u16,
}

impl AgentReputation {
    /// Seed prefix for PDA derivation
    pub const SEED_PREFIX: &'static [u8] = b"reputation";

    /// Calculate space for rent
    pub const LEN: usize = 8 + // discriminator
        32 + // agent_address
        2 + // overall_score
        5 + // component_scores (5 u8s)
        17 + // stats (4 u32s + 1 u8)
        32 + // payment_proofs_merkle_root
        8 + // last_updated
        1 + // bump
        2 + // base_score
        8 + // last_activity
        1 + // decay_enabled
        2; // decay_rate_bps

    /// Calculate the decayed score based on time since last activity
    /// Uses exponential decay with configurable half-life
    pub fn calculate_decayed_score(&self, current_time: i64) -> u16 {
        // If decay is disabled, return base score
        if !self.decay_enabled {
            return self.base_score;
        }

        // Calculate days since last activity
        let days_inactive = current_time
            .saturating_sub(self.last_activity)
            .saturating_div(SECONDS_PER_DAY);

        // Grace period: no decay
        if days_inactive <= DECAY_GRACE_PERIOD_DAYS {
            return self.base_score;
        }

        // Effective days for decay calculation
        let effective_days = days_inactive.saturating_sub(DECAY_GRACE_PERIOD_DAYS);

        // Apply custom decay rate (default 10000 = 100%)
        let decay_multiplier = self.decay_rate_bps.max(100).min(10000) as i64;

        // Exponential decay: score * 0.5^(days/half_life)
        // Using approximation: score * (1 - decay_factor)^periods
        // Where periods = effective_days / half_life
        let periods = effective_days.saturating_mul(decay_multiplier)
            .saturating_div(DECAY_HALF_LIFE_DAYS.saturating_mul(10000));

        // For each period, multiply by 0.5 (shift right by 1)
        // Clamped to prevent underflow
        let mut decayed = self.base_score as i64;
        for _ in 0..periods.min(10) { // Cap at 10 periods (prevents extreme decay)
            decayed = decayed.saturating_div(2);
        }

        // Apply minimum score floor
        (decayed as u16).max(DECAY_MIN_SCORE)
    }

    /// Record activity to reset decay clock
    pub fn record_activity(&mut self, current_time: i64) {
        self.last_activity = current_time;
    }

    /// Get effective score with decay applied
    pub fn get_effective_score(&self, current_time: i64) -> u16 {
        if self.decay_enabled {
            self.calculate_decayed_score(current_time)
        } else {
            self.overall_score
        }
    }
}

/// Authority configuration for reputation registry
/// PDA seeds: ["authority"]
#[account]
#[derive(InitSpace)]
pub struct ReputationAuthority {
    /// The authority wallet that can update reputations
    pub authority: Pubkey,

    /// PDA bump seed
    pub bump: u8,
}

impl ReputationAuthority {
    /// Seed prefix for PDA derivation
    pub const SEED_PREFIX: &'static [u8] = b"authority";

    /// Calculate space for rent
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        1; // bump
}

// ==================== MULTI-SIG AUTHORITY (2026 Best Practice) ====================

/// Maximum number of signers in multi-sig (3-of-5 or 5-of-7 typical)
pub const MAX_MULTISIG_SIGNERS: usize = 7;

/// Maximum pending proposals
pub const MAX_PENDING_PROPOSALS: usize = 10;

/// Proposal expiry time (48 hours)
pub const PROPOSAL_EXPIRY_SECONDS: i64 = 48 * 60 * 60;

/// Multi-sig Authority Configuration
/// PDA seeds: ["multisig_authority"]
#[account]
#[derive(InitSpace)]
pub struct MultisigAuthority {
    /// List of authorized signers (up to MAX_MULTISIG_SIGNERS)
    #[max_len(7)]
    pub signers: Vec<Pubkey>,

    /// Number of signatures required to execute (threshold)
    pub threshold: u8,

    /// Total proposals created (for unique proposal IDs)
    pub proposal_count: u64,

    /// Admin who can add/remove signers (initially the deployer)
    pub admin: Pubkey,

    /// Whether multi-sig is active
    pub is_active: bool,

    /// Creation timestamp
    pub created_at: i64,

    /// PDA bump seed
    pub bump: u8,
}

impl MultisigAuthority {
    pub const SEED_PREFIX: &'static [u8] = b"multisig_authority";

    pub const LEN: usize = 8 + // discriminator
        4 + (32 * MAX_MULTISIG_SIGNERS) + // signers vec
        1 + // threshold
        8 + // proposal_count
        32 + // admin
        1 + // is_active
        8 + // created_at
        1; // bump
}

/// Proposal types for multi-sig approval
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ProposalType {
    /// Update agent reputation scores
    UpdateReputation,
    /// Add a new signer to multi-sig
    AddSigner,
    /// Remove a signer from multi-sig
    RemoveSigner,
    /// Update threshold requirement
    UpdateThreshold,
    /// Emergency pause
    EmergencyPause,
}

/// Proposal status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Default)]
pub enum ProposalStatus {
    #[default]
    Pending,
    Approved,
    Executed,
    Rejected,
    Expired,
}

/// Multi-sig Proposal Account
/// PDA seeds: ["proposal", proposal_id.to_le_bytes()]
#[account]
#[derive(InitSpace)]
pub struct MultisigProposal {
    /// Unique proposal ID
    pub proposal_id: u64,

    /// Type of proposal
    pub proposal_type: ProposalType,

    /// Proposer address
    pub proposer: Pubkey,

    /// Agent address (for reputation updates)
    pub target_agent: Pubkey,

    /// Proposed overall score (for reputation updates)
    pub proposed_score: u16,

    /// Proposed component scores (for reputation updates)
    pub proposed_components: ComponentScores,

    /// Proposed stats (for reputation updates)
    pub proposed_stats: ReputationStats,

    /// Proposed merkle root (for reputation updates)
    pub proposed_merkle_root: [u8; 32],

    /// For AddSigner/RemoveSigner: the signer address
    pub target_signer: Pubkey,

    /// For UpdateThreshold: the new threshold value
    pub new_threshold: u8,

    /// Signers who have approved (bitmap for efficiency)
    pub approval_bitmap: u8,

    /// Number of approvals received
    pub approval_count: u8,

    /// Current status
    pub status: ProposalStatus,

    /// Creation timestamp
    pub created_at: i64,

    /// Execution timestamp (if executed)
    pub executed_at: i64,

    /// PDA bump seed
    pub bump: u8,
}

impl MultisigProposal {
    pub const SEED_PREFIX: &'static [u8] = b"proposal";

    pub const LEN: usize = 8 + // discriminator
        8 + // proposal_id
        1 + // proposal_type
        32 + // proposer
        32 + // target_agent
        2 + // proposed_score
        5 + // proposed_components
        17 + // proposed_stats
        32 + // proposed_merkle_root
        32 + // target_signer
        1 + // new_threshold
        1 + // approval_bitmap
        1 + // approval_count
        1 + // status
        8 + // created_at
        8 + // executed_at
        1; // bump

    /// Check if a signer has already approved (using bitmap)
    pub fn has_approved(&self, signer_index: u8) -> bool {
        (self.approval_bitmap & (1 << signer_index)) != 0
    }

    /// Record approval from signer
    pub fn record_approval(&mut self, signer_index: u8) {
        self.approval_bitmap |= 1 << signer_index;
        self.approval_count = self.approval_count.saturating_add(1);
    }

    /// Check if proposal has expired
    pub fn is_expired(&self, current_time: i64) -> bool {
        current_time > self.created_at.saturating_add(PROPOSAL_EXPIRY_SECONDS)
    }

    /// Check if proposal has enough approvals
    pub fn has_quorum(&self, threshold: u8) -> bool {
        self.approval_count >= threshold
    }
}
