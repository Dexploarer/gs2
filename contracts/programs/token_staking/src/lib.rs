use anchor_lang::prelude::*;

pub mod error;
pub mod instructions;
pub mod state;

pub use error::*;
pub use instructions::*;
pub use state::*;

declare_id!("4JNxNBFEH3BD6VRjQoi2pNDpbEa8L46LKbHnUTrdAWeL");

#[program]
pub mod token_staking {
    use super::*;

    /// Initialize a staking vault for an agent's token
    /// Allows agents to register their SPL tokens for staking-based endorsements
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        min_stake_amount: u64,
        lock_period_seconds: i64,
        weight_multiplier: u16,
    ) -> Result<()> {
        instructions::initialize_vault::handler(
            ctx,
            min_stake_amount,
            lock_period_seconds,
            weight_multiplier,
        )
    }

    /// Stake tokens to endorse an agent
    /// Creates or adds to an existing stake position
    pub fn stake_tokens(
        ctx: Context<StakeTokens>,
        amount: u64,
        category: StakeCategory,
    ) -> Result<()> {
        instructions::stake_tokens::handler(ctx, amount, category)
    }

    /// Unstake tokens after lock period
    /// Can be partial or full withdrawal
    pub fn unstake_tokens(ctx: Context<UnstakeTokens>, amount: u64) -> Result<()> {
        instructions::unstake_tokens::handler(ctx, amount)
    }

    /// Update vault configuration (authority only)
    pub fn update_vault_config(
        ctx: Context<UpdateVault>,
        min_stake_amount: Option<u64>,
        lock_period_seconds: Option<i64>,
        weight_multiplier: Option<u16>,
    ) -> Result<()> {
        instructions::update_vault::update_vault_config(
            ctx,
            min_stake_amount,
            lock_period_seconds,
            weight_multiplier,
        )
    }

    /// Pause the vault (stop accepting new stakes)
    pub fn pause_vault(ctx: Context<UpdateVault>) -> Result<()> {
        instructions::update_vault::pause_vault(ctx)
    }

    /// Unpause the vault (resume accepting stakes)
    pub fn unpause_vault(ctx: Context<UpdateVault>) -> Result<()> {
        instructions::update_vault::unpause_vault(ctx)
    }

    /// Transfer vault authority to new owner
    pub fn transfer_authority(ctx: Context<TransferVaultAuthority>) -> Result<()> {
        instructions::update_vault::transfer_authority(ctx)
    }
}
