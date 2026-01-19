use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::state::{AgentIdentity, StakingPool, ProgramConfig, MIN_STAKE_AMOUNT, STAKE_UNLOCK_PERIOD};

// ============================================================================
// STAKE COLLATERAL
// ============================================================================

#[derive(Accounts)]
pub struct StakeCollateral<'info> {
    #[account(
        mut,
        seeds = [AgentIdentity::SEED_PREFIX, agent.key().as_ref()],
        bump = agent_identity.bump,
        has_one = agent_address @ StakingError::UnauthorizedAgent,
    )]
    pub agent_identity: Account<'info, AgentIdentity>,

    #[account(
        mut,
        seeds = [StakingPool::SEED_PREFIX],
        bump = staking_pool.bump,
        constraint = !staking_pool.is_paused @ StakingError::StakingPaused,
    )]
    pub staking_pool: Account<'info, StakingPool>,

    /// CHECK: This is the agent's wallet that must sign
    #[account(mut)]
    pub agent: Signer<'info>,

    /// CHECK: Validated by seed constraint
    pub agent_address: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Stake SOL as collateral for an agent identity
pub fn stake_collateral(ctx: Context<StakeCollateral>, amount: u64) -> Result<()> {
    let agent_identity = &mut ctx.accounts.agent_identity;
    let staking_pool = &mut ctx.accounts.staking_pool;
    let clock = Clock::get()?;

    // Validate minimum stake
    let effective_min = staking_pool.min_stake_amount.max(MIN_STAKE_AMOUNT);
    require!(amount >= effective_min, StakingError::BelowMinimumStake);

    // Check if this is first stake
    let was_staker = agent_identity.staked_amount > 0;

    // Transfer SOL from agent to staking pool PDA
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.agent.to_account_info(),
            to: staking_pool.to_account_info(),
        },
    );
    system_program::transfer(cpi_context, amount)?;

    // Update agent identity with checked arithmetic
    agent_identity.staked_amount = agent_identity
        .staked_amount
        .checked_add(amount)
        .ok_or(StakingError::ArithmeticOverflow)?;

    // Set unlock timestamp (must wait unlock_period to unstake)
    let unlock_period = if staking_pool.unlock_period > 0 {
        staking_pool.unlock_period
    } else {
        STAKE_UNLOCK_PERIOD
    };
    agent_identity.stake_unlock_timestamp = clock
        .unix_timestamp
        .checked_add(unlock_period)
        .ok_or(StakingError::ArithmeticOverflow)?;

    // Update activity timestamp
    agent_identity.last_active_timestamp = clock.unix_timestamp;
    agent_identity.activity_count = agent_identity.activity_count.saturating_add(1);

    // Update staking pool stats
    staking_pool.total_staked = staking_pool
        .total_staked
        .checked_add(amount)
        .ok_or(StakingError::ArithmeticOverflow)?;

    if !was_staker {
        staking_pool.total_stakers = staking_pool.total_stakers.saturating_add(1);
    }

    msg!(
        "Staked {} lamports for agent {}. Total staked: {}",
        amount,
        agent_identity.agent_address,
        agent_identity.staked_amount
    );

    Ok(())
}

// ============================================================================
// UNSTAKE COLLATERAL
// ============================================================================

#[derive(Accounts)]
pub struct UnstakeCollateral<'info> {
    #[account(
        mut,
        seeds = [AgentIdentity::SEED_PREFIX, agent.key().as_ref()],
        bump = agent_identity.bump,
        has_one = agent_address @ StakingError::UnauthorizedAgent,
    )]
    pub agent_identity: Account<'info, AgentIdentity>,

    #[account(
        mut,
        seeds = [StakingPool::SEED_PREFIX],
        bump = staking_pool.bump,
    )]
    pub staking_pool: Account<'info, StakingPool>,

    /// CHECK: This is the agent's wallet that must sign
    #[account(mut)]
    pub agent: Signer<'info>,

    /// CHECK: Validated by seed constraint
    pub agent_address: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Unstake SOL collateral after unlock period
