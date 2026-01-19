use anchor_lang::prelude::*;
use crate::state::{ContentRating, ContentType};
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
#[instruction(x402_signature: String)]
pub struct RateContent<'info> {
    #[account(
        init,
        payer = rater,
        space = ContentRating::LEN,
        seeds = [
            ContentRating::SEED_PREFIX,
            x402_signature.as_bytes()
        ],
        bump
    )]
    pub content_rating: Account<'info, ContentRating>,

    /// Rater's identity (must be active)
    /// CHECK: Validated via seeds and is_active check
    #[account(
        seeds = [b"agent", rater.key().as_ref()],
        bump,
        seeds::program = identity_registry_program.key()
    )]
    pub rater_identity: AccountInfo<'info>,

    /// Rater's reputation (for weighting)
    /// CHECK: Validated via seeds
    #[account(
        seeds = [b"reputation", rater.key().as_ref()],
        bump,
        seeds::program = reputation_registry_program.key()
    )]
    pub rater_reputation: AccountInfo<'info>,

    /// Rated agent's identity (must be active)
    /// CHECK: Validated via seeds and is_active check
    #[account(
        seeds = [b"agent", rated_agent.key().as_ref()],
        bump,
        seeds::program = identity_registry_program.key()
    )]
    pub rated_agent_identity: AccountInfo<'info>,

    /// Agent being rated
    /// CHECK: Validated above
    pub rated_agent: UncheckedAccount<'info>,

    #[account(mut)]
    pub rater: Signer<'info>,

    /// CHECK: Identity Registry program
    pub identity_registry_program: AccountInfo<'info>,

    /// CHECK: Reputation Registry program
    pub reputation_registry_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RateContent>,
    x402_signature: String,
    quality_rating: u8,
    content_type: ContentType,
    amount_paid: u64,
) -> Result<()> {
    // Validate x402 signature length
    require!(
        x402_signature.len() <= 88,
        VoteError::InvalidX402Signature
    );

    // Validate quality rating
    require!(
        quality_rating <= 100,
        VoteError::InvalidContentRating
    );

    // Deserialize and validate rater identity
    let rater_identity_data = &ctx.accounts.rater_identity.data.borrow();
    let rater_identity = AgentIdentity::try_deserialize(&mut &rater_identity_data[..])?;

    require!(
        rater_identity.is_active,
        VoteError::InactiveVoter
    );

    // Deserialize and validate rater reputation
    let rater_reputation_data = &ctx.accounts.rater_reputation.data.borrow();
    let rater_reputation = AgentReputation::try_deserialize(&mut &rater_reputation_data[..])?;

    // Deserialize and validate rated agent identity
    let rated_agent_identity_data = &ctx.accounts.rated_agent_identity.data.borrow();
    let rated_agent_identity = AgentIdentity::try_deserialize(&mut &rated_agent_identity_data[..])?;

    require!(
        rated_agent_identity.is_active,
        VoteError::RatedAgentNotActive
    );

    let content_rating = &mut ctx.accounts.content_rating;
    let clock = Clock::get()?;

    content_rating.agent = ctx.accounts.rated_agent.key();
    content_rating.rater = ctx.accounts.rater.key();
    content_rating.x402_signature = x402_signature.clone();
    content_rating.quality_rating = quality_rating;
    content_rating.content_type = content_type;
    content_rating.amount_paid = amount_paid;
    content_rating.timestamp = clock.unix_timestamp;
    content_rating.rater_reputation_snapshot = rater_reputation.overall_score;
    content_rating.bump = ctx.bumps.content_rating;

    msg!("Content rated: {} by {}", ctx.accounts.rated_agent.key(), ctx.accounts.rater.key());
    msg!("Quality: {}/100, Type: {:?}, Amount: {} lamports", quality_rating, content_type, amount_paid);
    msg!("x402 signature: {}", x402_signature);

    Ok(())
}
