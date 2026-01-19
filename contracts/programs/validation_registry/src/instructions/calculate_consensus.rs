use anchor_lang::prelude::*;
use crate::state::{EndpointValidation, ValidationAuthority};
use crate::error::ValidationError;

#[derive(Accounts)]
pub struct CalculateConsensus<'info> {
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

    /// Authority that can calculate consensus
    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<CalculateConsensus>) -> Result<()> {
    let validation = &mut ctx.accounts.endpoint_validation;

    require!(
        validation.test_results.len() >= 3,
        ValidationError::InsufficientTestResults
    );

    // Calculate consensus score based on test results
    let mut total_score: u32 = 0;
    let mut successful_tests: u32 = 0;

    for result in &validation.test_results {
        if result.success {
            successful_tests = successful_tests.saturating_add(1);
            total_score = total_score.saturating_add(result.score as u32);
        }
    }

    // Consensus formula:
    // - Base score from average of successful tests (0-100)
    // - Success rate bonus (0-900)
    // - Total max: 1000

    let avg_score = if successful_tests > 0 {
        total_score / successful_tests
    } else {
        0
    };

    let success_rate = successful_tests
        .saturating_mul(100)
        .checked_div(validation.test_results.len() as u32)
        .unwrap_or(0);
    let success_bonus = success_rate.saturating_mul(9) / 10; // Scale to 0-900

    let consensus = avg_score.saturating_add(success_bonus).min(1000) as u16;

    validation.consensus_score = consensus;

    msg!("Consensus calculated: {}/1000", consensus);
    msg!("Successful tests: {}/{}", successful_tests, validation.test_results.len());
    msg!("Average score: {}/100", avg_score);

    Ok(())
}
