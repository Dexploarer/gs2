use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{AgentEndorsement, EndorsementCategory};
use crate::error::VoteError;

/// External AgentIdentity account structure (from identity_registry)
#[account]
pub struct AgentIdentity {
    pub agent_address: Pubkey,
    pub asset_address: Pubkey,
    pub metadata_uri: String,
    pub registration_timestamp: i64,
    pub last_active_timestamp: i64,
    pub activity_count: u64,
    pub is_active: bool,
    pub bump: u8,
}

/// External AgentReputation account structure (from reputation_registry)
#[account]
pub struct AgentReputation {
    pub agent_address: Pubkey,
    pub overall_score: u16,
}

#[derive(Accounts)]
#[instruction(endorsed_agent: Pubkey)]
pub struct EndorseAgent<'info> {
    #[account(
        init,
        payer = endorser,
        space = AgentEndorsement::LEN,
        seeds = [
            AgentEndorsement::SEED_PREFIX,
            endorser.key().as_ref(),
            endorsed_agent.as_ref()
        ],
        bump
    )]
    pub endorsement: Account<'info, AgentEndorsement>,

    /// Endorser's identity (must be active)
    /// CHECK: Validated via seeds and is_active check
    #[account(
        seeds = [b"agent", endorser.key().as_ref()],
        bump,
        seeds::program = identity_registry_program.key()
    )]
    pub endorser_identity: AccountInfo<'info>,

    /// Endorser's reputation (must be >= 500)
    /// CHECK: Validated via seeds and reputation check
    #[account(
        seeds = [b"reputation", endorser.key().as_ref()],
        bump,
        seeds::program = reputation_registry_program.key()
    )]
    pub endorser_reputation: AccountInfo<'info>,

    /// Endorsed agent's identity (must be active)
    /// CHECK: Validated via seeds and is_active check
    #[account(
        seeds = [b"agent", endorsed_agent.as_ref()],
        bump,
        seeds::program = identity_registry_program.key()
    )]
    pub endorsed_agent_identity: AccountInfo<'info>,

    #[account(mut)]
    pub endorser: Signer<'info>,

    /// CHECK: Identity Registry program
    pub identity_registry_program: AccountInfo<'info>,

    /// CHECK: Reputation Registry program
    pub reputation_registry_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<EndorseAgent>,
    endorsed_agent: Pubkey,
    strength: u8,
    category: EndorsementCategory,
) -> Result<()> {
    // Prevent self-endorsement
    require!(
        ctx.accounts.endorser.key() != endorsed_agent,
        VoteError::SelfEndorsementNotAllowed
    );

    // Validate endorsement strength
    require!(
        strength <= 100,
        VoteError::InvalidEndorsementStrength
    );

    // Deserialize and validate endorser identity
    let endorser_identity_data = &ctx.accounts.endorser_identity.data.borrow();
    let endorser_identity = AgentIdentity::try_deserialize(&mut &endorser_identity_data[..])?;

    require!(
        endorser_identity.is_active,
        VoteError::InactiveVoter
    );

    // Deserialize and validate endorser reputation
    let endorser_reputation_data = &ctx.accounts.endorser_reputation.data.borrow();
    let endorser_reputation = AgentReputation::try_deserialize(&mut &endorser_reputation_data[..])?;

    require!(
        endorser_reputation.overall_score >= 500,
        VoteError::InsufficientEndorserReputation
    );

    // Deserialize and validate endorsed agent identity
    let endorsed_agent_identity_data = &ctx.accounts.endorsed_agent_identity.data.borrow();
    let endorsed_agent_identity = AgentIdentity::try_deserialize(&mut &endorsed_agent_identity_data[..])?;

    require!(
        endorsed_agent_identity.is_active,
        VoteError::EndorsedAgentNotActive
    );

    // Transfer stake to endorsement PDA
    let stake_amount = AgentEndorsement::MIN_STAKE;

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.endorser.to_account_info(),
                to: ctx.accounts.endorsement.to_account_info(),
            },
        ),
        stake_amount,
    )?;

    let endorsement = &mut ctx.accounts.endorsement;
    let clock = Clock::get()?;

    endorsement.endorser = ctx.accounts.endorser.key();
    endorsement.endorsed = endorsed_agent;
    endorsement.strength = strength;
    endorsement.category = category;
    endorsement.timestamp = clock.unix_timestamp;
    endorsement.endorser_reputation_snapshot = endorser_reputation.overall_score;
    endorsement.stake_amount = stake_amount;
    endorsement.is_active = true;
    endorsement.bump = ctx.bumps.endorsement;

    msg!("Agent {} endorsed {} with strength {} in category {:?}",
         ctx.accounts.endorser.key(), endorsed_agent, strength, category);
    msg!("Stake locked: {} lamports", stake_amount);

    Ok(())
}
