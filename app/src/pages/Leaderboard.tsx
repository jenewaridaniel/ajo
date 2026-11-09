import { useAccount } from "wagmi";
import { USDG, WIF } from "../config";
import { buildLeaderboard, historyAvailable, reliability, useAjoEvents, type Saver } from "../lib/events";
import { amount } from "../lib/format";
import { Addr, Badge, Button, Eyebrow, Panel } from "../components/ui";

export default function Leaderboard() {
  const events = useAjoEvents();
  const { address } = useAccount();
  const savers = events.data ? buildLeaderboard(events.data) : [];
  const me = address?.toLowerCase();
  const myRank = savers.findIndex((s) => s.address.toLowerCase() === me);

  const totals = savers.reduce(
    (t, s) => ({ rounds: t.rounds + s.roundsPaid, saved: t.saved + s.usdgSaved, pots: t.pots + s.potsTaken }),
    { rounds: 0, saved: 0n, pots: 0 },
  );

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>Track record</Eyebrow>
          <Eyebrow tone="lime">× × ×</Eyebrow>
          <Eyebrow>Onchain</Eyebrow>
        </div>
        <h1 className="mt-6 font-display text-5xl font-bold uppercase leading-[0.9] sm:text-7xl lg:text-8xl">Leader­board</h1>
        <p className="mt-4 max-w-2xl text-dim">
          The most reliable savers across every circle. Ranked by rounds paid on time, then by USDG saved. Every number comes from the contract's own record on
          the chain.
        </p>
      </div>

      {!historyAvailable ? (
        <Panel label="× Not set up">
          <p className="text-amber">The leaderboard needs VITE_AJO_DEPLOY_BLOCK (the contract's deploy block) in the app settings.</p>
        </Panel>
      ) : events.isLoading ? (
        <Skeleton />
      ) : events.error ? (
        <Panel label="× Could not load">
          <p className="text-red">Could not read the history from the chain right now. It will retry on its own.</p>
        </Panel>
      ) : savers.length === 0 ? (
        <Panel label="× × × Empty" className="text-center">
          <h2 className="font-display text-2xl uppercase">No one on the board yet</h2>
          <p className="mx-auto mt-2 max-w-md text-dim">Join a circle and pay your first round to get on it.</p>
          <Button className="mt-5" onClick={() => (window.location.hash = "/")}>
            See circles
          </Button>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-3 border-l border-t border-line bg-panel *:border-b *:border-r *:border-line">
            <Total label="Savers" value={String(savers.length)} />
            <Total label="Rounds paid" value={String(totals.rounds)} />
            <Total label="USDG saved" value={amount(totals.saved, USDG.decimals, 2)} />
          </div>

          {myRank >= 0 && (
            <p className="border border-violet px-3 py-2">
              You are <span className="font-display">#{myRank + 1}</span> of {savers.length}.
            </p>
          )}

          <ol className="border-t border-line">
            {savers.map((s, i) => (
              <Row key={s.address} s={s} rank={i + 1} isMe={s.address.toLowerCase() === me} />
            ))}
          </ol>

          <p className="text-dim">
            Reliability is rounds paid ÷ (rounds paid + rounds missed). "Finished" counts circles where the member paid every round and took their bond back.
            "WIF earned" is their share of bonds lost by members who missed.
          </p>
        </>
      )}
    </div>
  );
}

function Row({ s, rank, isMe }: { s: Saver; rank: number; isMe: boolean }) {
  const r = reliability(s);
  const top = rank === 1;
  return (
    <li
      className={`grid gap-x-6 gap-y-3 border-x border-b p-4 sm:grid-cols-[4rem_1.4fr_repeat(5,1fr)] sm:items-center ${
        top ? "border-lime-deep bg-lime text-on-lime" : isMe ? "border-violet bg-panel" : "border-line bg-panel"
      }`}
    >
      <span className={`tabular font-display text-3xl font-bold leading-none ${top ? "" : rank <= 3 ? "text-lime" : "text-dim"}`}>
        {String(rank).padStart(2, "0")}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <span className={top ? "[&_a:hover]:text-on-lime" : ""}>
          <Addr address={s.address} />
        </span>
        {s.missed === 0 && s.roundsPaid > 0 && <Badge tone={top ? "plain" : "lime"}>Never missed</Badge>}
      </div>
      <Cell top={top} label="Rounds paid" value={String(s.roundsPaid)} />
      <Cell top={top} label="USDG saved" value={amount(s.usdgSaved, USDG.decimals, 2)} />
      <Cell top={top} label="Reliability" value={r === undefined ? "–" : `${r}%`} warn={r !== undefined && r < 100} />
      <Cell top={top} label="Pots taken" value={String(s.potsTaken)} />
      <Cell top={top} label="Finished · WIF earned" value={`${s.finished} · ${amount(s.wifEarned, WIF.decimals, 2)}`} />
    </li>
  );
}

function Cell({ label, value, top, warn }: { label: string; value: string; top: boolean; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:block">
      <p className={`font-display text-xs uppercase tracking-wider ${top ? "opacity-70" : "text-dim"}`}>{label}</p>
      <p className={`tabular sm:mt-1 ${!top && warn ? "text-amber" : ""}`}>{value}</p>
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4">
      <Eyebrow>{label}</Eyebrow>
      <p className="tabular mt-2 font-display text-2xl sm:text-3xl">{value}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-label="Loading the leaderboard" className="border-t border-line">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex h-[76px] items-center gap-6 border-x border-b border-line bg-panel px-4">
          <div className="h-6 w-10 animate-pulse bg-line" />
          <div className="h-4 w-40 animate-pulse bg-line" />
          <div className="ml-auto hidden h-4 w-80 animate-pulse bg-line sm:block" />
        </div>
      ))}
    </div>
  );
}
