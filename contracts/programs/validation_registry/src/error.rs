use anchor_lang::prelude::*;

#[error_code]
pub enum ValidationError {
    #[msg("Endpoint URL exceeds maximum length of 200 characters")]
    EndpointUrlTooLong,

    #[msg("Too many test results (maximum 10 allowed)")]
    TooManyTestResults,

    #[msg("LLM model name exceeds maximum length of 50 characters")]
    LlmModelNameTooLong,

    #[msg("Consensus score must be between 0 and 1000")]
    InvalidConsensusScore,

    #[msg("Validation stamp already issued")]
    StampAlreadyIssued,

    #[msg("Insufficient test results for consensus (minimum 3 required)")]
    InsufficientTestResults,

    #[msg("Provider agent identity not found")]
    ProviderNotFound,

    #[msg("Unauthorized: signer is not the authorized authority")]
    UnauthorizedAuthority,
}
