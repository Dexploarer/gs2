use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::state::StakingVault;
use crate::error::TokenStakingError;

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    /// The staking vault to create
    #[account(
        init,
        payer = authority,
        space = StakingVault::LEN,
        seeds = [
            StakingVault::SEED_PREFIX,
            target_agent.key().as_ref(),
            token_mint.key().as_ref()
        ],
        bump
    )]
    pub vault: Account<'info, StakingVault>,

    /// The vault's token account (PDA-controlled)
    #[account(
        init,
        payer = authority,
        seeds = [
            StakingVault::VAULT_TOKEN_SEED,
            vault.key().as_ref()
        ],
        bump,
        token::mint = token_mint,
        token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// The SPL token mint for this vault
    pub token_mint: Account<'info, Mint>,

    /// The target agent who will receive endorsements
    /// CHECK: This is just the agent's pubkey, no validation needed
    pub target_agent: UncheckedAccount<'info>,

    /// Authority creating the vault (must be target agent or authorized)
    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

/// Initialize a staking vault for an agent's token
pub fn handler(
    ctx: Context<InitializeVault>,
    min_stake_amount: u64,
    lock_period_seconds: i64,
    weight_multiplier: u16,
) -> Result<()> {
    // Validate lock period
    require!(
        lock_period_seconds > 0 && lock_period_seconds <= StakingVault::MAX_LOCK_PERIOD,
        TokenStakingError::InvalidLockPeriod
    );

    // Validate weight multiplier (10 = 0.1x, 100 = 1x, 1000 = 10x)
    require!(
        weight_multiplier >= 10 && weight_multiplier <= 1000,
        TokenStakingError::InvalidWeightMultiplier
    );

    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    vault.target_agent = ctx.accounts.target_agent.key();
    vault.token_mint = ctx.accounts.token_mint.key();
    vault.vault_token_account = ctx.accounts.vault_token_account.key();
    vault.min_stake_amount = min_stake_amount.max(1); // At least 1 token unit
    vault.lock_period_seconds = lock_period_seconds;
    vault.weight_multiplier = weight_multiplier;
    vault.total_staked = 0;
    vault.total_stakers = 0;
    vault.authority = ctx.accounts.authority.key();
    vault.is_active = true;
    vault.is_verified = false;
    vault.created_at = clock.unix_timestamp;
    vault.updated_at = clock.unix_timestamp;
    vault.bump = ctx.bumps.vault;
    vault.vault_bump = ctx.bumps.vault_token_account;

    msg!(
        "Initialized staking vault for agent {} with token {}",
        vault.target_agent,
        vault.token_mint
    );
    msg!(
        "Min stake: {}, Lock period: {}s, Weight multiplier: {}",
        min_stake_amount,
        lock_period_seconds,
        weight_multiplier
    );

    Ok(())
}
