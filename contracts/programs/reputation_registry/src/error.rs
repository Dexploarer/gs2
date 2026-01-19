use anchor_lang::prelude::*;

#[error_code]
pub enum ReputationError {
    #[msg("Overall score must be between 0 and 1000")]
    InvalidOverallScore,

    #[msg("Component score must be between 0 and 100")]
    InvalidComponentScore,

    #[msg("Average review rating must be between 0 and 50")]
    InvalidReviewRating,

    #[msg("Agent identity not found or not registered")]
    AgentNotRegistered,

    #[msg("Unauthorized: signer is not the agent owner")]
    UnauthorizedUpdate,

    #[msg("Unauthorized: signer is not the authorized authority")]
    UnauthorizedAuthority,

    #[msg("Payment signature exceeds maximum length")]
    PaymentSignatureTooLong,

    #[msg("Arithmetic overflow detected")]
    ArithmeticOverflow,

    #[msg("Invalid authority for this operation")]
    InvalidAuthority,
}