pub fn unstake_collateral(ctx: Context<UnstakeCollateral>, amount: u64) -> Result<()> {
    let agent_identity = &mut ctx.accounts.agent_identity;
    let staking_pool = &mut ctx.accounts.staking_pool;
    let clock = Clock::get()?;

    // Validate unlock period has passed
    require!(
        agent_identity.can_unlock_stake(clock.unix_timestamp),
        StakingError::StakeLocked
    );

    // Validate sufficient stake
    require!(
        agent_identity.staked_amount >= amount,
        StakingError::InsufficientStake
    );

    // Calculate remaining stake after unstake
    let remaining_stake = agent_identity
        .staked_amount
        .checked_sub(amount)
        .ok_or(StakingError::ArithmeticOverflow)?;

    // Transfer SOL from staking pool PDA to agent
    // Use invoke_signed with PDA seeds
    let pool_seeds = &[
        StakingPool::SEED_PREFIX,
        &[staking_pool.bump],
    ];
    let signer_seeds = &[&pool_seeds[..]];

    **staking_pool.to_account_info().try_borrow_mut_lamports()? = staking_pool
        .to_account_info()
        .lamports()
        .checked_sub(amount)
        .ok_or(StakingError::ArithmeticOverflow)?;

    **ctx.accounts.agent.to_account_info().try_borrow_mut_lamports()? = ctx
        .accounts
        .agent
        .to_account_info()
        .lamports()
        .checked_add(amount)
        .ok_or(StakingError::ArithmeticOverflow)?;

    // Update agent identity
    agent_identity.staked_amount = remaining_stake;

    // Reset unlock timestamp if fully unstaked
    if remaining_stake == 0 {
        agent_identity.stake_unlock_timestamp = 0;
        staking_pool.total_stakers = staking_pool.total_stakers.saturating_sub(1);
    }

    // Update activity timestamp
    agent_identity.last_active_timestamp = clock.unix_timestamp;
    agent_identity.activity_count = agent_identity.activity_count.saturating_add(1);

    // Update staking pool stats
    staking_pool.total_staked = staking_pool
        .total_staked
        .checked_sub(amount)
        .ok_or(StakingError::ArithmeticOverflow)?;

    msg!(
        "Unstaked {} lamports for agent {}. Remaining: {}",
        amount,
        agent_identity.agent_address,
        agent_identity.staked_amount
    );

    Ok(())
}

// ============================================================================
// SLASH AGENT (Authority Only)
// ============================================================================

#[derive(Accounts)]
pub struct SlashAgent<'info> {
    #[account(
        mut,
        seeds = [AgentIdentity::SEED_PREFIX, agent_address.key().as_ref()],
        bump = agent_identity.bump,
    )]
    pub agent_identity: Account<'info, AgentIdentity>,

    #[account(
        mut,
        seeds = [StakingPool::SEED_PREFIX],
        bump = staking_pool.bump,
        has_one = authority @ StakingError::UnauthorizedSlash,
    )]
    pub staking_pool: Account<'info, StakingPool>,

    /// CHECK: Agent being slashed (not the signer)
    pub agent_address: UncheckedAccount<'info>,

    /// Authority that can perform slashing
    pub authority: Signer<'info>,

    /// CHECK: Treasury to receive slashed funds
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Slash an agent's stake for violations (authority only)
/// violation_severity_bps: 0-10000 (0% to 100% severity)
pub fn slash_agent(
    ctx: Context<SlashAgent>,
    violation_severity_bps: u16,
    reason: String,
) -> Result<()> {
    let agent_identity = &mut ctx.accounts.agent_identity;
    let staking_pool = &mut ctx.accounts.staking_pool;
    let clock = Clock::get()?;

    // Validate severity
    require!(
        violation_severity_bps <= 10000,
        StakingError::InvalidSlashSeverity
    );

    // Calculate slash amount using quadratic curve
    let slash_amount = agent_identity.calculate_slash_amount(violation_severity_bps);

    // Ensure there's something to slash
    require!(slash_amount > 0, StakingError::NothingToSlash);
    require!(
        agent_identity.staked_amount >= slash_amount,
        StakingError::InsufficientStake
    );

    // Transfer slashed funds to treasury
    **staking_pool.to_account_info().try_borrow_mut_lamports()? = staking_pool
        .to_account_info()
        .lamports()
        .checked_sub(slash_amount)
        .ok_or(StakingError::ArithmeticOverflow)?;

    **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? = ctx
        .accounts
        .treasury
        .to_account_info()
        .lamports()
        .checked_add(slash_amount)
        .ok_or(StakingError::ArithmeticOverflow)?;

    // Update agent identity
    agent_identity.staked_amount = agent_identity
        .staked_amount
        .checked_sub(slash_amount)
        .ok_or(StakingError::ArithmeticOverflow)?;
    agent_identity.slash_count = agent_identity.slash_count.saturating_add(1);
    agent_identity.total_slashed = agent_identity
        .total_slashed
        .checked_add(slash_amount)
        .ok_or(StakingError::ArithmeticOverflow)?;

    // Update staking pool stats
    staking_pool.total_staked = staking_pool
        .total_staked
        .checked_sub(slash_amount)
        .ok_or(StakingError::ArithmeticOverflow)?;
    staking_pool.total_slashed = staking_pool
        .total_slashed
        .checked_add(slash_amount)
        .ok_or(StakingError::ArithmeticOverflow)?;

    // Check if agent is now fully unstaked
    if agent_identity.staked_amount == 0 {
        staking_pool.total_stakers = staking_pool.total_stakers.saturating_sub(1);
    }

    msg!(
        "Slashed {} lamports from agent {} (severity: {}bps). Reason: {}",
        slash_amount,
        agent_identity.agent_address,
        violation_severity_bps,
        reason
    );

    Ok(())
}

