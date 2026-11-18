// Config for the Agent ID Badge mint site.
// All contract addresses and chain settings live here — app.js reads from
// this file only, so a redeploy only needs an edit here.

const CONFIG = {
  // Badge contract address (BNB Chain mainnet, deployed 18 Nov 2026).
  CONTRACT_ADDRESS: "0x3020571b6F0ED97088A8209517B6d38C39572a1f",

  // SPACE ID Agent ID contract (BNB Chain mainnet). Read-only lookups
  // (balanceOf / handleOf) work against this address on either chain
  // because it is a plain view call; on testnet the check returns 0
  // unless the same address is also deployed there.
  AGENT_ID_ADDRESS: "0x60b9262456de011f7d15a54cdd8c48baaa8b022f",

  // Default chain: BNB Chain mainnet (chainId 56).
  CHAIN_ID: 56,
  CHAIN_NAME: "BNB Chain",

  // Block explorer base URL (no trailing slash).
  BSCSCAN_BASE: "https://bscscan.com",
};
