use anchor_lang::prelude::*;
use crate::state::{
    MultisigAuthority, MultisigProposal, AgentReputation,
    ProposalType, ProposalStatus, ComponentScores, ReputationStats,
    MAX_MULTISIG_SIGNERS,
};
use crate::error::ReputationError;

// ==================== MULTI-SIG ERRORS ====================

#[error_code]
pub enum MultisigError {
    #[msg("Invalid threshold: must be > 0 and <= number of signers")]
    InvalidThreshold,
    #[msg("Maximum number of signers reached")]
    MaxSignersReached,
    #[msg("Signer not found in multisig")]
    SignerNotFound,
    #[msg("Signer already exists in multisig")]
    SignerAlreadyExists,
    #[msg("Proposal has expired")]
    ProposalExpired,
    #[msg("Proposal already executed")]
    ProposalAlreadyExecuted,
    #[msg("Signer has already approved this proposal")]
    AlreadyApproved,
    #[msg("Not enough approvals to execute")]
    InsufficientApprovals,
    #[msg("Unauthorized: not a multisig signer")]
    UnauthorizedSigner,
    #[msg("Unauthorized: not the admin")]
    UnauthorizedAdmin,
    #[msg("Multisig is paused")]
    MultisigPaused,
    #[msg("Cannot remove signer: would go below threshold")]
    WouldGobelowThreshold,
}

// ==================== INITIALIZE MULTISIG ====================

#[derive(Accounts)]
pub struct InitializeMultisig<'info> {
    #[account(
        init,
        payer = admin,
        space = MultisigAuthority::LEN,
        seeds = [MultisigAuthority::SEED_PREFIX],
        bump
    )]
    pub multisig: Account<'info, MultisigAuthority>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Initialize multi-sig authority with initial signers and threshold
pub fn initialize_multisig(
    ctx: Context<InitializeMultisig>,
    signers: Vec<Pubkey>,
    threshold: u8,
) -> Result<()> {
    require!(
        !signers.is_empty() && signers.len() <= MAX_MULTISIG_SIGNERS,
        MultisigError::MaxSignersReached
    );
    require!(
        threshold > 0 && threshold as usize <= signers.len(),
        MultisigError::InvalidThreshold
    );

    let clock = Clock::get()?;
    let multisig = &mut ctx.accounts.multisig;

    multisig.signers = signers;
    multisig.threshold = threshold;
    multisig.proposal_count = 0;
    multisig.admin = ctx.accounts.admin.key();
    multisig.is_active = true;
    multisig.created_at = clock.unix_timestamp;
    multisig.bump = ctx.bumps.multisig;

    msg!("Multi-sig authority initialized with {} signers, threshold {}",
         multisig.signers.len(), threshold);

    Ok(())
}

// ==================== PROPOSE REPUTATION UPDATE ====================

#[derive(Accounts)]
pub struct ProposeReputationUpdate<'info> {
    #[account(
        mut,
        seeds = [MultisigAuthority::SEED_PREFIX],
        bump = multisig.bump
    )]
    pub multisig: Account<'info, MultisigAuthority>,

    #[account(
        init,
        payer = proposer,
        space = MultisigProposal::LEN,
        seeds = [
            MultisigProposal::SEED_PREFIX,
            &multisig.proposal_count.to_le_bytes()
        ],
        bump
    )]
    pub proposal: Account<'info, MultisigProposal>,

    /// The agent reputation account to update
    #[account(
        seeds = [AgentReputation::SEED_PREFIX, target_agent.key().as_ref()],
        bump = agent_reputation.bump
    )]
    pub agent_reputation: Account<'info, AgentReputation>,

    /// CHECK: The agent address being updated
    pub target_agent: UncheckedAccount<'info>,

    #[account(mut)]
    pub proposer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Propose a reputation update (must be a multisig signer)
