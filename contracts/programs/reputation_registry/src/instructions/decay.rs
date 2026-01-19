use anchor_lang::prelude::*;
use crate::state::AgentReputation;
use crate::error::ReputationError;

// ==================== DECAY ERRORS ====================

#[error_code]
pub enum DecayError {
    #[msg("Decay is not enabled for this agent")]
    DecayNotEnabled,
    #[msg("Invalid decay rate: must be between 100 and 10000 bps")]
    InvalidDecayRate,
}

// ==================== APPLY DECAY ====================

#[derive(Accounts)]
pub struct ApplyDecay<'info> {
    #[account(
        mut,
        seeds = [AgentReputation::SEED_PREFIX, agent_reputation.agent_address.as_ref()],
        bump = agent_reputation.bump
    )]
    pub agent_reputation: Account<'info, AgentReputation>,

    /// Anyone can trigger decay calculation (permissionless)
    pub caller: Signer<'info>,
}

/// Apply time-weighted decay to an agent's reputation score
/// This is permissionless - anyone can trigger decay calculation
pub fn apply_decay(ctx: Context<ApplyDecay>) -> Result<()> {
    let reputation = &mut ctx.accounts.agent_reputation;
    let clock = Clock::get()?;

    require!(reputation.decay_enabled, DecayError::DecayNotEnabled);

    // Calculate and apply decayed score
    let decayed_score = reputation.calculate_decayed_score(clock.unix_timestamp);
    let previous_score = reputation.overall_score;

    reputation.overall_score = decayed_score;
    reputation.last_updated = clock.unix_timestamp;

    msg!(
        "Decay applied to agent {}: {} -> {}",
        reputation.agent_address,
        previous_score,
        decayed_score
    );

    Ok(())
}

// ==================== ENABLE DECAY ====================

#[derive(Accounts)]
pub struct EnableDecay<'info> {
    #[account(
        mut,
        seeds = [AgentReputation::SEED_PREFIX, agent_reputation.agent_address.as_ref()],
        bump = agent_reputation.bump
    )]
    pub agent_reputation: Account<'info, AgentReputation>,

    /// Must be the agent owner
    #[account(constraint = owner.key() == agent_reputation.agent_address @ ReputationError::UnauthorizedUpdate)]
    pub owner: Signer<'info>,
}

/// Enable decay for an agent's reputation (agent owner only)
pub fn enable_decay(ctx: Context<EnableDecay>, decay_rate_bps: u16) -> Result<()> {
    let reputation = &mut ctx.accounts.agent_reputation;
    let clock = Clock::get()?;

    require!(
        decay_rate_bps >= 100 && decay_rate_bps <= 10000,
        DecayError::InvalidDecayRate
    );

    // Set base score to current score before enabling decay
    reputation.base_score = reputation.overall_score;
    reputation.last_activity = clock.unix_timestamp;
    reputation.decay_enabled = true;
    reputation.decay_rate_bps = decay_rate_bps;
    reputation.last_updated = clock.unix_timestamp;

    msg!(
        "Decay enabled for agent {} with rate {}bps",
        reputation.agent_address,
        decay_rate_bps
    );

    Ok(())
}

// ==================== DISABLE DECAY ====================

#[derive(Accounts)]
pub struct DisableDecay<'info> {
    #[account(
        mut,
        seeds = [AgentReputation::SEED_PREFIX, agent_reputation.agent_address.as_ref()],
        bump = agent_reputation.bump
    )]
    pub agent_reputation: Account<'info, AgentReputation>,

    /// Must be the agent owner
    #[account(constraint = owner.key() == agent_reputation.agent_address @ ReputationError::UnauthorizedUpdate)]
    pub owner: Signer<'info>,
}

/// Disable decay for an agent's reputation (agent owner only)
pub fn disable_decay(ctx: Context<DisableDecay>) -> Result<()> {
    let reputation = &mut ctx.accounts.agent_reputation;
    let clock = Clock::get()?;

    reputation.decay_enabled = false;
    reputation.last_updated = clock.unix_timestamp;

    msg!("Decay disabled for agent {}", reputation.agent_address);

    Ok(())
}

// ==================== RECORD ACTIVITY ====================

#[derive(Accounts)]
pub struct RecordActivity<'info> {
    #[account(
        mut,
        seeds = [AgentReputation::SEED_PREFIX, agent_reputation.agent_address.as_ref()],
        bump = agent_reputation.bump
    )]
    pub agent_reputation: Account<'info, AgentReputation>,

    /// Must be the agent owner or an authorized service
    #[account(constraint = caller.key() == agent_reputation.agent_address @ ReputationError::UnauthorizedUpdate)]
    pub caller: Signer<'info>,
}

/// Record activity to reset the decay clock
/// Called when agent performs verified transactions
pub fn record_activity(ctx: Context<RecordActivity>) -> Result<()> {
    let reputation = &mut ctx.accounts.agent_reputation;
    let clock = Clock::get()?;

    reputation.record_activity(clock.unix_timestamp);
    reputation.last_updated = clock.unix_timestamp;

    // If decay is enabled, recalculate the score with reset timer
    if reputation.decay_enabled {
        // Reset base score to current effective score
        reputation.base_score = reputation.overall_score;
    }

    msg!(
        "Activity recorded for agent {} at {}",
        reputation.agent_address,
        clock.unix_timestamp
    );

    Ok(())
}

// ==================== GET EFFECTIVE SCORE (VIEW) ====================

#[derive(Accounts)]
pub struct GetEffectiveScore<'info> {
    #[account(
        seeds = [AgentReputation::SEED_PREFIX, agent_reputation.agent_address.as_ref()],
        bump = agent_reputation.bump
    )]
    pub agent_reputation: Account<'info, AgentReputation>,
}

/// Get the effective score with decay applied (view function)
pub fn get_effective_score(ctx: Context<GetEffectiveScore>) -> Result<u16> {
    let reputation = &ctx.accounts.agent_reputation;
    let clock = Clock::get()?;

    let effective_score = reputation.get_effective_score(clock.unix_timestamp);

    msg!(
        "Effective score for agent {}: {} (base: {}, decay_enabled: {})",
        reputation.agent_address,
        effective_score,
        reputation.base_score,
        reputation.decay_enabled
    );

    Ok(effective_score)
}
