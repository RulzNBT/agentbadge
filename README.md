# Agent ID Badge

A free, soulbound ERC-721 badge for holders of an Agent ID — built for the
Binance Agent ID Hackathon (submissions close 9 Dec 2026, 08:00 UTC).

## Status (18 Nov 2026, ~23:20 WIB)

- **Mainnet LIVE:** AgentBadge `0x3020571b6F0ED97088A8209517B6d38C39572a1f` (deployed 18 Nov ~20:35 WIB, Sourcify exact_match). Mint site live: https://rulznbt.github.io/agentbadge/
- **104 distinct holders** minted on mainnet by ~22:58 WIB (1 per Agent ID holder, enforced on-chain).
- **Testnet deploy + e2e mint also passed** (testnet AgentBadge `0x8a9c67E91Ba2c360c9Ea9ed78baD584a2Bc82b31`).
- `forge test`: 8/8 pass. Slither: 0 High / 0 Medium / 0 Low on project code. Self-audit PASS (AUDIT.md, 18 Nov ~22:55 WIB).
- **Demo video:** [demo.mp4](https://rulznbt.github.io/agentbadge/demo.mp4) (~51s screen recording of the site flow on testnet).
- **Submission to Binance: in progress** (form open, deadline 9 Dec 2026 08:00 UTC). Draft materials: `SUBMISSION.md`.

- **Token:** Agent ID Badge — symbol `AIDB`
- **Agent ID contract (BNB Chain mainnet):** `0x60b9262456de011f7d15a54cdd8c48baaa8b022f`
  ("SPACE ID Agent ID", symbol `AI`, soulbound, `tokenId = keccak256(handle)`)
- **Price:** 0 — free mint, minter pays gas only.
- **No returns, rewards, or future value are promised.** This badge is a
  collectible proof-of-holding, not an investment.
- **No seed phrases, private keys, API secrets, or pairing codes are ever
  collected** — by the contract, the deploy script, or this repo.
- **No "Binance" / "BNB" branding** is used in the project name, token
  name/symbol, or domain. The SVG uses a neutral dark background with a
  gold accent.

## Design

One badge per Agent ID holder. `mint()` checks, in order:

1. `IAgentID.balanceOf(msg.sender) > 0` — caller must hold an Agent ID.
2. Caller has not minted before (`hasMinted`).
3. `totalMinted < cap` (mainnet cap: 10,000).
4. `IAgentID.handleOf(msg.sender)` is non-empty.

Token IDs are sequential starting at 1. The holder's Agent ID handle is
stored per token (`handleOfToken`) and rendered into fully on-chain
metadata: `tokenURI` returns a `data:application/json;base64,...` URI whose
JSON embeds a base64 on-chain SVG (dark background, gold accent, large
`<handle>.ai`, `AGENT ID BADGE`, token ID, `SOULBOUND · FREE MINT · GAS ONLY`).
No external server or IPFS dependency.

### Soulbound

- `_update` is overridden so any transfer reverts (`SoulboundTransfer`);
  only minting (from `address(0)`) is allowed.
- `approve()` and `setApprovalForAll()` always revert
  (`ApprovalNotAllowed`).
- There is no burn function.

### Owner permissions: NONE

This contract has **no owner at all**:

- No `Ownable`, no admin functions, no pause, no allowlist management,
  no minting by anyone except the holder themselves.
- No `receive` / `fallback` — the contract can never receive or hold BNB.
- Constructor arguments (`agentID`, `cap`) are `immutable` and can never
  be changed after deployment. The cap can never be raised, and no one can
  mint on behalf of someone else.

## Functions

| Function | Description |
|---|---|
| `mint()` | Mint the caller's one free badge (nonpayable). |
| `tokenURI(uint256 tokenId)` | On-chain JSON + SVG metadata. Reverts for nonexistent tokens. |
| `totalMinted()` | Total badges minted (also the last token ID). |
| `agentID()` | Immutable Agent ID contract address. |
| `cap()` | Immutable mint cap. |
| `hasMinted(address)` | Whether an address already minted. |
| `handleOfToken(uint256)` | Agent ID handle stored for a token ID. |
| `ownerOf(uint256)` / `balanceOf(address)` | Standard ERC-721 (from OpenZeppelin). |

## Errors

| Error | When |
|---|---|
| `NotAgentIDHolder()` | Caller holds no Agent ID (`balanceOf == 0`). |
| `AlreadyMinted()` | Caller already minted a badge. |
| `CapReached()` | `totalMinted` reached `cap`. |
| `NoHandle()` | Agent ID contract returned an empty handle. |
| `SoulboundTransfer()` | Any transfer attempt. |
| `ApprovalNotAllowed()` | Any `approve` / `setApprovalForAll` attempt. |
| `InvalidAgentID()` | Constructor given the zero address as Agent ID. |
| `ERC721NonexistentToken(uint256)` | `tokenURI` for a token that does not exist (OpenZeppelin). |

## Events

| Event | Description |
|---|---|
| `BadgeMinted(address indexed holder, uint256 indexed tokenId, string handle)` | Emitted on every successful mint. |

## Build & test (local only)

Requires [Foundry](https://book.getfoundry.sh/getting-started/installation)
(`forge` 1.9.0 used here, solc 0.8.24, OpenZeppelin Contracts v5.4.0).

```bash
cd badge
forge build
forge test
```

Expected: `forge test` — 8 tests passed, 0 failed (see `test/AgentBadge.t.sol`).
The tests use a `MockAgentID` test double (no mainnet fork needed) and cover:
successful mint (owner, handle, decoded `tokenURI` JSON + SVG contents),
non-holder revert, double-mint revert, all transfer forms revert, both
approval functions revert, cap enforcement (cap = 2), `tokenURI` of a
nonexistent token reverts, and empty-handle-with-balance revert.

## Deploy (commands only — NOT executed here)

No deployment has been run from this repo, and no real funds or private key
were used or requested at any point. To deploy, set the environment
variables and broadcast from your own wallet:

```bash
# Testnet (BNB Chain testnet, chain ID 97) — use script/DeployTestnet.s.sol,
# which deploys a MockAgentID first (the real Agent ID contract does not
# exist on testnet) and performs a smoke-test mint. Full runbook: TESTNET.md.
# The deployer needs tBNB for gas (official faucet, browser + captcha).
PRIVATE_KEY=<THROWAWAY_TESTNET_KEY> HANDLE=testbadge CAP=10000 \
forge script script/DeployTestnet.s.sol \
  --rpc-url https://data-seed-prebsc-1-s1.binance.org:8545 --broadcast

# Mainnet (BNB Chain, chain ID 56) — exact plan + gas estimate: SUBMISSION.md
export AGENT_ID=0x60b9262456de011f7d15a54cdd8c48baaa8b022f
export CAP=10000
forge script script/Deploy.s.sol --rpc-url <MAINNET_RPC_URL> --broadcast
```

`script/Deploy.s.sol` reads `AGENT_ID` (required) and `CAP` (default `10000`)
from the environment. A local dry run (no `--broadcast`, no RPC) was verified:
`forge script script/Deploy.s.sol` with `AGENT_ID` set deploys in local
simulation and prints the contract address, Agent ID, and cap.

## Verification (BscScan)

After deploying, verify the source on BscScan so anyone can read the
contract and confirm it has no owner and no value promises:

```bash
forge verify-contract <DEPLOYED_ADDRESS> src/AgentBadge.sol:AgentBadge \
  --chain-id 56 \
  --constructor-args $(cast abi-encode "constructor(address,uint256)" <AGENT_ID> <CAP>) \
  --etherscan-api-key <BSCSCAN_API_KEY>
```

(Use `--chain-id 97` for testnet.) Then confirm on the BscScan contract page
that the source matches this repo, `agentID` equals the Agent ID address
above, and `cap` equals 10,000.

## License

MIT. OpenZeppelin Contracts v5.4.0 (MIT) is a git submodule under `lib/`.
