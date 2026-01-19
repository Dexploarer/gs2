use anchor_lang::prelude::*;
use crate::state::AgentIdentity;

#[derive(Accounts)]
pub struct DeactivateAgent<'info> {
    #[account(
        mut,
        seeds = [AgentIdentity::SEED_PREFIX, agent.key().as_ref()],
        bump = agent_identity.bump,
        has_one = agent_address @ IdentityError::UnauthorizedDeactivation
    )]
    pub agent_identity: Account<'info, AgentIdentity>,

    #[account(mut)]
    pub agent: Signer<'info>,

    /// CHECK: This is the agent_address stored in agent_identity
    pub agent_address: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<DeactivateAgent>) -> Result<()> {
    require!(
        ctx.accounts.agent_identity.is_active,
        IdentityError::AlreadyDeactivated
    );

    let agent_identity = &mut ctx.accounts.agent_identity;
    let clock = Clock::get()?;

    agent_identity.is_active = false;
    agent_identity.last_active_timestamp = clock.unix_timestamp;
    agent_identity.activity_count = agent_identity.activity_count.saturating_add(1);

    msg!("Agent identity deactivated: {}", ctx.accounts.agent.key());

    Ok(())
}

#[error_code]
pub enum IdentityError {
    #[msg("Identity is already deactivated")]
    AlreadyDeactivated,
    #[msg("Unauthorized: signer is not the agent owner")]
    UnauthorizedDeactivation,
}
