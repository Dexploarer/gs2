use anchor_lang::prelude::*;
use crate::state::AgentReputation;
use crate::error::ReputationError;

#[derive(Accounts)]
pub struct RecordPaymentProof<'info> {
    #[account(
        mut,
        seeds = [AgentReputation::SEED_PREFIX, agent_address.key().as_ref()],
        bump = agent_reputation.bump
    )]
    pub agent_reputation: Account<'info, AgentReputation>,

    /// CHECK: The agent's wallet address
    pub agent_address: UncheckedAccount<'info>,

    /// Authority that can record proofs
    pub authority: Signer<'info>,
}

pub fn handler(
    ctx: Context<RecordPaymentProof>,
    payment_signature: String,
) -> Result<()> {
    require!(
        payment_signature.len() <= 88, // Solana signature length
        ReputationError::PaymentSignatureTooLong
    );

    // In a real implementation, this would:
    // 1. Verify the payment proof signature
    // 2. Add it to a Merkle tree
    // 3. Update the merkle_root in agent_reputation
    //
    // For now, we'll just log the payment proof

    msg!("Payment proof recorded for agent: {}", ctx.accounts.agent_address.key());
    msg!("Payment signature: {}", payment_signature);

    // NOTE: Actual Merkle tree implementation would go here
    // This would involve updating payment_proofs_merkle_root

    Ok(())
}
