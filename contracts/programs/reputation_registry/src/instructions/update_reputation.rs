use anchor_lang::prelude::*;
use crate::state::{AgentReputation, ComponentScores, ReputationStats, ReputationAuthority};
use crate::error::ReputationError;

#[derive(Accounts)]
pub struct UpdateReputation<'info> {
    #[account(
        mut,
        seeds = [AgentReputation::SEED_PREFIX, agent_address.key().as_ref()],
        bump = agent_reputation.bump
    )]
    pub agent_reputation: Account<'info, AgentReputation>,

    #[account(
        seeds = [ReputationAuthority::SEED_PREFIX],
        bump = authority_account.bump,
        has_one = authority @ ReputationError::UnauthorizedAuthority
    )]
    pub authority_account: Account<'info, ReputationAuthority>,

    /// CHECK: The agent's wallet address
    pub agent_address: UncheckedAccount<'info>,

    /// Authority that can update reputation
    pub authority: Signer<'info>,
}

pub fn handler(
    ctx: Context<UpdateReputation>,
    overall_score: u16,
    component_scores: ComponentScores,
    stats: ReputationStats,
    payment_proofs_merkle_root: [u8; 32],
) -> Result<()> {
    // Validate overall score
    require!(
        overall_score <= 1000,
        ReputationError::InvalidOverallScore
    );

    // Validate component scores
    require!(
        component_scores.trust <= 100 &&
        component_scores.quality <= 100 &&
        component_scores.reliability <= 100 &&
        component_scores.economic <= 100 &&
        component_scores.social <= 100,
        ReputationError::InvalidComponentScore
    );

    // Validate review rating
    require!(
        stats.avg_review_rating <= 50,
        ReputationError::InvalidReviewRating
    );

    let agent_reputation = &mut ctx.accounts.agent_reputation;
    let clock = Clock::get()?;

    agent_reputation.overall_score = overall_score;
    agent_reputation.component_scores = component_scores;
    agent_reputation.stats = stats;
    agent_reputation.payment_proofs_merkle_root = payment_proofs_merkle_root;
    agent_reputation.last_updated = clock.unix_timestamp;

    msg!("Reputation updated for agent: {}", ctx.accounts.agent_address.key());
    msg!("New overall score: {}", overall_score);

    Ok(())
}
