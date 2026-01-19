use anchor_lang::prelude::*;

declare_id!("2pELseyWXsBRXWBEPZAMqXsyBsRKADAz6LhSgV8Szc2e");

pub mod instructions;
pub mod state;

use instructions::*;

#[program]
pub mod identity_registry {
    use super::*;

    /// Register a new agent identity linked to a Metaplex Core NFT
    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        asset_address: Pubkey,
        metadata_uri: String,
    ) -> Result<()> {
        instructions::register_agent::handler(ctx, asset_address, metadata_uri)
    }

    /// Update agent identity metadata URI
    pub fn update_identity(
        ctx: Context<UpdateIdentity>,
        metadata_uri: String,
    ) -> Result<()> {
        instructions::update_identity::handler(ctx, metadata_uri)
    }

    /// Verify agent identity exists and is active
    pub fn verify_identity(ctx: Context<VerifyIdentity>) -> Result<()> {
        instructions::verify_identity::handler(ctx)
    }

    /// Deactivate an agent identity (emergency use)
    pub fn deactivate_agent(ctx: Context<DeactivateAgent>) -> Result<()> {
        instructions::deactivate_agent::handler(ctx)
    }

    // ==================== STAKING INSTRUCTIONS ====================

    /// Initialize the global staking pool (admin only, one-time setup)
    pub fn initialize_staking_pool(ctx: Context<InitializeStakingPool>) -> Result<()> {
        instructions::stake::initialize_staking_pool(ctx)
    }

    /// Stake SOL collateral to increase agent trust score
    pub fn stake_collateral(ctx: Context<StakeCollateral>, amount: u64) -> Result<()> {
        instructions::stake::stake_collateral(ctx, amount)
    }

    /// Unstake SOL collateral after unlock period
    pub fn unstake_collateral(ctx: Context<UnstakeCollateral>, amount: u64) -> Result<()> {
        instructions::stake::unstake_collateral(ctx, amount)
    }

    /// Slash agent stake for protocol violations (authority only)
    pub fn slash_agent(
        ctx: Context<SlashAgent>,
        violation_severity_bps: u16,
        reason: String,
    ) -> Result<()> {
        instructions::stake::slash_agent(ctx, violation_severity_bps, reason)
    }

    /// Pause staking operations (emergency only)
    pub fn pause_staking(ctx: Context<PauseStaking>) -> Result<()> {
        instructions::stake::pause_staking(ctx)
    }

    /// Resume staking operations after pause
    pub fn unpause_staking(ctx: Context<PauseStaking>) -> Result<()> {
        instructions::stake::unpause_staking(ctx)
    }

    // ==================== ADMIN INSTRUCTIONS (Pause & Rate Limiting) ====================

    /// Initialize program configuration (admin only, one-time)
    pub fn initialize_program_config(
        ctx: Context<InitializeProgramConfig>,
        rate_limit_per_minute: u32,
    ) -> Result<()> {
        instructions::admin::initialize_program_config(ctx, rate_limit_per_minute)
    }

    /// Pause all program operations (emergency)
    pub fn pause_program(ctx: Context<PauseProgram>, reason: String) -> Result<()> {
        instructions::admin::pause_program(ctx, reason)
    }

    /// Resume program operations
    pub fn unpause_program(ctx: Context<PauseProgram>) -> Result<()> {
        instructions::admin::unpause_program(ctx)
    }

    /// Update the global rate limit
    pub fn update_rate_limit(
        ctx: Context<UpdateRateLimit>,
        rate_limit_per_minute: u32,
    ) -> Result<()> {
        instructions::admin::update_rate_limit(ctx, rate_limit_per_minute)
    }

    /// Initialize user rate limit tracking
    pub fn initialize_user_rate_limit(ctx: Context<InitializeUserRateLimit>) -> Result<()> {
        instructions::admin::initialize_user_rate_limit(ctx)
    }

    /// Check and update rate limit (call before operations)
    pub fn check_rate_limit(ctx: Context<CheckRateLimit>) -> Result<()> {
        instructions::admin::check_rate_limit(ctx)
    }

    /// Transfer admin rights
    pub fn transfer_admin(ctx: Context<TransferAdmin>) -> Result<()> {
        instructions::admin::transfer_admin(ctx)
    }
}
