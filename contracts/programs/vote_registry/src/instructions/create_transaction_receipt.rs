use anchor_lang::prelude::*;
use crate::state::{TransactionReceipt, ContentType};
use crate::error::VoteError;

#[derive(Accounts)]
#[instruction(signature: String, signature_hash: [u8; 32])]
pub struct CreateTransactionReceipt<'info> {
    #[account(
        init,
        payer = creator,
        space = TransactionReceipt::LEN,
        seeds = [
            TransactionReceipt::SEED_PREFIX,
            payer_pubkey.key().as_ref(),
            recipient_pubkey.key().as_ref(),
            &signature_hash
        ],
        bump
    )]
    pub receipt: Account<'info, TransactionReceipt>,

    /// Payer in the x402 transaction
    /// CHECK: Validated in instruction that creator is payer or recipient
    pub payer_pubkey: UncheckedAccount<'info>,

    /// Recipient in the x402 transaction
    /// CHECK: Validated in instruction that creator is payer or recipient
    pub recipient_pubkey: UncheckedAccount<'info>,

    /// Creator of this receipt (must be payer or recipient)
    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateTransactionReceipt>,
    signature: String,
    signature_hash: [u8; 32],
    amount: u64,
    content_type: ContentType,
) -> Result<()> {
    // Validate creator is either payer or recipient
    require!(
        ctx.accounts.creator.key() == ctx.accounts.payer_pubkey.key() ||
        ctx.accounts.creator.key() == ctx.accounts.recipient_pubkey.key(),
        VoteError::UnauthorizedReceiptCreation
    );

    // Validate signature length
    require!(
        signature.len() <= 88,
        VoteError::InvalidX402Signature
    );

    // Validate payer and recipient are different
    require!(
        ctx.accounts.payer_pubkey.key() != ctx.accounts.recipient_pubkey.key(),
        VoteError::SelfTransactionNotAllowed
    );

    let receipt = &mut ctx.accounts.receipt;
    let clock = Clock::get()?;

    receipt.signature = signature.clone();
    receipt.payer = ctx.accounts.payer_pubkey.key();
    receipt.recipient = ctx.accounts.recipient_pubkey.key();
    receipt.amount = amount;
    receipt.timestamp = clock.unix_timestamp;
    receipt.content_type = content_type;
    receipt.vote_cast = false;
    receipt.bump = ctx.bumps.receipt;

    msg!("Transaction receipt created: {}", signature);
    msg!("Payer: {}, Recipient: {}, Amount: {} lamports",
         receipt.payer, receipt.recipient, amount);
    msg!("Content type: {:?}", content_type);

    Ok(())
}
