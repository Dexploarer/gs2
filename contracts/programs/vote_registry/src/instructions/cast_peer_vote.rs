use anchor_lang::prelude::*;
use crate::state::{PeerVote, VoteType, QualityScores, TransactionReceipt};
use crate::error::VoteError;

/// External AgentIdentity account structure (from identity_registry)
#[account]
pub struct AgentIdentity {
    pub agent_address: Pubkey,
    pub asset_address: Pubkey,
    pub metadata_uri: String,
    pub registration_timestamp: i64,
    pub last_active_timestamp: i64,
    pub activity_count: u64,
    pub is_active: bool,
    pub bump: u8,
}

/// External AgentReputation account structure (from reputation_registry)
#[account]
pub struct AgentReputation {
    pub agent_address: Pubkey,
    pub overall_score: u16,
    // ... other fields not needed for this check
}

#[derive(Accounts)]
#[instruction(voted_agent: Pubkey)]
pub struct CastPeerVote<'info> {
    #[account(
        init,
        payer = voter,
        space = PeerVote::LEN,
        seeds = [
            PeerVote::SEED_PREFIX,
            transaction_receipt.key().as_ref()
        ],
        bump
    )]
    pub peer_vote: Account<'info, PeerVote>,

    /// Transaction receipt that proves the interaction
    /// Note: x402 supports micropayments as low as $0.001, so no minimum amount required
    #[account(
        mut,
        constraint = !transaction_receipt.vote_cast @ VoteError::VoteAlreadyCast,
        constraint = transaction_receipt.payer == voter.key() || transaction_receipt.recipient == voter.key() @ VoteError::VoterNotPartyToTransaction
    )]
    pub transaction_receipt: Account<'info, TransactionReceipt>,

    /// Voter's identity (from identity_registry)
    /// CHECK: Validated via seeds and is_active check
    #[account(
        seeds = [b"agent", voter.key().as_ref()],
        bump,
        seeds::program = identity_registry_program.key()
    )]
    pub voter_identity: AccountInfo<'info>,

    /// Voter's reputation (from reputation_registry)
    /// CHECK: Validated via seeds and reputation check
    #[account(
        seeds = [b"reputation", voter.key().as_ref()],
        bump,
        seeds::program = reputation_registry_program.key()
    )]
    pub voter_reputation: AccountInfo<'info>,

    /// Voted agent's identity (from identity_registry)
    /// CHECK: Validated via seeds and is_active check
    #[account(
        seeds = [b"agent", voted_agent.as_ref()],
        bump,
        seeds::program = identity_registry_program.key()
    )]
    pub voted_agent_identity: AccountInfo<'info>,

    #[account(mut)]
    pub voter: Signer<'info>,

    /// CHECK: Identity Registry program
    pub identity_registry_program: AccountInfo<'info>,

    /// CHECK: Reputation Registry program
    pub reputation_registry_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CastPeerVote>,
    voted_agent: Pubkey,
    vote_type: VoteType,
    quality_scores: QualityScores,
    comment_hash: [u8; 32],
) -> Result<()> {
    let clock = Clock::get()?;

    // Extract values we need before mutable borrow
    let transaction_timestamp = ctx.accounts.transaction_receipt.timestamp;
    let transaction_amount = ctx.accounts.transaction_receipt.amount;
    let transaction_payer = ctx.accounts.transaction_receipt.payer;
    let transaction_recipient = ctx.accounts.transaction_receipt.recipient;
    let transaction_receipt_key = ctx.accounts.transaction_receipt.key();

    // Validate voting window (30 days from transaction)
    let time_since_transaction = clock.unix_timestamp - transaction_timestamp;
    require!(
        time_since_transaction <= TransactionReceipt::VOTING_WINDOW_SECONDS,
        VoteError::VotingWindowExpired
    );

    // Validate voted_agent is the counterparty in the transaction
    let voter_key = ctx.accounts.voter.key();
    let counterparty = if transaction_payer == voter_key {
        transaction_recipient
    } else {
        transaction_payer
    };

    require!(
        voted_agent == counterparty,
        VoteError::VotedAgentNotCounterparty
    );

    // Deserialize and validate voter identity
    let voter_identity_data = &ctx.accounts.voter_identity.data.borrow();
    let voter_identity = AgentIdentity::try_deserialize(&mut &voter_identity_data[..])?;

    require!(
        voter_identity.is_active,
        VoteError::InactiveVoter
    );

    // Deserialize and validate voter reputation
    let voter_reputation_data = &ctx.accounts.voter_reputation.data.borrow();
    let voter_reputation = AgentReputation::try_deserialize(&mut &voter_reputation_data[..])?;

    require!(
        voter_reputation.overall_score >= 100,
        VoteError::InsufficientReputation
    );

    // Deserialize and validate voted agent identity
    let voted_agent_identity_data = &ctx.accounts.voted_agent_identity.data.borrow();
    let voted_agent_identity = AgentIdentity::try_deserialize(&mut &voted_agent_identity_data[..])?;

    require!(
        voted_agent_identity.is_active,
        VoteError::VotedAgentNotActive
    );

    // Validate quality scores
    require!(
        quality_scores.response_quality <= 100 &&
        quality_scores.response_speed <= 100 &&
        quality_scores.accuracy <= 100 &&
        quality_scores.professionalism <= 100,
        VoteError::InvalidQualityScore
    );

    // Create the peer vote
    let peer_vote = &mut ctx.accounts.peer_vote;
    peer_vote.voter = voter_key;
    peer_vote.voted_agent = voted_agent;
    peer_vote.vote_type = vote_type;
    peer_vote.quality_scores = quality_scores;
    peer_vote.comment_hash = comment_hash;
    peer_vote.timestamp = clock.unix_timestamp;
    peer_vote.voter_reputation_snapshot = voter_reputation.overall_score;
    peer_vote.transaction_receipt = transaction_receipt_key;
    peer_vote.vote_weight = PeerVote::calculate_vote_weight(transaction_amount);
    peer_vote.bump = ctx.bumps.peer_vote;

    // Mark transaction receipt as voted
    ctx.accounts.transaction_receipt.vote_cast = true;

    // Calculate weighted vote power for analytics (using saturating math for safety)
    let vote_weight = peer_vote.vote_weight;
    let weighted_vote_power = (vote_weight as u32).saturating_mul(voter_reputation.overall_score as u32);

    // Comprehensive vote analytics logging
    msg!("======================================");
    msg!("=== VOTE CAST SUCCESSFULLY ===");
    msg!("======================================");
    msg!("Vote Type: {:?}", vote_type);
    msg!("Voter: {}", voter_key);
    msg!("Voted Agent: {}", voted_agent);
    msg!("Transaction Receipt: {}", transaction_receipt_key);
    msg!("--------------------------------------");
    msg!("=== Transaction Details ===");
    msg!("Transaction Amount: {} SOL", transaction_amount as f64 / 1_000_000_000.0);
    msg!("Transaction Timestamp: {}", transaction_timestamp);
    msg!("--------------------------------------");
    msg!("=== Vote Weighting ===");
    msg!("Vote Weight: {}x (based on tx amount)", vote_weight as f32 / 100.0);
    msg!("Voter Reputation: {}", voter_reputation.overall_score);
    msg!("Weighted Vote Power: {}", weighted_vote_power);
    msg!("--------------------------------------");
    msg!("=== Quality Scores ===");
    msg!("Response Quality: {}/100", quality_scores.response_quality);
    msg!("Response Speed: {}/100", quality_scores.response_speed);
    msg!("Accuracy: {}/100", quality_scores.accuracy);
    msg!("Professionalism: {}/100", quality_scores.professionalism);
    msg!("Average Quality: {}/100",
         (quality_scores.response_quality as u16 +
          quality_scores.response_speed as u16 +
          quality_scores.accuracy as u16 +
          quality_scores.professionalism as u16) / 4);
    msg!("======================================");

    Ok(())
}