pub fn propose_reputation_update(
    ctx: Context<ProposeReputationUpdate>,
    overall_score: u16,
    component_scores: ComponentScores,
    stats: ReputationStats,
    merkle_root: [u8; 32],
) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;
    let proposal = &mut ctx.accounts.proposal;

    // Verify proposer is a signer
    require!(multisig.is_active, MultisigError::MultisigPaused);
    let signer_index = multisig.signers
        .iter()
        .position(|s| s == ctx.accounts.proposer.key)
        .ok_or(MultisigError::UnauthorizedSigner)?;

    let clock = Clock::get()?;

    // Initialize proposal
    proposal.proposal_id = multisig.proposal_count;
    proposal.proposal_type = ProposalType::UpdateReputation;
    proposal.proposer = ctx.accounts.proposer.key();
    proposal.target_agent = ctx.accounts.target_agent.key();
    proposal.proposed_score = overall_score;
    proposal.proposed_components = component_scores;
    proposal.proposed_stats = stats;
    proposal.proposed_merkle_root = merkle_root;
    proposal.target_signer = Pubkey::default();
    proposal.new_threshold = 0;
    proposal.approval_bitmap = 0;
    proposal.approval_count = 0;
    proposal.status = ProposalStatus::Pending;
    proposal.created_at = clock.unix_timestamp;
    proposal.executed_at = 0;
    proposal.bump = ctx.bumps.proposal;

    // Auto-approve by proposer
    proposal.record_approval(signer_index as u8);

    // Increment proposal count
    multisig.proposal_count = multisig.proposal_count.checked_add(1)
        .ok_or(ReputationError::ArithmeticOverflow)?;

    msg!("Proposal {} created by signer {}", proposal.proposal_id, signer_index);

    Ok(())
}

// ==================== APPROVE PROPOSAL ====================

#[derive(Accounts)]
#[instruction(proposal_id: u64)]
pub struct ApproveProposal<'info> {
    #[account(
        seeds = [MultisigAuthority::SEED_PREFIX],
        bump = multisig.bump
    )]
    pub multisig: Account<'info, MultisigAuthority>,

    #[account(
        mut,
        seeds = [
            MultisigProposal::SEED_PREFIX,
            &proposal_id.to_le_bytes()
        ],
        bump = proposal.bump,
        constraint = proposal.status == ProposalStatus::Pending @ MultisigError::ProposalAlreadyExecuted
    )]
    pub proposal: Account<'info, MultisigProposal>,

    pub signer: Signer<'info>,
}

/// Approve a pending proposal
pub fn approve_proposal(
    ctx: Context<ApproveProposal>,
    _proposal_id: u64,
) -> Result<()> {
    let multisig = &ctx.accounts.multisig;
    let proposal = &mut ctx.accounts.proposal;
    let clock = Clock::get()?;

    // Check proposal hasn't expired
    require!(!proposal.is_expired(clock.unix_timestamp), MultisigError::ProposalExpired);
    require!(multisig.is_active, MultisigError::MultisigPaused);

    // Verify signer is in multisig
    let signer_index = multisig.signers
        .iter()
        .position(|s| s == ctx.accounts.signer.key)
        .ok_or(MultisigError::UnauthorizedSigner)?;

    // Check not already approved
    require!(
        !proposal.has_approved(signer_index as u8),
        MultisigError::AlreadyApproved
    );

    // Record approval
    proposal.record_approval(signer_index as u8);

    // Check if we reached quorum
    if proposal.has_quorum(multisig.threshold) {
        proposal.status = ProposalStatus::Approved;
        msg!("Proposal {} approved with {} signatures", proposal.proposal_id, proposal.approval_count);
    } else {
        msg!("Proposal {} has {}/{} approvals",
             proposal.proposal_id, proposal.approval_count, multisig.threshold);
    }

    Ok(())
}

// ==================== EXECUTE REPUTATION PROPOSAL ====================

#[derive(Accounts)]
#[instruction(proposal_id: u64)]
pub struct ExecuteReputationProposal<'info> {
    #[account(
        seeds = [MultisigAuthority::SEED_PREFIX],
        bump = multisig.bump
    )]
    pub multisig: Account<'info, MultisigAuthority>,

    #[account(
        mut,
        seeds = [
            MultisigProposal::SEED_PREFIX,
            &proposal_id.to_le_bytes()
        ],
        bump = proposal.bump,
        constraint = proposal.status == ProposalStatus::Approved @ MultisigError::InsufficientApprovals,
        constraint = proposal.proposal_type == ProposalType::UpdateReputation @ ReputationError::InvalidAuthority
    )]
    pub proposal: Account<'info, MultisigProposal>,

    #[account(
        mut,
        seeds = [AgentReputation::SEED_PREFIX, proposal.target_agent.as_ref()],
        bump = agent_reputation.bump
    )]
    pub agent_reputation: Account<'info, AgentReputation>,

    pub executor: Signer<'info>,
}

