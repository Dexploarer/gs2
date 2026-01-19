use anchor_lang::prelude::*;
use crate::state::{EndpointValidation, TestResult};
use crate::error::ValidationError;

#[derive(Accounts)]
#[instruction(endpoint_url: String, endpoint_hash: [u8; 32])]
pub struct SubmitValidation<'info> {
    #[account(
        init,
        payer = payer,
        space = EndpointValidation::LEN,
        seeds = [
            EndpointValidation::SEED_PREFIX,
            &endpoint_hash
        ],
        bump
    )]
    pub endpoint_validation: Account<'info, EndpointValidation>,

    /// The provider agent's public key
    /// CHECK: Validated as provider in instruction
    pub provider_agent: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SubmitValidation>,
    endpoint_url: String,
    endpoint_hash: [u8; 32],
    test_results: Vec<TestResult>,
) -> Result<()> {
    require!(
        endpoint_url.len() <= 200,
        ValidationError::EndpointUrlTooLong
    );

    require!(
        test_results.len() <= 10,
        ValidationError::TooManyTestResults
    );

    // Validate each test result
    for result in &test_results {
        require!(
            result.llm_model.len() <= 50,
            ValidationError::LlmModelNameTooLong
        );
    }

    let endpoint_validation = &mut ctx.accounts.endpoint_validation;
    let clock = Clock::get()?;

    endpoint_validation.endpoint_hash = endpoint_hash;
    endpoint_validation.endpoint_url = endpoint_url;
    endpoint_validation.provider_agent = ctx.accounts.provider_agent.key();
    endpoint_validation.test_results = test_results;
    endpoint_validation.consensus_score = 0; // Will be calculated separately
    endpoint_validation.stamp_issued = false;
    endpoint_validation.timestamp = clock.unix_timestamp;
    endpoint_validation.bump = ctx.bumps.endpoint_validation;

    msg!("Validation submitted for endpoint: {}", endpoint_validation.endpoint_url);
    msg!("Provider agent: {}", ctx.accounts.provider_agent.key());
    msg!("Test results count: {}", endpoint_validation.test_results.len());

    Ok(())
}
