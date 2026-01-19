use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::{StakingVault, StakePosition, StakeCategory};
use crate::error::TokenStakingError;

#[derive(Accounts)]
pub struct StakeTokens<'info> {
    /// The staking vault
    #[account(
        mut,
        seeds = [
            StakingVault::SEED_PREFIX,
            vault.target_agent.as_ref(),
            vault.token_mint.as_ref()
        ],
        bump = vault.bump,
        constraint = vault.is_active @ TokenStakingError::VaultNotActive,
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

    /// Create or update stake position
    #[account(
        init_if_needed,
        payer = staker,
        space = StakePosition::LEN,
        seeds = [
            StakePosition::SEED_PREFIX,
            vault.key().as_ref(),
            staker.key().as_ref()
        ],
        bump
    )]
    pub stake_position: Account<'info, StakePosition>,

    /// Staker's token account
    #[account(
        mut,
        constraint = staker_token_account.mint == vault.token_mint @ TokenStakingError::InvalidTokenMint,
        constraint = staker_token_account.owner == staker.key() @ TokenStakingError::InvalidTokenOwner,
    )]
    pub staker_token_account: Account<'info, TokenAccount>,

    /// The staker (endorser)
    #[account(mut)]
    pub staker: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

/// Stake tokens to endorse an agent
pub fn handler(
    ctx: Context<StakeTokens>,
    amount: u64,
    category: StakeCategory,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let stake_position = &mut ctx.accounts.stake_position;
    let clock = Clock::get()?;

    // Prevent self-staking
    require!(
        ctx.accounts.staker.key() != vault.target_agent,
        TokenStakingError::SelfStakingNotAllowed
    );

    // Validate minimum stake
    require!(
        amount >= vault.min_stake_amount,
        TokenStakingError::BelowMinimumStake
    );

    // Check if this is a new stake or adding to existing
    let is_new_stake = !stake_position.is_active || stake_position.staker == Pubkey::default();

    // Transfer tokens from staker to vault
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.staker_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.staker.to_account_info(),
        },
    );
    token::transfer(transfer_ctx, amount)?;

    // Calculate trust weight
    let total_stake = if is_new_stake {
        amount
    } else {
        stake_position.amount.checked_add(amount)
            .ok_or(TokenStakingError::ArithmeticOverflow)?
    };
    let trust_weight = vault.calculate_trust_weight(total_stake);

    // Calculate lock until timestamp
    let locked_until = clock.unix_timestamp
        .checked_add(vault.lock_period_seconds)
        .ok_or(TokenStakingError::ArithmeticOverflow)?;

    // Update or initialize stake position
    if is_new_stake {
        stake_position.vault = vault.key();
        stake_position.staker = ctx.accounts.staker.key();
        stake_position.target_agent = vault.target_agent;
        stake_position.token_mint = vault.token_mint;
        stake_position.amount = amount;
        stake_position.category = category;
        stake_position.trust_weight = trust_weight;
        stake_position.staked_at = clock.unix_timestamp;
        stake_position.locked_until = locked_until;
        stake_position.unstaked_at = 0;
        stake_position.is_active = true;
        stake_position.is_slashed = false;
        stake_position.bump = ctx.bumps.stake_position;

        // Update vault staker count
        vault.total_stakers = vault.total_stakers.saturating_add(1);
    } else {
        // Adding to existing stake - extend lock period
        stake_position.amount = total_stake;
        stake_position.trust_weight = trust_weight;
        stake_position.locked_until = locked_until; // Reset lock period
        stake_position.category = category; // Update category if changed
    }

    // Update vault totals
    vault.total_staked = vault.total_staked
        .checked_add(amount)
        .ok_or(TokenStakingError::ArithmeticOverflow)?;
    vault.updated_at = clock.unix_timestamp;

    msg!(
        "Staked {} tokens on agent {} (category: {:?})",
        amount,
        vault.target_agent,
        category
    );
    msg!(
        "Total stake: {}, Trust weight: {}, Locked until: {}",
        stake_position.amount,
        trust_weight,
        locked_until
    );

    Ok(())
}