/// Execute an approved reputation update proposal
pub fn execute_reputation_proposal(
    ctx: Context<ExecuteReputationProposal>,
    _proposal_id: u64,
) -> Result<()> {
    let multisig = &ctx.accounts.multisig;
    let proposal = &mut ctx.accounts.proposal;
    let reputation = &mut ctx.accounts.agent_reputation;
    let clock = Clock::get()?;

    // Verify executor is a signer (anyone can execute approved proposals)
    require!(multisig.is_active, MultisigError::MultisigPaused);
    require!(
        multisig.signers.contains(ctx.accounts.executor.key),
        MultisigError::UnauthorizedSigner
    );

    // Apply the reputation update
    reputation.overall_score = proposal.proposed_score;
    reputation.component_scores = proposal.proposed_components;
    reputation.stats = proposal.proposed_stats;
    reputation.payment_proofs_merkle_root = proposal.proposed_merkle_root;
    reputation.last_updated = clock.unix_timestamp;

    // Mark proposal as executed
    proposal.status = ProposalStatus::Executed;
    proposal.executed_at = clock.unix_timestamp;

    msg!("Proposal {} executed: agent {} reputation updated to {}",
         proposal.proposal_id, reputation.agent_address, reputation.overall_score);

    Ok(())
}

// ==================== ADD SIGNER ====================

#[derive(Accounts)]
pub struct AddSigner<'info> {
    #[account(
        mut,
        seeds = [MultisigAuthority::SEED_PREFIX],
        bump = multisig.bump,
        constraint = multisig.admin == admin.key() @ MultisigError::UnauthorizedAdmin
    )]
    pub multisig: Account<'info, MultisigAuthority>,

    pub admin: Signer<'info>,
}

/// Add a new signer to the multisig (admin only)
pub fn add_signer(
    ctx: Context<AddSigner>,
    new_signer: Pubkey,
) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;

    require!(
        multisig.signers.len() < MAX_MULTISIG_SIGNERS,
        MultisigError::MaxSignersReached
    );
    require!(
        !multisig.signers.contains(&new_signer),
        MultisigError::SignerAlreadyExists
    );

    multisig.signers.push(new_signer);

    msg!("Added signer {} to multisig (total: {})", new_signer, multisig.signers.len());

    Ok(())
}

// ==================== REMOVE SIGNER ====================

#[derive(Accounts)]
pub struct RemoveSigner<'info> {
    #[account(
        mut,
        seeds = [MultisigAuthority::SEED_PREFIX],
        bump = multisig.bump,
        constraint = multisig.admin == admin.key() @ MultisigError::UnauthorizedAdmin
    )]
    pub multisig: Account<'info, MultisigAuthority>,

    pub admin: Signer<'info>,
}

/// Remove a signer from the multisig (admin only)
pub fn remove_signer(
    ctx: Context<RemoveSigner>,
    signer_to_remove: Pubkey,
) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;

    // Find signer index
    let index = multisig.signers
        .iter()
        .position(|s| *s == signer_to_remove)
        .ok_or(MultisigError::SignerNotFound)?;

    // Ensure we don't go below threshold
    require!(
        multisig.signers.len() > multisig.threshold as usize,
        MultisigError::WouldGobelowThreshold
    );

    multisig.signers.remove(index);

    msg!("Removed signer {} from multisig (remaining: {})",
         signer_to_remove, multisig.signers.len());

    Ok(())
}

// ==================== UPDATE THRESHOLD ====================

#[derive(Accounts)]
pub struct UpdateThreshold<'info> {
    #[account(
        mut,
        seeds = [MultisigAuthority::SEED_PREFIX],
        bump = multisig.bump,
        constraint = multisig.admin == admin.key() @ MultisigError::UnauthorizedAdmin
    )]
    pub multisig: Account<'info, MultisigAuthority>,

    pub admin: Signer<'info>,
}

/// Update the approval threshold (admin only)
pub fn update_threshold(
    ctx: Context<UpdateThreshold>,
    new_threshold: u8,
) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;

    require!(
        new_threshold > 0 && new_threshold as usize <= multisig.signers.len(),
        MultisigError::InvalidThreshold
    );

    let old_threshold = multisig.threshold;
    multisig.threshold = new_threshold;

    msg!("Threshold updated from {} to {}", old_threshold, new_threshold);

    Ok(())
}

// ==================== PAUSE/UNPAUSE MULTISIG ====================

#[derive(Accounts)]
pub struct PauseMultisig<'info> {
    #[account(
        mut,
        seeds = [MultisigAuthority::SEED_PREFIX],
        bump = multisig.bump,
        constraint = multisig.admin == admin.key() @ MultisigError::UnauthorizedAdmin
    )]
    pub multisig: Account<'info, MultisigAuthority>,

    pub admin: Signer<'info>,
}

/// Pause the multisig (emergency only)
pub fn pause_multisig(ctx: Context<PauseMultisig>) -> Result<()> {
    ctx.accounts.multisig.is_active = false;
    msg!("Multi-sig paused by admin");
    Ok(())
}

/// Unpause the multisig
pub fn unpause_multisig(ctx: Context<PauseMultisig>) -> Result<()> {
    ctx.accounts.multisig.is_active = true;
    msg!("Multi-sig unpaused by admin");
    Ok(())
}
