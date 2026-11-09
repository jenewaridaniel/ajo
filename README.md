# Ajo

**A rotating savings circle on Robinhood Chain, run by a contract instead of a trusted organiser, with a $WIF bond that makes walking away cost you.**

Built for the World is Flat hackathon.

**Live app: [ajo-circle.netlify.app](https://ajo-circle.netlify.app)** (Robinhood Chain; you need a little ETH, USDG and $WIF there. The in-app guide explains how to get them.)

---

## The problem

An *ajo* (also called *esusu*, *susu* or *chama*) is a group that saves together. Everyone pays the same amount each round, and each round one member takes the whole pot. By the last round everyone has had a turn. It works as interest-free savings for the people who go last, and as an interest-free advance for the people who go first.

It runs on trust, and that is its oldest problem: someone takes the pot early and then stops paying, or the person holding the money disappears.

## What Ajo does

- **The contract holds the money.** No organiser can run off with it, and nobody can change the payout order once a circle starts.
- **Savings are in USDG**, a dollar stablecoin, so the pot does not move with a meme coin's price.
- **Every member locks a $WIF bond to join.** Pay every round and you get it back at the end, plus an equal share of any bonds others lost. Miss a round and your bond goes to the members who kept paying.
- **The creator takes the last pot.** Whoever sets the terms (including the bond) is paid last, so they cannot set a weak bond, take the first pot themselves and disappear. The creator is also the member most exposed to others walking away, so they have every reason to set a strong bond.
- **Circles can be invite-only.** The creator lists the wallets of the people they save with, so strangers cannot rush in to grab the early turns.
- **Vouch for someone.** Anyone with $WIF can lock the bond *for* a friend or relative who has none, so the newcomer only needs USDG. If the newcomer pays every round, the bond goes back to the voucher; if they miss one, the voucher loses it. That is how an ajo has always taken in new people: someone who knows them answers for them. The leaderboard shows each voucher's record ("vouches kept").

### Why $WIF

$WIF is the commitment, not the savings. Every seat in every circle is backed by a $WIF bond, and every round brings every member back to pay. Vouching turns members into the way new people arrive: to bring in someone who has no $WIF, a member locks $WIF for them, and a good vouching record is public. Finished circles build a track record (the leaderboard ranks savers by rounds paid on time), which makes the next circle easier to fill.

## How a circle works

1. **Start**: choose the amount per round (USDG), the bond ($WIF), the number of members (2 to 20), the round length (1 minute to 30 days), and optionally who may join.
2. **Join**: each member locks the bond, or uses a bond someone locked for them (a vouch). Until the circle is full, anyone can leave, and the bond goes back to whoever locked it. It starts the moment it is full.
3. **Each round**: everyone pays. When all members still in good standing have paid, anyone can close the round early; otherwise it closes when its time is up. The pot goes to that round's member and waits in the contract until they withdraw it.
4. **Missed a payment?** That member is out and their bond goes into a penalty pool. If the member who was due the pot is the one who missed, the pot goes back to the payers.
5. **The end**: everyone who paid every round gets their bond back plus an equal share of the penalty pool. For a vouched member, the bond goes back to the voucher and the share to the member. Anyone can trigger a claim, so a voucher never depends on the member coming back.

The app includes a seven-step guide ("Robin", a pixel squid) that explains this and checks the visitor's wallet for what they need.

## Onchain

Robinhood Chain (chain ID 4663). Explorer: [robinhoodchain.blockscout.com](https://robinhoodchain.blockscout.com).

| | Address |
|---|---|
| **Ajo contract (current, with vouching)** | [`0xDf3f3743768c2609F3b33d9dEad43E95DC016588`](https://robinhoodchain.blockscout.com/address/0xDf3f3743768c2609F3b33d9dEad43E95DC016588) |
| Ajo contract (second version: creator last, invite-only) | [`0x75A67714D383F80979C300e22ceDB5Dd6DDd09ed`](https://robinhoodchain.blockscout.com/address/0x75A67714D383F80979C300e22ceDB5Dd6DDd09ed) |
| Ajo contract (first version) | [`0x114B2848e0a62376895595471844f6c587dc008C`](https://robinhoodchain.blockscout.com/address/0x114B2848e0a62376895595471844f6c587dc008C) |
| USDG (savings) | [`0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`](https://robinhoodchain.blockscout.com/token/0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168) |
| $WIF, World is Flat (bond) | [`0x5173b8eA6923c2d40267890D45C46a3480954773`](https://robinhoodchain.blockscout.com/token/0x5173b8eA6923c2d40267890D45C46a3480954773) |

**The current version** adds vouching to the second; its code is byte for byte the tested build in this repository.

**The second version** ran a real invite-only circle in which a member missed a round. The creator invited one wallet, which joined and took the first turn (the creator is last). The creator then did not pay round 1, so their 100 $WIF bond went to the member who kept paying. That member received its round 1 pot, was refunded its round 2 payment (the creator's turn, forfeited), and claimed 200 $WIF at the end: its own bond plus the lost one. Afterwards the contract held nothing (8 transactions).

**The first version** ran a complete real circle with two members: create, join, four payments, two rounds closed, two pots withdrawn and two bonds claimed (12 transactions). Afterwards the contract held no USDG and no $WIF, and both members were back to their starting balances.

Testing that version against its own code showed a way to cheat: the creator set the bond **and** took the first pot, so a small bond made "take the pot and leave" profitable. The second version fixed this (creator last, invite-only circles); the current one keeps those fixes and adds vouching.

## Repository

```
contracts/   Foundry: src/Ajo.sol, test/Ajo.t.sol, script/Deploy.s.sol
app/         Vite + React + TypeScript, wagmi, viem, RainbowKit, Tailwind
```

### Run the tests

```sh
cd contracts
forge test
```

33 tests, including a fuzz test of random paying and skipping, an invariant test (thousands of random sequences of every action across several circles), and a measured random walk that checks after every step that every USDG and $WIF the contract holds is accounted for, the creator stays last, and nobody is listed twice. See [SECURITY.md](SECURITY.md) for the full review.

### Run the app

```sh
cd app
npm install
npm run dev
```

`app/.env` holds the public settings (contract address, deploy block, WalletConnect project ID). Put local overrides, such as a practice chain, in `app/.env.local`.

## Security

- Money only leaves through `withdraw` and `claimBond`, pulled by the person it belongs to. Nothing is pushed out while a round is being closed.
- `ReentrancyGuard`, `SafeERC20`, at most 20 members, fixed round deadlines from the start.
- One wallet cannot join twice, pay twice, collect a pot twice or claim a bond twice (each is tested).

**This is a hackathon build and the contract has not been audited. Use small amounts.**

Known limits:

- The bond is in $WIF and the payments are in USDG, and the contract has no price feed. If the bond is worth less than *amount per round × (members − 1)*, a member who takes an early pot could still profit by leaving. The create form shows that figure so the creator can set the bond accordingly; invite-only circles limit who can try.
- "Creator last" does not stop a creator who controls a second wallet: they can invite it and join with it first. The contract cannot tell two wallets belong to one person. Before joining, the app shows who takes their pot ahead of you and how much one of them could walk away with, so members can check they know everyone ahead of them. A test (`test_knownLimit_creatorWithSecondWalletCanStillGoFirst`) keeps this limit documented.
- If $WIF's price falls during a circle, the bond protects less.
- When every member has paid, rounds can close back to back. Nobody loses money; the round length works as a deadline, not a waiting time.
