import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { PublicClient } from "viem";
import { ajoAbi } from "../abi";
import { AJO_ADDRESS, AJO_DEPLOY_BLOCK, chain } from "../config";

/**
 * Every event the contract has emitted since it was deployed, in chain order.
 * The public RPC refuses a query that matches more than 10,000 logs, so a
 * refused range is split in half and fetched piece by piece.
 */
async function fetchRange(client: PublicClient, from: bigint, to: bigint): Promise<AjoEvent[]> {
  try {
    const logs = await client.getContractEvents({ abi: ajoAbi, address: AJO_ADDRESS as `0x${string}`, fromBlock: from, toBlock: to });
    return logs as unknown as AjoEvent[];
  } catch (e) {
    if (to > from && /exceeds limit|too many|range/i.test(String((e as Error)?.message))) {
      const mid = from + (to - from) / 2n;
      return [...(await fetchRange(client, from, mid)), ...(await fetchRange(client, mid + 1n, to))];
    }
    throw e;
  }
}

export type AjoEvent = {
  eventName: string;
  args: Record<string, unknown>;
  blockNumber: bigint;
  logIndex: number;
  transactionHash: `0x${string}`;
};

export const historyAvailable = AJO_ADDRESS !== "" && AJO_DEPLOY_BLOCK !== undefined;

export function useAjoEvents() {
  const client = usePublicClient({ chainId: chain.id });
  return useQuery({
    queryKey: ["ajo-events", AJO_ADDRESS],
    enabled: historyAvailable && !!client,
    refetchInterval: 20_000,
    staleTime: 10_000,
    queryFn: async () => {
      const latest = await client!.getBlockNumber();
      return fetchRange(client! as PublicClient, AJO_DEPLOY_BLOCK!, latest);
    },
  });
}

export type Saver = {
  address: `0x${string}`;
  roundsPaid: number;
  usdgSaved: bigint;
  missed: number;
  potsTaken: number;
  usdgReceived: bigint;
  circles: number; // joined and did not leave
  finished: number; // circles finished in good standing (bond claimed back)
  wifEarned: bigint; // share of other members' lost bonds
};

/** Turn the raw event history into one row per wallet. */
export function buildLeaderboard(events: AjoEvent[]): Saver[] {
  const bondOf = new Map<bigint, bigint>();
  const defaultedIn = new Set<string>(); // `${circle}:${member}`
  const rows = new Map<string, Saver>();
  const row = (a: unknown): Saver => {
    const address = a as `0x${string}`;
    const key = address.toLowerCase();
    let r = rows.get(key);
    if (!r) {
      r = { address, roundsPaid: 0, usdgSaved: 0n, missed: 0, potsTaken: 0, usdgReceived: 0n, circles: 0, finished: 0, wifEarned: 0n };
      rows.set(key, r);
    }
    return r;
  };

  for (const e of events) {
    const a = e.args;
    switch (e.eventName) {
      case "CircleCreated":
        bondOf.set(a.id as bigint, a.bond as bigint);
        break;
      case "Joined":
        row(a.member).circles += 1;
        break;
      case "Left":
        row(a.member).circles -= 1;
        break;
      case "Contributed": {
        const r = row(a.member);
        r.roundsPaid += 1;
        r.usdgSaved += a.amount as bigint;
        break;
      }
      case "Defaulted":
        row(a.member).missed += 1;
        defaultedIn.add(`${a.id}:${String(a.member).toLowerCase()}`);
        break;
      case "RoundSettled":
        if (!a.refunded) {
          const r = row(a.recipient);
          r.potsTaken += 1;
          r.usdgReceived += a.pot as bigint;
        }
        break;
      case "BondClaimed": {
        const r = row(a.member);
        // If everyone in a circle missed, each takes back only their own bond:
        // that is not a finish in good standing.
        if (!defaultedIn.has(`${a.id}:${String(a.member).toLowerCase()}`)) {
          r.finished += 1;
          const bond = bondOf.get(a.id as bigint) ?? 0n;
          const amt = a.amount as bigint;
          if (amt > bond) r.wifEarned += amt - bond;
        }
        break;
      }
    }
  }

  return [...rows.values()]
    .filter((r) => r.roundsPaid > 0 || r.missed > 0 || r.circles > 0)
    .sort(
      (x, y) =>
        y.roundsPaid - x.roundsPaid ||
        (y.usdgSaved > x.usdgSaved ? 1 : y.usdgSaved < x.usdgSaved ? -1 : 0) ||
        x.missed - y.missed ||
        y.finished - x.finished,
    );
}

/** Paid ÷ (paid + missed), as a whole percent; undefined before any round counts. */
export function reliability(s: Saver): number | undefined {
  const total = s.roundsPaid + s.missed;
  return total === 0 ? undefined : Math.round((s.roundsPaid / total) * 100);
}
