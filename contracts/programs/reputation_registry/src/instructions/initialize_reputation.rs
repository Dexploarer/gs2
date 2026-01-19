use anchor_lang::prelude::*;
use crate::state::{AgentReputation, ComponentScores, ReputationStats};
use crate::error::ReputationError;

#[derive(Accounts)]
pub struct InitializeReputation<'info> {
    #[account(
        init,
        payer = payer,
        space = AgentReputation::LEN,
        seeds = [AgentReputation::SEED_PREFIX, agent_address.key().as_ref()],
        bump
    )]
    pub agent_reputation: Account<'info, AgentReputation>,

    /// CHECK: The agent's wallet address
    pub agent_address: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeReputation>) -> Result<()> {
    let agent_reputation = &mut ctx.accounts.agent_reputation;
    let clock = Clock::get()?;

    agent_reputation.agent_address = ctx.accounts.agent_address.key();
    agent_reputation.overall_score = 0;
    agent_reputation.component_scores = ComponentScores::default();
    agent_reputation.stats = ReputationStats::default();
    agent_reputation.payment_proofs_merkle_root = [0; 32];
    agent_reputation.last_updated = clock.unix_timestamp;
    agent_reputation.bump = ctx.bumps.agent_reputation;

    msg!("Reputation initialized for agent: {}", ctx.accounts.agent_address.key());

    Ok(())
}