// ============================================================================
// INITIALIZE STAKING POOL
// ============================================================================

#[derive(Accounts)]
pub struct InitializeStakingPool<'info> {
    #[account(
        init,
        payer = authority,
        space = StakingPool::LEN,
        seeds = [StakingPool::SEED_PREFIX],
        bump,
    )]
    pub staking_pool: Account<'info, StakingPool>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Initialize the staking pool (one-time setup)
pub fn initialize_staking_pool(ctx: Context<InitializeStakingPool>) -> Result<()> {
    let staking_pool = &mut ctx.accounts.staking_pool;

    staking_pool.authority = ctx.accounts.authority.key();
    staking_pool.total_staked = 0;
    staking_pool.total_stakers = 0;
    staking_pool.total_slashed = 0;
    staking_pool.min_stake_amount = MIN_STAKE_AMOUNT;
    staking_pool.unlock_period = STAKE_UNLOCK_PERIOD;
    staking_pool.is_paused = false;
    staking_pool.bump = ctx.bumps.staking_pool;

    msg!("Staking pool initialized with authority: {}", staking_pool.authority);

    Ok(())
}

// ============================================================================
// PAUSE/UNPAUSE STAKING
// ============================================================================

#[derive(Accounts)]
pub struct PauseStaking<'info> {
    #[account(
        mut,
        seeds = [StakingPool::SEED_PREFIX],
        bump = staking_pool.bump,
        has_one = authority @ StakingError::UnauthorizedSlash,
    )]
    pub staking_pool: Account<'info, StakingPool>,

    pub authority: Signer<'info>,
}

/// Pause staking (emergency)
pub fn pause_staking(ctx: Context<PauseStaking>) -> Result<()> {
    ctx.accounts.staking_pool.is_paused = true;
    msg!("Staking paused by authority");
    Ok(())
}

/// Unpause staking
pub fn unpause_staking(ctx: Context<PauseStaking>) -> Result<()> {
    ctx.accounts.staking_pool.is_paused = false;
    msg!("Staking unpaused by authority");
    Ok(())
}

// ============================================================================
// ERROR CODES
// ============================================================================

#[error_code]
pub enum StakingError {
    #[msg("Amount below minimum stake requirement")]
    BelowMinimumStake,

    #[msg("Stake is still locked, wait for unlock period")]
    StakeLocked,

    #[msg("Insufficient staked amount")]
    InsufficientStake,

    #[msg("Unauthorized: not the agent owner")]
    UnauthorizedAgent,

    #[msg("Unauthorized: not the staking authority")]
    UnauthorizedSlash,

    #[msg("Staking is currently paused")]
    StakingPaused,

    #[msg("Invalid slash severity (must be 0-10000)")]
    InvalidSlashSeverity,

    #[msg("Nothing to slash (stake is 0 or slash amount is 0)")]
    NothingToSlash,

    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}
