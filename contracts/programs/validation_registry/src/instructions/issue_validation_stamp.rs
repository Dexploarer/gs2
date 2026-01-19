use anchor_lang::prelude::*;
use crate::state::{EndpointValidation, ValidationAuthority};
use crate::error::ValidationError;

#[derive(Accounts)]
pub struct IssueValidationStamp<'info> {
    #[account(
        mut,
        seeds = [
            EndpointValidation::SEED_PREFIX,
            &endpoint_validation.endpoint_hash
        ],
        bump = endpoint_validation.bump
    )]
    pub endpoint_validation: Account<'info, EndpointValidation>,

    #[account(
        seeds = [ValidationAuthority::SEED_PREFIX],
        bump = authority_account.bump,
        has_one = authority @ ValidationError::UnauthorizedAuthority
    )]
    pub authority_account: Account<'info, ValidationAuthority>,

    /// Authority that can issue stamps
    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<IssueValidationStamp>) -> Result<()> {
    let validation = &mut ctx.accounts.endpoint_validation;

    require!(
        !validation.stamp_issued,
        ValidationError::StampAlreadyIssued
    );

    require!(
        validation.consensus_score > 0,
        ValidationError::InvalidConsensusScore
    );

    // Minimum consensus score of 700/1000 required for stamp
    require!(
        validation.consensus_score >= 700,
        ValidationError::InvalidConsensusScore
    );

    validation.stamp_issued = true;

    msg!("Validation stamp issued for endpoint: {}", validation.endpoint_url);
    msg!("Consensus score: {}/1000", validation.consensus_score);
    msg!("Provider agent: {}", validation.provider_agent);

    Ok(())
}
