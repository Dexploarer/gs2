use anchor_lang::prelude::*;

#[error_code]
pub enum TokenStakingError {
    #[msg("Vault is not active")]
    VaultNotActive,

    #[msg("Amount below minimum stake requirement")]
    BelowMinimumStake,

    #[msg("Stake is still locked")]
    StakeLocked,

    #[msg("Stake is not active")]
    StakeNotActive,

    #[msg("Unauthorized: not the staker")]
    UnauthorizedStaker,

    #[msg("Unauthorized: not the vault authority")]
    UnauthorizedAuthority,

    #[msg("Invalid lock period (must be 1 second to 365 days)")]
    InvalidLockPeriod,

    #[msg("Invalid weight multiplier (must be 10-1000)")]
    InvalidWeightMultiplier,

    #[msg("Invalid token mint")]
    InvalidTokenMint,

    #[msg("Invalid token owner")]
    InvalidTokenOwner,

    #[msg("Invalid unstake amount")]
    InvalidUnstakeAmount,

    #[msg("Self-staking is not allowed")]
    SelfStakingNotAllowed,

    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}
