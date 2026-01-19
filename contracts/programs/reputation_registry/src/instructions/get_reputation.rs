use anchor_lang::prelude::*;
use crate::state::AgentReputation;

#[derive(Accounts)]
pub struct GetReputation<'info> {
    #[account(
        seeds = [AgentReputation::SEED_PREFIX, agent_address.key().as_ref()],
        bump = agent_reputation.bump
    )]
    pub agent_reputation: Account<'info, AgentReputation>,

    /// CHECK: The agent's wallet address
    pub agent_address: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<GetReputation>) -> Result<()> {
    let rep = &ctx.accounts.agent_reputation;

    msg!("=== Agent Reputation ===");
    msg!("Agent: {}", rep.agent_address);
    msg!("Overall Score: {}/1000", rep.overall_score);
    msg!("Component Scores:");
    msg!("  Trust: {}/100", rep.component_scores.trust);
    msg!("  Quality: {}/100", rep.component_scores.quality);
    msg!("  Reliability: {}/100", rep.component_scores.reliability);
    msg!("  Economic: {}/100", rep.component_scores.economic);
    msg!("  Social: {}/100", rep.component_scores.social);
    msg!("Statistics:");
    msg!("  Total Votes: {}", rep.stats.total_votes);
    msg!("  Positive Votes: {}", rep.stats.positive_votes);
    msg!("  Negative Votes: {}", rep.stats.negative_votes);
    msg!("  Total Reviews: {}", rep.stats.total_reviews);
    msg!("  Avg Review Rating: {}/50", rep.stats.avg_review_rating);
    msg!("Last Updated: {}", rep.last_updated);

    Ok(())
}
