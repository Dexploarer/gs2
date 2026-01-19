use anchor_lang::prelude::*;
use crate::state::EndpointValidation;

#[derive(Accounts)]
pub struct QueryValidations<'info> {
    #[account(
        seeds = [
            EndpointValidation::SEED_PREFIX,
            &endpoint_validation.endpoint_hash
        ],
        bump = endpoint_validation.bump
    )]
    pub endpoint_validation: Account<'info, EndpointValidation>,
}

pub fn handler(ctx: Context<QueryValidations>) -> Result<()> {
    let validation = &ctx.accounts.endpoint_validation;

    msg!("=== Endpoint Validation ===");
    msg!("Endpoint URL: {}", validation.endpoint_url);
    msg!("Provider Agent: {}", validation.provider_agent);
    msg!("Consensus Score: {}/1000", validation.consensus_score);
    msg!("Stamp Issued: {}", validation.stamp_issued);
    msg!("Timestamp: {}", validation.timestamp);
    msg!("Test Results Count: {}", validation.test_results.len());

    for (i, result) in validation.test_results.iter().enumerate() {
        msg!("Test #{}: {} - Success: {}, Score: {}/100, Response Time: {}ms",
            i + 1,
            result.llm_model,
            result.success,
            result.score,
            result.response_time
        );
    }

    Ok(())
}
