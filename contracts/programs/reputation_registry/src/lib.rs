pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use error::*;
pub use instructions::*;
pub use state::*;

declare_id!("A99rMj3Nu975ShFzyhPyae9raBPxDYQiwi8g6RPC73Mp");

#[program]
pub mod reputation_registry {
    use super::*;

    /// Initialize the authority account (one-time setup)
    pub fn initialize_authority(ctx: Context<InitializeAuthority>) -> Result<()> {
        instructions::initialize_authority::handler(ctx)
    }

    /// Initialize reputation account for a registered agent
    pub fn initialize_reputation(ctx: Context<InitializeReputation>) -> Result<()> {
        instructions::initialize_reputation::handler(ctx)
    }

    /// Update reputation scores with Merkle proof verification
    pub fn update_reputation(
        ctx: Context<UpdateReputation>,
        overall_score: u16,
        component_scores: ComponentScores,
        stats: ReputationStats,
        payment_proofs_merkle_root: [u8; 32],
    ) -> Result<()> {
        instructions::update_reputation::handler(
            ctx,
            overall_score,
            component_scores,
            stats,
            payment_proofs_merkle_root,
        )
    }

    /// Record a verified payment proof
    pub fn record_payment_proof(
        ctx: Context<RecordPaymentProof>,
        payment_signature: String,
    ) -> Result<()> {
        instructions::record_payment_proof::handler(ctx, payment_signature)
    }

    /// Get reputation data (view function)
    pub fn get_reputation(ctx: Context<GetReputation>) -> Result<()> {
        instructions::get_reputation::handler(ctx)
    }

    // ==================== MULTI-SIG INSTRUCTIONS ====================

    /// Initialize multi-sig authority with signers and threshold
    pub fn initialize_multisig(
        ctx: Context<InitializeMultisig>,
        signers: Vec<Pubkey>,
        threshold: u8,
    ) -> Result<()> {
        instructions::multisig::initialize_multisig(ctx, signers, threshold)
    }

    /// Propose a reputation update (requires multisig approval)
    pub fn propose_reputation_update(
        ctx: Context<ProposeReputationUpdate>,
        overall_score: u16,
        component_scores: ComponentScores,
        stats: ReputationStats,
        merkle_root: [u8; 32],
    ) -> Result<()> {
        instructions::multisig::propose_reputation_update(
            ctx, overall_score, component_scores, stats, merkle_root
        )
    }

    /// Approve a pending proposal
    pub fn approve_proposal(
        ctx: Context<ApproveProposal>,
        proposal_id: u64,
    ) -> Result<()> {
        instructions::multisig::approve_proposal(ctx, proposal_id)
    }

    /// Execute an approved reputation proposal
    pub fn execute_reputation_proposal(
        ctx: Context<ExecuteReputationProposal>,
        proposal_id: u64,
    ) -> Result<()> {
        instructions::multisig::execute_reputation_proposal(ctx, proposal_id)
    }

    /// Add a signer to multisig (admin only)
    pub fn add_signer(ctx: Context<AddSigner>, new_signer: Pubkey) -> Result<()> {
        instructions::multisig::add_signer(ctx, new_signer)
    }

    /// Remove a signer from multisig (admin only)
    pub fn remove_signer(ctx: Context<RemoveSigner>, signer_to_remove: Pubkey) -> Result<()> {
        instructions::multisig::remove_signer(ctx, signer_to_remove)
    }

    /// Update the approval threshold (admin only)
    pub fn update_threshold(ctx: Context<UpdateThreshold>, new_threshold: u8) -> Result<()> {
        instructions::multisig::update_threshold(ctx, new_threshold)
    }

    /// Pause multisig (emergency only)
    pub fn pause_multisig(ctx: Context<PauseMultisig>) -> Result<()> {
        instructions::multisig::pause_multisig(ctx)
    }

    /// Unpause multisig
    pub fn unpause_multisig(ctx: Context<PauseMultisig>) -> Result<()> {
        instructions::multisig::unpause_multisig(ctx)
    }

    // ==================== DECAY INSTRUCTIONS ====================

    /// Apply time-weighted decay to an agent's reputation (permissionless)
    pub fn apply_decay(ctx: Context<ApplyDecay>) -> Result<()> {
        instructions::decay::apply_decay(ctx)
    }

    /// Enable decay for agent reputation (agent owner only)
    pub fn enable_decay(ctx: Context<EnableDecay>, decay_rate_bps: u16) -> Result<()> {
        instructions::decay::enable_decay(ctx, decay_rate_bps)
    }

    /// Disable decay for agent reputation (agent owner only)
    pub fn disable_decay(ctx: Context<DisableDecay>) -> Result<()> {
        instructions::decay::disable_decay(ctx)
    }

    /// Record activity to reset decay clock (agent owner only)
    pub fn record_activity(ctx: Context<RecordActivity>) -> Result<()> {
        instructions::decay::record_activity(ctx)
    }

    /// Get effective score with decay applied (view function)
    pub fn get_effective_score(ctx: Context<GetEffectiveScore>) -> Result<u16> {
        instructions::decay::get_effective_score(ctx)
    }
}
