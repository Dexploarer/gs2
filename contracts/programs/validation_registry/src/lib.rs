pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use error::*;
pub use instructions::*;
pub use state::*;

declare_id!("9wwukuFjurWGDXREvnyBLPyePP4wssP5HCuRd1FJsaKc");

#[program]
pub mod validation_registry {
    use super::*;

    /// Initialize the authority account (one-time setup)
    pub fn initialize_authority(ctx: Context<InitializeAuthority>) -> Result<()> {
        instructions::initialize_authority::handler(ctx)
    }

    /// Submit endpoint validation results
    pub fn submit_validation(
        ctx: Context<SubmitValidation>,
        endpoint_url: String,
        endpoint_hash: [u8; 32],
        test_results: Vec<TestResult>,
    ) -> Result<()> {
        instructions::submit_validation::handler(ctx, endpoint_url, endpoint_hash, test_results)
    }

    /// Query validation results for an endpoint
    pub fn query_validations(ctx: Context<QueryValidations>) -> Result<()> {
        instructions::query_validations::handler(ctx)
    }

    /// Calculate consensus score from validation results
    pub fn calculate_consensus(ctx: Context<CalculateConsensus>) -> Result<()> {
        instructions::calculate_consensus::handler(ctx)
    }

    /// Issue validation stamp for verified endpoint
    pub fn issue_validation_stamp(ctx: Context<IssueValidationStamp>) -> Result<()> {
        instructions::issue_validation_stamp::handler(ctx)
    }
}
