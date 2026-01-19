use anchor_lang::prelude::*;

use crate::state::StakingVault;
use crate::error::TokenStakingError;

#[derive(Accounts)]
pub struct UpdateVault<'info> {
    #[account(
        mut,
        seeds = [
            StakingVault::SEED_PREFIX,
            vault.target_agent.as_ref(),
            vault.token_mint.as_ref()
        ],
        bump = vault.bump,
        has_one = authority @ TokenStakingError::UnauthorizedAuthority,
    )]
    pub vault: Account<'info, StakingVault>,

    pub authority: Signer<'info>,
}

/// Update vault configuration
pub fn update_vault_config(
    ctx: Context<UpdateVault>,
    min_stake_amount: Option<u64>,
    lock_period_seconds: Option<i64>,
    weight_multiplier: Option<u16>,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    if let Some(min_stake) = min_stake_amount {
        vault.min_stake_amount = min_stake.max(1);
        msg!("Updated min stake to {}", vault.min_stake_amount);
    }

    if let Some(lock_period) = lock_period_seconds {
        require!(
            lock_period > 0 && lock_period <= StakingVault::MAX_LOCK_PERIOD,
            TokenStakingError::InvalidLockPeriod
        );
        vault.lock_period_seconds = lock_period;
        msg!("Updated lock period to {}s", lock_period);
    }

    if let Some(multiplier) = weight_multiplier {
        require!(
            multiplier >= 10 && multiplier <= 1000,
            TokenStakingError::InvalidWeightMultiplier
        );
        vault.weight_multiplier = multiplier;
        msg!("Updated weight multiplier to {}", multiplier);
    }

    vault.updated_at = clock.unix_timestamp;

    Ok(())
}

/// Pause the vault (stop accepting new stakes)
pub fn pause_vault(ctx: Context<UpdateVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    vault.is_active = false;
    vault.updated_at = clock.unix_timestamp;

    msg!("Vault paused for agent {}", vault.target_agent);
    Ok(())
}

/// Unpause the vault (resume accepting stakes)
pub fn unpause_vault(ctx: Context<UpdateVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    vault.is_active = true;
    vault.updated_at = clock.unix_timestamp;

    msg!("Vault unpaused for agent {}", vault.target_agent);
    Ok(())
}

#[derive(Accounts)]
pub struct TransferVaultAuthority<'info> {
    #[account(
        mut,
        seeds = [
            StakingVault::SEED_PREFIX,
            vault.target_agent.as_ref(),
            vault.token_mint.as_ref()
        ],
        bump = vault.bump,
        has_one = authority @ TokenStakingError::UnauthorizedAuthority,
    )]
    pub vault: Account<'info, StakingVault>,

    pub authority: Signer<'info>,

    /// CHECK: New authority to transfer to
    pub new_authority: UncheckedAccount<'info>,
}

/// Transfer vault authority to new owner
pub fn transfer_authority(ctx: Context<TransferVaultAuthority>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    let old_authority = vault.authority;
    vault.authority = ctx.accounts.new_authority.key();
    vault.updated_at = clock.unix_timestamp;

    msg!(
        "Transferred vault authority from {} to {}",
        old_authority,
        vault.authority
    );
    Ok(())
}
