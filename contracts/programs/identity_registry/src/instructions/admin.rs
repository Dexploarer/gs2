use anchor_lang::prelude::*;
use crate::state::{ProgramConfig, UserRateLimit};

// ==================== ADMIN ERRORS ====================

#[error_code]
pub enum AdminError {
    #[msg("Program is paused")]
    ProgramPaused,
    #[msg("Unauthorized: not the admin")]
    UnauthorizedAdmin,
    #[msg("Rate limit exceeded")]
    RateLimitExceeded,
    #[msg("Invalid rate limit configuration")]
    InvalidRateLimit,
    #[msg("Pause reason too long (max 128 chars)")]
    PauseReasonTooLong,
}

// ==================== INITIALIZE PROGRAM CONFIG ====================

#[derive(Accounts)]
pub struct InitializeProgramConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = ProgramConfig::LEN,
        seeds = [ProgramConfig::SEED_PREFIX],
        bump
    )]
    pub config: Account<'info, ProgramConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Initialize program configuration (admin, pause state, rate limits)
pub fn initialize_program_config(
    ctx: Context<InitializeProgramConfig>,
    rate_limit_per_minute: u32,
) -> Result<()> {
    let config = &mut ctx.accounts.config;

    config.admin = ctx.accounts.admin.key();
    config.is_paused = false;
    config.paused_at = 0;
    config.pause_reason = String::new();
    config.rate_limit_per_minute = rate_limit_per_minute;
    config.bump = ctx.bumps.config;

    msg!("Program config initialized by {}", config.admin);

    Ok(())
}

// ==================== PAUSE PROGRAM ====================

#[derive(Accounts)]
pub struct PauseProgram<'info> {
    #[account(
        mut,
        seeds = [ProgramConfig::SEED_PREFIX],
        bump = config.bump,
        constraint = config.admin == admin.key() @ AdminError::UnauthorizedAdmin
    )]
    pub config: Account<'info, ProgramConfig>,

    pub admin: Signer<'info>,
}

/// Pause all program operations (emergency only)
pub fn pause_program(ctx: Context<PauseProgram>, reason: String) -> Result<()> {
    require!(reason.len() <= 128, AdminError::PauseReasonTooLong);

    let config = &mut ctx.accounts.config;
    let clock = Clock::get()?;

    config.is_paused = true;
    config.paused_at = clock.unix_timestamp;
    config.pause_reason = reason.clone();

    msg!("Program paused at {}: {}", clock.unix_timestamp, reason);

    Ok(())
}

/// Unpause program operations
pub fn unpause_program(ctx: Context<PauseProgram>) -> Result<()> {
    let config = &mut ctx.accounts.config;

    config.is_paused = false;
    config.paused_at = 0;
    config.pause_reason = String::new();

    msg!("Program unpaused by {}", config.admin);

    Ok(())
}

// ==================== UPDATE RATE LIMIT ====================

#[derive(Accounts)]
pub struct UpdateRateLimit<'info> {
    #[account(
        mut,
        seeds = [ProgramConfig::SEED_PREFIX],
        bump = config.bump,
        constraint = config.admin == admin.key() @ AdminError::UnauthorizedAdmin
    )]
    pub config: Account<'info, ProgramConfig>,

    pub admin: Signer<'info>,
}

/// Update the global rate limit
pub fn update_rate_limit(
    ctx: Context<UpdateRateLimit>,
    rate_limit_per_minute: u32,
) -> Result<()> {
    require!(rate_limit_per_minute > 0, AdminError::InvalidRateLimit);

    let config = &mut ctx.accounts.config;
    let old_limit = config.rate_limit_per_minute;
    config.rate_limit_per_minute = rate_limit_per_minute;

    msg!("Rate limit updated: {} -> {}", old_limit, rate_limit_per_minute);

    Ok(())
}

// ==================== INITIALIZE USER RATE LIMIT ====================

#[derive(Accounts)]
pub struct InitializeUserRateLimit<'info> {
    #[account(
        init,
        payer = user,
        space = UserRateLimit::LEN,
        seeds = [UserRateLimit::SEED_PREFIX, user.key().as_ref()],
        bump
    )]
    pub rate_limit: Account<'info, UserRateLimit>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Initialize user rate limit tracking account
pub fn initialize_user_rate_limit(ctx: Context<InitializeUserRateLimit>) -> Result<()> {
    let rate_limit = &mut ctx.accounts.rate_limit;
    let clock = Clock::get()?;

    rate_limit.user = ctx.accounts.user.key();
    rate_limit.window_start = clock.unix_timestamp;
    rate_limit.instruction_count = 0;
    rate_limit.last_instruction = clock.unix_timestamp;
    rate_limit.bump = ctx.bumps.rate_limit;

    msg!("Rate limit tracking initialized for {}", rate_limit.user);

    Ok(())
}

// ==================== CHECK RATE LIMIT ====================

#[derive(Accounts)]
pub struct CheckRateLimit<'info> {
    #[account(
        seeds = [ProgramConfig::SEED_PREFIX],
        bump = config.bump
    )]
    pub config: Account<'info, ProgramConfig>,

    #[account(
        mut,
        seeds = [UserRateLimit::SEED_PREFIX, user.key().as_ref()],
        bump = rate_limit.bump
    )]
    pub rate_limit: Account<'info, UserRateLimit>,

    pub user: Signer<'info>,
}

/// Rate limit window duration (60 seconds)
const RATE_LIMIT_WINDOW_SECONDS: i64 = 60;

/// Check and update rate limit before operation
/// Returns Ok(()) if within limit, Err if exceeded
pub fn check_rate_limit(ctx: Context<CheckRateLimit>) -> Result<()> {
    let config = &ctx.accounts.config;
    let rate_limit = &mut ctx.accounts.rate_limit;
    let clock = Clock::get()?;

    // Check if program is paused
    require!(!config.is_paused, AdminError::ProgramPaused);

    // Check if we're in a new window
    let window_elapsed = clock.unix_timestamp.saturating_sub(rate_limit.window_start);

    if window_elapsed >= RATE_LIMIT_WINDOW_SECONDS {
        // Reset window
        rate_limit.window_start = clock.unix_timestamp;
        rate_limit.instruction_count = 1;
    } else {
        // Check if within limit
        require!(
            rate_limit.instruction_count < config.rate_limit_per_minute,
            AdminError::RateLimitExceeded
        );
        rate_limit.instruction_count = rate_limit.instruction_count.saturating_add(1);
    }

    rate_limit.last_instruction = clock.unix_timestamp;

    Ok(())
}

// ==================== TRANSFER ADMIN ====================

#[derive(Accounts)]
pub struct TransferAdmin<'info> {
    #[account(
        mut,
        seeds = [ProgramConfig::SEED_PREFIX],
        bump = config.bump,
        constraint = config.admin == current_admin.key() @ AdminError::UnauthorizedAdmin
    )]
    pub config: Account<'info, ProgramConfig>,

    pub current_admin: Signer<'info>,

    /// CHECK: The new admin address
    pub new_admin: UncheckedAccount<'info>,
}

/// Transfer admin rights to a new address
pub fn transfer_admin(ctx: Context<TransferAdmin>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let old_admin = config.admin;
    config.admin = ctx.accounts.new_admin.key();

    msg!("Admin transferred: {} -> {}", old_admin, config.admin);

    Ok(())
}

// ==================== HELPER: CHECK PAUSE STATE ====================

/// Helper to check if program is paused (can be called from other instructions)
pub fn require_not_paused(config: &Account<ProgramConfig>) -> Result<()> {
    require!(!config.is_paused, AdminError::ProgramPaused);
    Ok(())
}
