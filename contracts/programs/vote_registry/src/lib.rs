pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use error::*;
pub use instructions::*;
pub use state::*;

declare_id!("EKqkjsLHK8rFr7pdySSFKZjhQfnEWeVqPRdZekw1t1j6");

#[program]
pub mod vote_registry {
    use super::*;

    /// Create a transaction receipt for an x402 payment (enables voting)
    pub fn create_transaction_receipt(
        ctx: Context<CreateTransactionReceipt>,
        signature: String,
        signature_hash: [u8; 32],
        amount: u64,
        content_type: ContentType,
    ) -> Result<()> {
        instructions::create_transaction_receipt::handler(
            ctx,
            signature,
            signature_hash,
            amount,
            content_type,
        )
    }

    /// Cast a peer vote on another agent
    pub fn cast_peer_vote(
        ctx: Context<CastPeerVote>,
        voted_agent: Pubkey,
        vote_type: VoteType,
        quality_scores: QualityScores,
        comment_hash: [u8; 32],
    ) -> Result<()> {
        instructions::cast_peer_vote::handler(
            ctx,
            voted_agent,
            vote_type,
            quality_scores,
            comment_hash,
        )
    }

    /// Rate content from an x402 transaction
    pub fn rate_content(
        ctx: Context<RateContent>,
        x402_signature: String,
        quality_rating: u8,
        content_type: ContentType,
        amount_paid: u64,
    ) -> Result<()> {
        instructions::rate_content::handler(
            ctx,
            x402_signature,
            quality_rating,
            content_type,
            amount_paid,
        )
    }

    /// Endorse another agent (requires stake)
    pub fn endorse_agent(
        ctx: Context<EndorseAgent>,
        endorsed_agent: Pubkey,
        strength: u8,
        category: EndorsementCategory,
    ) -> Result<()> {
        instructions::endorse_agent::handler(ctx, endorsed_agent, strength, category)
    }
}
