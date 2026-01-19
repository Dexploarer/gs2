use anchor_lang::prelude::*;

#[error_code]
pub enum VoteError {
    #[msg("Voter does not have an active identity")]
    InactiveVoter,

    #[msg("Voter reputation is too low (minimum 100 required)")]
    InsufficientReputation,

    #[msg("Quality score must be between 0 and 100")]
    InvalidQualityScore,

    #[msg("Content rating must be between 0 and 100")]
    InvalidContentRating,

    #[msg("x402 signature exceeds maximum length (88 characters)")]
    InvalidX402Signature,

    #[msg("Endorsement strength must be between 0 and 100")]
    InvalidEndorsementStrength,

    #[msg("Endorser reputation is too low (minimum 500 required for endorsements)")]
    InsufficientEndorserReputation,

    #[msg("Endorsement stake is too low (minimum 0.01 SOL)")]
    InsufficientEndorsementStake,

    #[msg("Agent has reached maximum endorsement limit (10 max)")]
    MaxEndorsementsReached,

    #[msg("Cannot endorse yourself")]
    SelfEndorsementNotAllowed,

    #[msg("Voted agent does not exist or is not active")]
    VotedAgentNotActive,

    #[msg("Rated agent does not exist or is not active")]
    RatedAgentNotActive,

    #[msg("Endorsed agent does not exist or is not active")]
    EndorsedAgentNotActive,

    #[msg("Creator must be either payer or recipient in the transaction")]
    UnauthorizedReceiptCreation,

    #[msg("Cannot create receipt for transaction with yourself")]
    SelfTransactionNotAllowed,

    #[msg("Vote has already been cast using this transaction receipt")]
    AlreadyVoted,

    #[msg("Voter is not a party to this transaction")]
    NotPartyToTransaction,

    #[msg("Voted agent does not match the counterparty in the receipt")]
    VotedAgentMismatch,

    #[msg("Voting window has expired (30 days from transaction)")]
    VotingWindowExpired,

    #[msg("Vote has already been cast using this transaction receipt")]
    VoteAlreadyCast,

    #[msg("Voter is not a party to this transaction (must be payer or recipient)")]
    VoterNotPartyToTransaction,

    #[msg("Voted agent must be the counterparty in the transaction receipt")]
    VotedAgentNotCounterparty,
}
