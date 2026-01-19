use anchor_lang::prelude::*;

/// Test result from a single LLM validation
#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct TestResult {
    #[max_len(50)]
    pub llm_model: String,      // e.g., "gpt-4", "claude-3", "gemini-pro"
    pub success: bool,           // Whether the test passed
    pub response_time: u64,      // Response time in milliseconds
    pub score: u8,               // Quality score 0-100
}

/// Endpoint Validation Account
/// PDA seeds: ["validation", endpoint_hash]
#[account]
#[derive(InitSpace)]
pub struct EndpointValidation {
    /// Hash of the endpoint URL (for deterministic PDA)
    pub endpoint_hash: [u8; 32],

    /// The actual endpoint URL
    #[max_len(200)]
    pub endpoint_url: String,

    /// Provider agent's public key
    pub provider_agent: Pubkey,

    /// Validation test results (up to 10 LLM tests)
    #[max_len(10)]
    pub test_results: Vec<TestResult>,

    /// Consensus score (0-1000)
    pub consensus_score: u16,

    /// Whether validation stamp has been issued
    pub stamp_issued: bool,

    /// Timestamp of validation
    pub timestamp: i64,

    /// PDA bump seed
    pub bump: u8,
}

impl EndpointValidation {
    /// Seed prefix for PDA derivation
    pub const SEED_PREFIX: &'static [u8] = b"validation";

    /// Calculate space for rent (max size with 10 test results)
    pub const LEN: usize = 8 + // discriminator
        32 + // endpoint_hash
        4 + 200 + // endpoint_url (String with max 200 chars)
        32 + // provider_agent
        4 + (10 * (4 + 50 + 1 + 8 + 1)) + // test_results (Vec with max 10 TestResults)
        2 + // consensus_score
        1 + // stamp_issued
        8 + // timestamp
        1; // bump
}

/// Authority configuration for validation registry
/// PDA seeds: ["authority"]
#[account]
#[derive(InitSpace)]
pub struct ValidationAuthority {
    /// The authority wallet that can calculate consensus and issue stamps
    pub authority: Pubkey,

    /// PDA bump seed
    pub bump: u8,
}

impl ValidationAuthority {
    /// Seed prefix for PDA derivation
    pub const SEED_PREFIX: &'static [u8] = b"authority";

    /// Calculate space for rent
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        1; // bump
}
