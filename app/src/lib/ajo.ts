import { useEffect, useState } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useAjoEvents } from "./events";
import { ajoAbi, erc20Abi } from "../abi";
import { AJO_ADDRESS, USDG, WIF, chain } from "../config";

const ajo = { abi: ajoAbi, address: AJO_ADDRESS as `0x${string}`, chainId: chain.id } as const;
const enabled = AJO_ADDRESS !== "";
const POLL = 8_000;

export type Circle = {
  id: number;
  creator: `0x${string}`;
  contribution: bigint;
  bond: bigint;
  size: number;
  roundLength: number;
  startedAt: number; // unix seconds, 0 until full
  roundsSettled: number;
  defaults: number;
  penaltyPool: bigint;
  inviteOnly: boolean;
  name: string;
  members: readonly `0x${string}`[]; // payout order; the creator is always last
};

export type Phase = "open" | "running" | "finished";

export function phaseOf(c: Circle): Phase {
  if (c.startedAt === 0) return "open";
  if (c.roundsSettled >= c.size) return "finished";
  return "running";
}

/** Where the circle is right now, by the clock. */
export function clock(c: Circle, now: number) {
  const open = c.roundsSettled; // the oldest round not yet closed
  const deadline = c.startedAt + (open + 1) * c.roundLength;
  const timeLeft = Math.max(0, deadline - now);
  return { open, deadline, timeLeft, timeUp: c.startedAt > 0 && now >= deadline };
}

/** A clock that ticks every second, for countdowns. */
export function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

type RawCircle = {
  creator: `0x${string}`;
  contribution: bigint;
  bond: bigint;
  size: number;
  roundLength: number;
  startedAt: bigint;
  roundsSettled: number;
  defaults: number;
  penaltyPool: bigint;
  inviteOnly: boolean;
  name: string;
};

function toCircle(id: number, raw: RawCircle, members: readonly `0x${string}`[]): Circle {
  return {
    id,
    creator: raw.creator,
    contribution: raw.contribution,
    bond: raw.bond,
    size: Number(raw.size),
    roundLength: Number(raw.roundLength),
    startedAt: Number(raw.startedAt),
    roundsSettled: Number(raw.roundsSettled),
    defaults: Number(raw.defaults),
    penaltyPool: raw.penaltyPool,
    inviteOnly: raw.inviteOnly,
    name: raw.name,
    members,
  };
}

const LIST_LIMIT = 60;

/** The newest circles, newest first. */
export function useCircles() {
  const count = useReadContract({ ...ajo, functionName: "circleCount", query: { enabled, refetchInterval: POLL } });
  const n = Number(count.data ?? 0n);
  const ids = Array.from({ length: Math.min(n, LIST_LIMIT) }, (_, i) => n - 1 - i);

  const reads = useReadContracts({
    contracts: ids.flatMap((id) => [
      { ...ajo, functionName: "getCircle", args: [BigInt(id)] } as const,
      { ...ajo, functionName: "getMembers", args: [BigInt(id)] } as const,
    ]),
    query: { enabled: enabled && ids.length > 0, refetchInterval: POLL },
  });

  const circles: Circle[] = [];
  if (reads.data) {
    ids.forEach((id, i) => {
      const c = reads.data[i * 2];
      const m = reads.data[i * 2 + 1];
      if (c?.status === "success" && m?.status === "success") {
        circles.push(toCircle(id, c.result as RawCircle, m.result as readonly `0x${string}`[]));
      }
    });
  }
  return {
    circles,
    total: n,
    loading: count.isLoading || reads.isLoading,
    error: count.error ?? reads.error,
  };
}

export type MemberState = {
  address: `0x${string}`;
  position: number; // 0-based payout order
  defaulted: boolean;
  paidThisRound: boolean;
  bondClaimed: boolean;
  bondPaidBy?: `0x${string}`; // who locked this member's bond: themselves, or a voucher
};

