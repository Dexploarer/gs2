use anchor_lang::prelude::*;
use crate::state::ValidationAuthority;

#[derive(Accounts)]
pub struct InitializeAuthority<'info> {
    #[account(
        init,
        payer = initializer,
        space = ValidationAuthority::LEN,
        seeds = [ValidationAuthority::SEED_PREFIX],
        bump
    )]
    pub authority_account: Account<'info, ValidationAuthority>,

    /// The initial authority (typically deployer)
    /// CHECK: Can be any pubkey initially
    pub authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub initializer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeAuthority>) -> Result<()> {
    let authority_account = &mut ctx.accounts.authority_account;

    authority_account.authority = ctx.accounts.authority.key();
    authority_account.bump = ctx.bumps.authority_account;

    msg!("Validation authority initialized: {}", authority_account.authority);

    Ok(())
}
