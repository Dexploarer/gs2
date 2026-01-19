use anchor_lang::prelude::*;
use crate::state::AgentIdentity;

#[derive(Accounts)]
pub struct UpdateIdentity<'info> {
    #[account(
        mut,
        seeds = [AgentIdentity::SEED_PREFIX, agent.key().as_ref()],
        bump = agent_identity.bump,
        has_one = agent_address @ IdentityError::UnauthorizedUpdate
    )]
    pub agent_identity: Account<'info, AgentIdentity>,

    #[account(mut)]
    pub agent: Signer<'info>,

    /// CHECK: This is the agent_address stored in agent_identity
    pub agent_address: UncheckedAccount<'info>,
}

pub fn handler(
    ctx: Context<UpdateIdentity>,
    metadata_uri: String,
) -> Result<()> {
    require!(
        metadata_uri.len() <= 200,
        IdentityError::MetadataUriTooLong
    );

    require!(
        ctx.accounts.agent_identity.is_active,
        IdentityError::IdentityDeactivated
    );

    let agent_identity = &mut ctx.accounts.agent_identity;
    let clock = Clock::get()?;

    agent_identity.metadata_uri = metadata_uri;
    agent_identity.last_active_timestamp = clock.unix_timestamp;
    agent_identity.activity_count = agent_identity.activity_count.saturating_add(1);

    msg!("Agent identity updated: {}", ctx.accounts.agent.key());

    Ok(())
}

#[error_code]
pub enum IdentityError {
    #[msg("Metadata URI exceeds maximum length of 200 characters")]
    MetadataUriTooLong,
    #[msg("Identity is deactivated and cannot be updated")]
    IdentityDeactivated,
    #[msg("Unauthorized: signer is not the agent owner")]
    UnauthorizedUpdate,
}
