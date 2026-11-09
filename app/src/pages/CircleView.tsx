import { useState } from "react";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ajoAbi } from "../abi";
import { AJO_ADDRESS, USDG, WIF, explorer } from "../config";
import { clock, phaseOf, useCanJoin, useCircle, useHistory, useNow, useWallet, type Circle, type MemberState, type SettledRound } from "../lib/ajo";
import { amount, countdown, duration } from "../lib/format";
import { useTx } from "../lib/tx";
import { Addr, Badge, Button, Eyebrow, Panel, Stat, TxStatus } from "../components/ui";
import { RobinSays } from "../components/robin";

const ajo = { abi: ajoAbi, address: AJO_ADDRESS as `0x${string}` } as const;

export default function CircleView({ id }: { id: number }) {
  const { circle, members, bondShare, potSoFar, loading, notFound } = useCircle(id);
  const history = useHistory(id);
  const now = useNow();

  if (notFound)
    return (
      <Panel className="mx-auto max-w-xl text-center">
        <h1 className="text-lg font-semibold">There is no circle #{id}</h1>
        <a href="#/" className="mt-2 inline-block text-lime underline">See all circles</a>
      </Panel>
    );
  if (loading || !circle) return <p className="text-dim">Loading circle…</p>;

  const phase = phaseOf(circle);
  const pot = circle.contribution * BigInt(circle.size);
  const rounds = new Map((history.data ?? []).map((r) => [r.round, r]));

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <a href="#/" className="font-display text-xs uppercase tracking-wider text-dim hover:text-lime">← All circles</a>
          <Eyebrow tone="lime">× × ×</Eyebrow>
          <Eyebrow>Circle #{circle.id}</Eyebrow>
        </div>
        <h1 className="mt-6 wrap-break-word font-display text-4xl font-bold uppercase leading-[0.95] sm:text-6xl lg:text-7xl">{circle.name}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {phase === "open" && <Badge tone="lime">Waiting for members</Badge>}
          {phase === "running" && <Badge tone="lime">Running</Badge>}
          {phase === "finished" && <Badge>Finished</Badge>}
          {circle.inviteOnly && <Badge>Invite only</Badge>}
          <span className="text-dim">
            started by <Addr address={circle.creator} />
          </span>
          <ShareButton />
        </div>
      </div>

      <div className="grid grid-cols-2 border-l border-t border-line bg-panel sm:grid-cols-5 *:border-b *:border-r *:border-line">
        <Stat label="Each round" value={`${amount(circle.contribution, USDG.decimals)} USDG`} hint="per member" />
        <Stat label="Pot" value={`${amount(pot, USDG.decimals)} USDG`} hint="if everyone pays" />
        <Stat label="Bond" value={`${amount(circle.bond, WIF.decimals)} WIF`} hint="per member" />
        <Stat label="Round length" value={duration(circle.roundLength)} />
        <Stat label="Members" value={`${circle.members.length} of ${circle.size}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-6">
          {phase === "open" && <OpenActions circle={circle} />}
          {phase === "running" && <RoundPanel circle={circle} members={members} potSoFar={potSoFar} now={now} />}
          {phase === "finished" && <FinishedPanel circle={circle} members={members} bondShare={bondShare} />}
          <PenaltyNote circle={circle} />
        </div>
        <MemberList circle={circle} members={members} now={now} rounds={rounds} />
      </div>
    </div>
  );
}

function useMe(members: MemberState[]) {
  const { address } = useAccount();
  return members.find((m) => m.address.toLowerCase() === address?.toLowerCase());
}

function ShareButton() {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      kind="quiet"
      className="min-h-0 px-2 py-1"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard blocked: the address bar still has the link */
        }
      }}
    >
      {copied ? "Link copied" : "Copy invite link"}
    </Button>
  );
}

function OpenActions({ circle }: { circle: Circle }) {
  const { isConnected, address } = useAccount();
  const { wif } = useWallet();
  const tx = useTx();
  const isMember = circle.members.some((m) => m.toLowerCase() === address?.toLowerCase());
  const isCreator = address?.toLowerCase() === circle.creator.toLowerCase();
  const canJoin = useCanJoin(circle, address);
  const missing = circle.size - circle.members.length;
  const short = wif !== undefined && wif < circle.bond;
  // The creator always sits last, so a new member takes the turn just before them.
  const creatorIn = circle.members.some((m) => m.toLowerCase() === circle.creator.toLowerCase());
  const myTurn = creatorIn ? circle.members.length : circle.members.length + 1;

  return (
    <Panel>
      <h2 className="font-display text-lg uppercase">
        Waiting for {missing} more member{missing === 1 ? "" : "s"}
      </h2>
      <p className="mt-1 text-dim">
        The circle starts by itself the moment the last member joins, and round 1 begins straight away. Until then, any member can leave and take their bond back.
      </p>
      <div className="mt-4">
        {!isConnected ? (
          <ConnectButton label="Connect a wallet to join" />
        ) : isMember ? (
          <Button kind="secondary" disabled={tx.busy} onClick={() => tx.run({ ...ajo, functionName: "leave", args: [BigInt(circle.id)] }, "Leave the circle")}>
            Leave and take my bond back
          </Button>
        ) : canJoin === undefined ? (
          <p className="text-dim">Checking the invite list…</p>
        ) : canJoin === false ? (
          <p className="border border-amber px-3 py-2 text-amber">
            This circle is invite-only, and this wallet is not on the list. Send your address ({address?.slice(0, 6)}…{address?.slice(-4)}) to the person who started
            it so they can add you.
          </p>
        ) : (
          <>
            <Button
              disabled={tx.busy || short || canJoin === undefined}
              onClick={() =>
                tx.run({ ...ajo, functionName: "join", args: [BigInt(circle.id)] }, "Join the circle", {
                  token: WIF.address,
                  amount: circle.bond,
                  symbol: "WIF",
                })
              }
            >
              Join: lock {amount(circle.bond, WIF.decimals)} WIF
            </Button>
            <p className="mt-2 text-dim">
              You would take the pot in round {myTurn}. You will pay {amount(circle.contribution, USDG.decimals)} USDG each round for {circle.size} rounds.
              {wif !== undefined && <> You have {amount(wif, WIF.decimals)} WIF.</>}
            </p>
            {short && <p className="mt-2 text-amber">You need {amount(circle.bond, WIF.decimals)} WIF to join.</p>}
          </>
        )}
        <TxStatus step={tx.step} error={tx.error} hash={tx.lastHash} />
      </div>
      {isCreator && circle.inviteOnly && <InviteMore circle={circle} />}
      {!isMember && (
        <div className="mt-6 border-t border-line pt-5">
          <RobinSays size="sm">
            New to Ajo? Before you join, I can show you how it works and what you need in your wallet.{" "}
            <a href="#/guide" className="text-lime underline underline-offset-2">
              Open the guide
            </a>
          </RobinSays>
        </div>
      )}
    </Panel>
  );
}

/** The creator of an invite-only circle adds wallets until it starts. */
function InviteMore({ circle }: { circle: Circle }) {
  const tx = useTx();
  const [text, setText] = useState("");
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const bad = parts.filter((p) => !isAddress(p, { strict: false }));
  const good = [...new Set(parts.filter((p) => isAddress(p, { strict: false })).map((p) => p.toLowerCase()))] as `0x${string}`[];
  const ok = good.length > 0 && good.length <= 50 && bad.length === 0;
  return (
    <div className="mt-6 border-t border-line pt-5">
      <h3 className="font-display text-sm uppercase">Invite more people</h3>
      <p className="mt-1 text-dim">Only wallets on your list can join. Paste their Robinhood Chain addresses (0x…), one per line.</p>
      <textarea
        className="mt-2 min-h-24 w-full border border-line bg-void px-3.5 py-2.5 text-base outline-none focus:border-lime"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="0x…"
        spellCheck={false}
        aria-label="Wallets to invite"
      />
      {bad.length > 0 && <p className="mt-1 text-amber">Not a wallet address: {bad.slice(0, 3).join(", ")}</p>}
      <Button
        kind="secondary"
        className="mt-2"
        disabled={!ok || tx.busy}
        onClick={async () => {
          const r = await tx.run({ ...ajo, functionName: "invite", args: [BigInt(circle.id), good] }, "Invite");
          if (r) setText("");
        }}
      >
        Add {good.length || ""} to the invite list
      </Button>
      <TxStatus step={tx.step} error={tx.error} hash={tx.lastHash} />
    </div>
  );
}

function RoundPanel({ circle, members, potSoFar, now }: { circle: Circle; members: MemberState[]; potSoFar?: bigint; now: number }) {
  const { isConnected } = useAccount();
  const { usdg } = useWallet();
  const me = useMe(members);
  const pay = useTx();
  const settle = useTx();

  const k = clock(circle, now);
  const recipient = members[k.open];
  const good = members.filter((m) => !m.defaulted);
  const paid = good.filter((m) => m.paidThisRound).length;
  const allPaid = paid === good.length;
  const canPay = !!me && !me.defaulted && !me.paidThisRound && !k.timeUp;
  const canSettle = k.timeUp || allPaid;
  const short = usdg !== undefined && usdg < circle.contribution;
  const isRecipient = !!me && recipient?.address === me.address;

  // The round the clock is in. When it is ahead of the open round, that round's
  // time is up but nobody closed it yet; paying the live round closes it first.
  const clockRound = Math.min(circle.size, Math.floor((now - circle.startedAt) / circle.roundLength));
  const live = k.timeUp && clockRound === k.open + 1 && clockRound < circle.size ? clockRound : null;
  const liveLeft = live === null ? 0 : circle.startedAt + (live + 1) * circle.roundLength - now;
  const canPayLive = live !== null && !!me && !me.defaulted && me.paidThisRound;

  return (
    <Panel>
      <Eyebrow tone="lime">
        × Round {k.open + 1} of {circle.size}
      </Eyebrow>
      <div
        className={`tabular mt-3 font-display text-6xl font-bold leading-none sm:text-7xl ${k.timeUp || k.timeLeft < 60 ? "text-amber" : "text-ink"}`}
        aria-label="Time left in this round"
      >
        {k.timeUp ? "Time's up" : countdown(k.timeLeft)}
      </div>
      <p className="mt-4 text-dim">
        {recipient && (
          <>
            This pot goes to <Addr address={recipient.address} />
            {recipient.defaulted && ", but they missed a round, so it goes back to the members who paid"}.{" "}
          </>
        )}
        {paid} of {good.length} paid, <span className="text-ink">{amount(potSoFar, USDG.decimals)} USDG</span> in the pot.
      </p>

      {/* Progress as pixel blocks: one block per member in good standing. */}
      <div className="mt-4 flex gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={good.length} aria-valuenow={paid} aria-label="Members who have paid">
        {good.map((m, i) => (
          <span key={m.address} className={`h-4 flex-1 ${i < paid ? "bg-lime" : "border border-line bg-void"}`} />
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {!isConnected && <ConnectButton label="Connect a wallet to pay" />}

        {me && me.defaulted && (
          <p className="border border-red px-3 py-2 text-red">You missed a round, so your bond went to the members who kept paying. You can no longer pay into this circle.</p>
        )}
        {me && !me.defaulted && me.paidThisRound && (
          <p className="border border-lime px-3 py-2 text-lime">
            You have paid this round.{isRecipient && " This pot is yours: it reaches you when the round is closed."}
          </p>
        )}

        {canPay && (
          <div>
            <Button
              disabled={pay.busy || short}
              onClick={() =>
                pay.run({ ...ajo, functionName: "contribute", args: [BigInt(circle.id)] }, `Pay round ${k.open + 1}`, {
                  token: USDG.address,
                  amount: circle.contribution,
                  symbol: "USDG",
                })
              }
            >
              Pay {amount(circle.contribution, USDG.decimals)} USDG
            </Button>
            {short && <p className="mt-2 text-amber">Your wallet has {amount(usdg, USDG.decimals)} USDG; this round needs {amount(circle.contribution, USDG.decimals)}.</p>}
            {!short && <p className="mt-2 text-dim">Pay before the clock runs out, or you lose your {amount(circle.bond, WIF.decimals)} WIF bond.</p>}
            <TxStatus step={pay.step} error={pay.error} hash={pay.lastHash} />
          </div>
        )}

        {canPayLive && (
          <div className="border border-lime p-4">
            <Eyebrow tone="lime">
              × Round {live! + 1} is open · {countdown(liveLeft)} left
            </Eyebrow>
            <Button
              className="mt-3"
              disabled={pay.busy || short}
              onClick={() =>
                pay.run({ ...ajo, functionName: "contribute", args: [BigInt(circle.id)] }, `Pay round ${live! + 1}`, {
                  token: USDG.address,
                  amount: circle.contribution,
                  symbol: "USDG",
                })
              }
            >
              Pay round {live! + 1}: {amount(circle.contribution, USDG.decimals)} USDG
            </Button>
            <p className="mt-2 text-dim">Paying closes round {k.open + 1} first, so you never wait for anyone to close it.</p>
            {short && <p className="mt-2 text-amber">Your wallet has {amount(usdg, USDG.decimals)} USDG; a round needs {amount(circle.contribution, USDG.decimals)}.</p>}
            <TxStatus step={pay.step} error={pay.error} hash={pay.lastHash} />
          </div>
        )}

        {me && !me.defaulted && !me.paidThisRound && k.timeUp && (
          <p className="border border-amber px-3 py-2 text-amber">This round's time ran out before you paid. Closing it will count it as a missed round.</p>
        )}

        <div className="border-t border-line pt-4">
          <Button
            kind={canPay || canPayLive ? "secondary" : "primary"}
            disabled={!canSettle || settle.busy}
            onClick={() => settle.run({ ...ajo, functionName: "settleRound", args: [BigInt(circle.id)] }, `Close round ${k.open + 1}`)}
          >
            Close round {k.open + 1} and pay out
          </Button>
          <p className="mt-2 text-dim">
            {canSettle
              ? k.timeUp
                ? `Anyone can close it now; the next payment or bond claim also closes it on its own. Whoever has not paid round ${k.open + 1} loses their bond.`
                : "Everyone has paid, so anyone can close it early."
              : "Opens when everyone has paid or the time runs out. Anyone can press it, members or not."}
          </p>
          <TxStatus step={settle.step} error={settle.error} hash={settle.lastHash} />
        </div>
      </div>
    </Panel>
  );
}

function FinishedPanel({ circle, members, bondShare }: { circle: Circle; members: MemberState[]; bondShare?: bigint }) {
  const me = useMe(members);
  const tx = useTx();
  const everyoneMissed = circle.defaults >= circle.size;
  const canClaim = !!me && !me.bondClaimed && (!me.defaulted || everyoneMissed);

  return (
    <Panel>
      <h2 className="font-display text-lg uppercase">All {circle.size} rounds are done</h2>
      <p className="mt-1 text-dim">
        {circle.defaults === 0
          ? "Every member paid every round."
          : `${circle.defaults} member${circle.defaults === 1 ? "" : "s"} missed a round.`}{" "}
        {everyoneMissed
          ? "Since every member missed a round, each takes back their own bond."
          : `Each member who never missed takes back ${amount(bondShare, WIF.decimals)} WIF.`}
      </p>
      {me && (
        <div className="mt-4">
          {me.bondClaimed ? (
            <p className="border border-lime px-3 py-2 text-lime">You have claimed your bond.</p>
          ) : canClaim ? (
            <Button disabled={tx.busy} onClick={() => tx.run({ ...ajo, functionName: "claimBond", args: [BigInt(circle.id)] }, "Claim your bond")}>
              Claim {amount(bondShare, WIF.decimals)} WIF
            </Button>
          ) : (
            <p className="border border-red px-3 py-2 text-red">You missed a round, so your bond went to the members who kept paying.</p>
          )}
          <TxStatus step={tx.step} error={tx.error} hash={tx.lastHash} />
        </div>
      )}
    </Panel>
  );
}

function PenaltyNote({ circle }: { circle: Circle }) {
  if (circle.penaltyPool === 0n) return null;
  const lost = <strong className="text-ink">{amount(circle.penaltyPool, WIF.decimals)} WIF</strong>;
  const everyoneMissed = circle.defaults >= circle.size;
  const finished = phaseOf(circle) === "finished";
  return (
    <p className="border border-line px-4 py-3 text-dim">
      {everyoneMissed ? (
        <>{lost} in bonds was lost, but every member missed a round, so at the end each member takes back their own bond.</>
      ) : finished ? (
        <>{lost} in lost bonds was shared equally among the members who never missed a round.</>
      ) : (
        <>{lost} in lost bonds is held for the members who keep paying. It is shared out equally at the end.</>
      )}
    </p>
  );
}

function MemberList({ circle, members, now, rounds }: { circle: Circle; members: MemberState[]; now: number; rounds: Map<number, SettledRound> }) {
  const phase = phaseOf(circle);
  const k = clock(circle, now);
  const empty = Math.max(0, circle.size - members.length);
  const isCreator = (a: string) => a.toLowerCase() === circle.creator.toLowerCase();
  // While the circle fills up, the creator sits at the end of the list; show the
  // open seats before them, since new members take the turns ahead of the creator.
  const creatorWaiting = phase === "open" && members.length > 0 && isCreator(members[members.length - 1].address);
  const ahead = creatorWaiting ? members.slice(0, -1) : members;
  const firstOpen = ahead.length;

  return (
    <Panel>
      <h2 className="font-display text-lg uppercase">Members and payout order</h2>
      <ol className="mt-3 divide-y divide-line">
        {ahead.map((m) => {
          const turn = m.position;
          const settled = turn < circle.roundsSettled;
          const current = phase === "running" && turn === k.open;
          const past = rounds.get(turn);
          return (
            <li key={m.address} className={`flex flex-wrap items-center justify-between gap-2 py-3 ${current ? "-mx-2 bg-void border border-line px-2" : ""}`}>
              <div className="flex items-center gap-3">
                <span className="tabular w-20 shrink-0 font-display text-xs uppercase text-dim">Round {turn + 1}</span>
                <Addr address={m.address} />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {isCreator(m.address) && <Badge>Started it · paid last</Badge>}
                {current && <Badge tone="violet">Takes this pot</Badge>}
                {settled && past && !past.refunded && (
                  <a href={`${explorer}/tx/${past.tx}`} target="_blank" rel="noreferrer">
                    <Badge tone="lime">Took {amount(past.pot, USDG.decimals)} USDG</Badge>
                  </a>
                )}
                {settled && past?.refunded && <Badge>Pot refunded to payers</Badge>}
                {settled && !past && <Badge>Round closed</Badge>}
                {m.defaulted ? (
                  <Badge tone="red">Missed a round, bond lost</Badge>
                ) : phase === "running" ? (
                  m.paidThisRound ? (
                    <Badge tone="lime">Paid round {k.open + 1}</Badge>
                  ) : k.timeUp ? (
                    <Badge tone="red">Round {k.open + 1}: not paid in time</Badge>
                  ) : (
                    <Badge tone="amber">Round {k.open + 1}: not paid yet</Badge>
                  )
                ) : phase === "finished" && m.bondClaimed ? (
                  <Badge>Bond claimed</Badge>
                ) : null}
              </div>
            </li>
          );
        })}
        {Array.from({ length: empty }, (_, i) => (
          <li key={`empty-${i}`} className="flex items-center gap-3 py-3 text-dim">
            <span className="tabular w-20 shrink-0 font-display text-xs uppercase">Round {firstOpen + i + 1}</span>
            Open seat
          </li>
        ))}
        {creatorWaiting && (
          <li className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="flex items-center gap-3">
              <span className="tabular w-20 shrink-0 font-display text-xs uppercase text-dim">Round {circle.size}</span>
              <Addr address={members[members.length - 1].address} />
            </div>
            <Badge>Started it · paid last</Badge>
          </li>
        )}
      </ol>
    </Panel>
  );
}
