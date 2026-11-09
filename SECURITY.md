# Security review

**This is an internal review by the builders, not a professional audit.** An audit means an independent firm, several reviewers and usually weeks of work. Until Ajo has one, use small amounts.

- **Scope:** `contracts/src/Ajo.sol` as in this repository (including vouching), deployed on Robinhood Chain at [`0xDf3f3743768c2609F3b33d9dEad43E95DC016588`](https://robinhoodchain.blockscout.com/address/0xDf3f3743768c2609F3b33d9dEad43E95DC016588); the two tokens it depends on; and the parts of the app that send transactions (`app/src/lib/tx.ts`).
- **Deployed code = tested code:** the bytecode on the chain matches this repository's build byte for byte, apart from the two token addresses set at deployment and the compiler's metadata hash.
- **Date:** November 2026.

## Method

1. Line-by-line reading of the contract for the usual classes of bug: reentrancy, access control, arithmetic, unbounded loops, denial of service, ordering and timing, and money that can be created, lost or locked.
2. Trying to cheat it: tests written as an attacker would play.
3. Automated checks of money conservation:
   - a fuzz test of random paying and skipping in one circle (512 runs);
   - an invariant test: random sequences of every action (create, join, leave, invite, pay, close, wait, withdraw, claim) by five people across up to six circles, 300 runs of 60 steps;
   - a measured random walk: 40 runs of 150 steps, checking every rule after every step. In the last run it reached 274 joins, 125 payments, 58 rounds closed by hand, 81 missed payments, 23 withdrawals, 8 bond claims, 17 finished circles, 28 vouches and 7 members joining on a vouch.

   The rules checked: all USDG in the contract is either owed to someone or in a round not yet closed; all $WIF is a bond still locked or a vouch not yet used (allowing only division dust); no circle ever pays out more $WIF than was locked in it; the creator, while a member, is always last; nobody is listed twice; rounds never pass the end.
4. Reading both token contracts directly from the chain.

All 33 tests pass (`cd contracts && forge test`).

## Findings

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | The creator set the bond **and** took the first pot, so "small bond, take the pot, leave" was profitable. | High | **Fixed** in the current contract: the creator is always paid last. Found by testing the first version (`0x114B…008C`), which is no longer used by the app. |
| 2 | Turns went to whoever joined first, so strangers with several wallets could take the early turns. | Medium | **Fixed** (optional): invite-only circles. |
| 3 | A creator who controls a **second wallet** can invite it and join with it first, so "creator last" can be bypassed. | Medium | **Open, mitigated.** The contract cannot tell two wallets belong to one person. Before joining, the app shows who takes a pot ahead of you and the most one of them could walk away with. Documented by `test_knownLimit_creatorWithSecondWalletCanStillGoFirst`. |
| 4 | No price feed: the contract cannot check that a $WIF bond is worth at least the USDG an early member could keep (*amount per round × (members − 1)*). If $WIF's price falls during a circle, the bond protects less. | Medium | **Open, by design for now.** The create form shows the figure; reading the $WIF price onchain is on the roadmap. |
| 5 | If nobody closed a round in time, members could not pay the next one and lost their bonds. | Medium | **Fixed** before the first deployment: paying (and claiming a bond) closes any overdue round first. |
| 6 | When every member has paid, rounds can close back to back, so the round length is a deadline rather than a waiting time. | Info | Accepted: nobody loses money, and it needs every member to pay. |
| 7 | A payment in the exact second of the deadline counts as late. | Info | Accepted: the app counts down and warns under one minute. |
| 8 | Invites cannot be withdrawn, and invite lists are public on the chain (friends' wallet addresses are visible). | Info | Accepted; noted for users. |
| 9 | When lost bonds are shared out, a remainder smaller than the number of claimers (in the token's smallest unit) stays in the contract. | Info | Accepted: at most a few units of 10⁻¹⁸ $WIF. |
| 10 | Circle names are free text and could be misleading. | Info | The app shows them as plain text (no script injection is possible). |
| 11 | A vouched member risks none of their own $WIF: the voucher carries that risk. | Info | By design; it is the point of vouching (someone who knows them answers for them). The app tells vouchers they lose the bond if the member misses a round, and the leaderboard shows each voucher's record. |
| 12 | Anyone can vouch for an eligible wallet first, which takes the place of a friend's vouch. | Info | Accepted: it only ever covers the member's bond at the stranger's own risk, and if the stranger takes it back, the friend can vouch again. A vouch never forces anyone to join. |

## What was checked and found sound

- **Reentrancy:** every function that moves tokens is `nonReentrant` and updates state before transferring; `invite` moves no tokens. Neither token calls the receiver during a transfer (no ERC-777-style hooks), judging by the functions in their code.
- **Pull payments:** money leaves only through `withdraw`, `claimBond`, `leave` and `withdrawVouch`, always to the person it belongs to. `claimBond` can be triggered by anyone, but the bond always goes to whoever locked it and the share to the member. Closing a round never sends tokens, so one blocked or frozen member cannot stop a circle.
- **Bounded work:** at most 20 members, 20 rounds and 50 invites per call. Nothing loops over the invite list.
- **Arithmetic:** Solidity 0.8 checked maths; amounts are `uint128`, sizes and times fit their types.
- **Access:** only the creator can invite; invite-only circles refuse everyone else; members cannot join twice, pay twice, collect twice or claim twice.
- **No admin:** the contract has no owner, no pause and no upgrade. Nobody, including us, can move members' money or change the rules. The flip side: a bug cannot be patched, only fixed in a new deployment.

## Dependencies

- **$WIF, World is Flat** (`0x5173…4773`): read from the chain. A plain token from a launchpad: no owner, not upgradeable, no fees, no pause, no blacklist. Holders can burn their own tokens.
- **USDG, Global Dollar** (`0x5fc5…1168`): a regulated stablecoin behind an upgradeable proxy. Paxos can upgrade it, and its functions include freezing and removing supply from an address. If a member's address were frozen, only their own payout would be stuck; if the Ajo contract's address were frozen, all USDG in it would be.
- **OpenZeppelin Contracts v5.7.0** (`ReentrancyGuard`, `SafeERC20`).

## App

- Approves exactly the amount each step needs, never an unlimited amount.
- Dry-runs every transaction first, so a call that would fail shows the reason instead of costing gas.
- Switches the wallet to Robinhood Chain before sending, and never sends anything in practice mode.
- Holds no keys; the settings in `app/.env` are public by nature (contract address, deploy block, WalletConnect project ID).