/** One circle, with each member's standing in the open round. */
export function useCircle(id: number) {
  const base = useReadContracts({
    contracts: [
      { ...ajo, functionName: "getCircle", args: [BigInt(id)] },
      { ...ajo, functionName: "getMembers", args: [BigInt(id)] },
      { ...ajo, functionName: "bondShare", args: [BigInt(id)] },
    ],
    query: { enabled, refetchInterval: POLL },
  });

  const [rc, rm, rs] = base.data ?? [];
  const circle =
    rc?.status === "success" && rm?.status === "success"
      ? toCircle(id, rc.result as RawCircle, rm.result as readonly `0x${string}`[])
      : undefined;
  const bondShare = rs?.status === "success" ? (rs.result as bigint) : undefined;

  const members = circle?.members ?? [];
  const round = BigInt(circle?.roundsSettled ?? 0);
  const per = useReadContracts({
    contracts: members.flatMap((m) => [
      { ...ajo, functionName: "isDefaulted", args: [BigInt(id), m] } as const,
      { ...ajo, functionName: "hasPaid", args: [BigInt(id), round, m] } as const,
      { ...ajo, functionName: "bondClaimed", args: [BigInt(id), m] } as const,
      { ...ajo, functionName: "bondPaidBy", args: [BigInt(id), m] } as const,
    ]),
    query: { enabled: enabled && members.length > 0, refetchInterval: POLL },
  });

  const states: MemberState[] = members.map((address, i) => {
    const r = per.data;
    const ok = (k: number) => r?.[i * 4 + k]?.status === "success" && r?.[i * 4 + k]?.result === true;
    const payer = r?.[i * 4 + 3]?.status === "success" ? (r[i * 4 + 3].result as `0x${string}`) : undefined;
    return { address, position: i, defaulted: ok(0), paidThisRound: ok(1), bondClaimed: ok(2), bondPaidBy: payer };
  });

  const pot = useReadContract({
    ...ajo,
    functionName: "roundPot",
    args: [BigInt(id), round],
    query: { enabled: enabled && !!circle, refetchInterval: POLL },
  });

  const notFound = rc?.status === "failure";
  return {
    circle,
    members: states,
    bondShare,
    potSoFar: pot.data as bigint | undefined,
    loading: base.isLoading,
    notFound,
    error: base.error,
  };
}

/** Your wallet: token balances and what the contract owes you. */
export function useWallet() {
  const { address } = useAccount();
  const on = enabled && !!address;
  const r = useReadContracts({
    contracts: [
      { abi: erc20Abi, address: USDG.address, functionName: "balanceOf", args: [address!], chainId: chain.id },
      { abi: erc20Abi, address: WIF.address, functionName: "balanceOf", args: [address!], chainId: chain.id },
      { ...ajo, functionName: "owed", args: [address!] },
    ],
    query: { enabled: on, refetchInterval: POLL },
  });
  const get = (i: number) => (r.data?.[i]?.status === "success" ? (r.data[i].result as bigint) : undefined);
  return { address, usdg: get(0), wif: get(1), owed: get(2) };
}

export type SettledRound = { round: number; recipient: `0x${string}`; pot: bigint; refunded: boolean; tx: `0x${string}` };

/** Past rounds of a circle, from the contract's RoundSettled events (needs VITE_AJO_DEPLOY_BLOCK). */
export function useHistory(id: number) {
  const events = useAjoEvents();
  const data: SettledRound[] | undefined = events.data
    ?.filter((e) => e.eventName === "RoundSettled" && e.args.id === BigInt(id))
    .map((e) => ({
      round: Number(e.args.round),
      recipient: e.args.recipient as `0x${string}`,
      pot: e.args.pot as bigint,
      refunded: e.args.refunded as boolean,
      tx: e.transactionHash,
    }));
  return { data };
}

export { enabled as contractConfigured };

/** Whether `who` may join circle `id`: always for open circles; otherwise only if invited (or the creator). */
export function useCanJoin(c: Circle | undefined, who: `0x${string}` | undefined) {
  const check = enabled && !!c && c.inviteOnly && !!who && who.toLowerCase() !== c.creator.toLowerCase();
  const r = useReadContract({
    ...ajo,
    functionName: "isInvited",
    args: [BigInt(c?.id ?? 0), who ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: check, refetchInterval: POLL },
  });
  if (!c || !who) return undefined;
  if (!c.inviteOnly || who.toLowerCase() === c.creator.toLowerCase()) return true;
  return r.data as boolean | undefined;
}

const ZERO = "0x0000000000000000000000000000000000000000";

/** Who, if anyone, has locked a bond for `who` in circle `id` that `who` has not used yet. */
export function useVouchFor(id: number, who: `0x${string}` | undefined) {
  const r = useReadContract({
    ...ajo,
    functionName: "vouchFrom",
    args: [BigInt(id), who ?? ZERO],
    query: { enabled: enabled && !!who, refetchInterval: POLL },
  });
  const v = r.data as `0x${string}` | undefined;
  return v && v !== ZERO ? v : undefined;
}

/**
 * Vouches `voucher` made in circle `id` that are still waiting to be used
 * (the person has not joined and the voucher has not taken the bond back).
 * Found from the event history, then confirmed against the contract.
 */
export function usePendingVouches(id: number, voucher: `0x${string}` | undefined) {
  const events = useAjoEvents();
  const me = voucher?.toLowerCase();
  const candidates = [
    ...new Set(
      (events.data ?? [])
        .filter((e) => e.eventName === "Vouched" && Number(e.args.id) === id && String(e.args.voucher).toLowerCase() === me)
        .map((e) => e.args.member as `0x${string}`),
    ),
  ];
  const r = useReadContracts({
    contracts: candidates.map((m) => ({ ...ajo, functionName: "vouchFrom", args: [BigInt(id), m] }) as const),
    query: { enabled: enabled && candidates.length > 0, refetchInterval: POLL },
  });
  return candidates.filter((_, i) => r.data?.[i]?.status === "success" && String(r.data[i].result).toLowerCase() === me);
}
