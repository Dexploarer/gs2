use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::{StakingVault, StakePosition};
use crate::error::TokenStakingError;

#[derive(Accounts)]
pub struct UnstakeTokens<'info> {
    /// The staking vault
    #[account(
        mut,
        seeds = [
            StakingVault::SEED_PREFIX,
            vault.target_agent.as_ref(),
            vault.token_mint.as_ref()
        ],
        bump = vault.bump,
    )]
    pub vault: Account<'info, StakingVault>,

    /// The vault's token account
    #[account(
        mut,
        seeds = [
            StakingVault::VAULT_TOKEN_SEED,
            vault.key().as_ref()
        ],
        bump = vault.vault_bump,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// The stake position
    #[account(
        mut,
        seeds = [
            StakePosition::SEED_PREFIX,
            vault.key().as_ref(),
            staker.key().as_ref()
        ],
        bump = stake_position.bump,
        constraint = stake_position.is_active @ TokenStakingError::StakeNotActive,
        constraint = stake_position.staker == staker.key() @ TokenStakingError::UnauthorizedStaker,
    )]
    pub stake_position: Account<'info, StakePosition>,

    /// Staker's token account to receive tokens
    #[account(
        mut,
        constraint = staker_token_account.mint == vault.token_mint @ TokenStakingError::InvalidTokenMint,
        constraint = staker_token_account.owner == staker.key() @ TokenStakingError::InvalidTokenOwner,
    )]
    pub staker_token_account: Account<'info, TokenAccount>,

    /// The staker (must be original staker)
    #[account(mut)]
    pub staker: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

/// Unstake tokens after lock period
pub fn handler(ctx: Context<UnstakeTokens>, amount: u64) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let stake_position = &mut ctx.accounts.stake_position;
    let clock = Clock::get()?;

    // Check lock period has passed
    require!(
        stake_position.can_unlock(clock.unix_timestamp),
        TokenStakingError::StakeLocked
    );

    // Validate amount
    require!(
        amount > 0 && amount <= stake_position.amount,
        TokenStakingError::InvalidUnstakeAmount
    );

    // Check if fully unstaking or partial
    let is_full_unstake = amount == stake_position.amount;

    // Transfer tokens from vault to staker using PDA signing
    let target_agent = vault.target_agent;
    let token_mint = vault.token_mint;

    let vault_seeds = &[
        StakingVault::SEED_PREFIX,
        target_agent.as_ref(),
        token_mint.as_ref(),
        &[vault.bump],
    ];
    let signer_seeds = &[&vault_seeds[..]];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.staker_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(transfer_ctx, amount)?;

    // Update stake position
    stake_position.amount = stake_position.amount
        .checked_sub(amount)
        .ok_or(TokenStakingError::ArithmeticOverflow)?;

    if is_full_unstake {
        stake_position.is_active = false;
        stake_position.unstaked_at = clock.unix_timestamp;
        stake_position.trust_weight = 0;

        // Update vault staker count
        let vault = &mut ctx.accounts.vault;
        vault.total_stakers = vault.total_stakers.saturating_sub(1);
    } else {
        // Partial unstake - recalculate trust weight
        let vault = &ctx.accounts.vault;
        stake_position.trust_weight = vault.calculate_trust_weight(stake_position.amount);
    }

    // Update vault totals
    let vault = &mut ctx.accounts.vault;
    vault.total_staked = vault.total_staked
        .checked_sub(amount)
        .ok_or(TokenStakingError::ArithmeticOverflow)?;
    vault.updated_at = clock.unix_timestamp;

    msg!(
        "Unstaked {} tokens from agent {}",
        amount,
        vault.target_agent
    );

    if is_full_unstake {
        msg!("Stake position fully closed");
    } else {
        msg!(
            "Remaining stake: {}, New trust weight: {}",
            stake_position.amount,
            stake_position.trust_weight
        );
    }

    Ok(())
}
