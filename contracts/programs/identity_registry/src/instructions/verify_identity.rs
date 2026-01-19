use anchor_lang::prelude::*;
use crate::state::AgentIdentity;

#[derive(Accounts)]
pub struct VerifyIdentity<'info> {
    #[account(
        seeds = [AgentIdentity::SEED_PREFIX, agent_address.key().as_ref()],
        bump = agent_identity.bump
    )]
    pub agent_identity: Account<'info, AgentIdentity>,

    /// CHECK: The agent address being verified
    pub agent_address: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<VerifyIdentity>) -> Result<()> {
    let agent_identity = &ctx.accounts.agent_identity;

    require!(
        agent_identity.is_active,
        IdentityError::IdentityNotActive
    );

    msg!("Identity verified for agent: {}", ctx.accounts.agent_address.key());
    msg!("NFT asset: {}", agent_identity.asset_address);
    msg!("Registered at: {}", agent_identity.registration_timestamp);
    msg!("Last active: {}", agent_identity.last_active_timestamp);
    msg!("Activity count: {}", agent_identity.activity_count);

    Ok(())
}

#[error_code]
pub enum IdentityError {
    #[msg("Identity is not active")]
    IdentityNotActive,
}
