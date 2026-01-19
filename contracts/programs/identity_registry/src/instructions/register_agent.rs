use anchor_lang::prelude::*;
use crate::state::AgentIdentity;

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = agent,
        space = AgentIdentity::LEN,
        seeds = [AgentIdentity::SEED_PREFIX, agent.key().as_ref()],
        bump
    )]
    pub agent_identity: Account<'info, AgentIdentity>,

    #[account(mut)]
    pub agent: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterAgent>,
    asset_address: Pubkey,
    metadata_uri: String,
) -> Result<()> {
    require!(
        metadata_uri.len() <= 200,
        IdentityError::MetadataUriTooLong
    );

    let agent_identity = &mut ctx.accounts.agent_identity;
    let clock = Clock::get()?;

    agent_identity.agent_address = ctx.accounts.agent.key();
    agent_identity.asset_address = asset_address;
    agent_identity.metadata_uri = metadata_uri;
    agent_identity.registration_timestamp = clock.unix_timestamp;
    agent_identity.last_active_timestamp = clock.unix_timestamp;
    agent_identity.activity_count = 1;
    agent_identity.is_active = true;
    agent_identity.bump = ctx.bumps.agent_identity;

    msg!("Agent identity registered: {}", ctx.accounts.agent.key());
    msg!("NFT asset address: {}", asset_address);

    Ok(())
}

#[error_code]
pub enum IdentityError {
    #[msg("Metadata URI exceeds maximum length of 200 characters")]
    MetadataUriTooLong,
}
