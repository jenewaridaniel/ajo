import { useState } from "react";
import { isAddress, parseEventLogs, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ajoAbi } from "../abi";
import { AJO_ADDRESS, USDG, WIF } from "../config";
import { useWallet } from "../lib/ajo";
import { amount, duration } from "../lib/format";
import { go } from "../lib/route";
import { useTx } from "../lib/tx";
import { Button, Panel, TxStatus } from "../components/ui";

const ROUND_CHOICES = [
  { label: "1 minute (for testing; the shortest the contract allows)", seconds: 60 },
  { label: "5 minutes (for trying it out)", seconds: 300 },
  { label: "1 hour", seconds: 3600 },
  { label: "1 day", seconds: 86400 },
  { label: "1 week", seconds: 7 * 86400 },
  { label: "2 weeks", seconds: 14 * 86400 },
  { label: "30 days", seconds: 30 * 86400 },
];

function parse(value: string, decimals: number): bigint | null {
  if (!/^\d*\.?\d*$/.test(value.trim()) || value.trim() === "" || value.trim() === ".") return null;
  try {
    return parseUnits(value.trim(), decimals);
  } catch {
    return null;
  }
}

/** Wallet addresses typed or pasted in any mix of commas, spaces and new lines. */
function parseAddresses(text: string): { good: `0x${string}`[]; bad: string[] } {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const seen = new Set<string>();
  const good: `0x${string}`[] = [];
  const bad: string[] = [];
  for (const p of parts) {
    if (!isAddress(p, { strict: false })) bad.push(p);
    else if (!seen.has(p.toLowerCase())) {
      seen.add(p.toLowerCase());
      good.push(p as `0x${string}`);
    }
  }
  return { good, bad };
}

const field = "mt-1.5 w-full border border-line bg-void px-3.5 py-2.5 text-base outline-none focus:border-lime";

export default function CreateCircle() {
  const { isConnected, address } = useAccount();
  const { wif } = useWallet();
  const tx = useTx();

  const [name, setName] = useState("");
  const [contribution, setContribution] = useState("");
  const [bond, setBond] = useState("");
  const [size, setSize] = useState("3");
  const [roundLength, setRoundLength] = useState(String(ROUND_CHOICES[2].seconds));
  const [inviteOnly, setInviteOnly] = useState(true);
  const [inviteText, setInviteText] = useState("");

  const c = parse(contribution, USDG.decimals);
  const b = parse(bond, WIF.decimals);
  const n = Number(size);
  const len = Number(roundLength);
  const nameBytes = new TextEncoder().encode(name.trim()).length;
  const parsed = parseAddresses(inviteText);
  // You are in by default; listing yourself is harmless but pointless.
  const invited = parsed.good.filter((a) => a.toLowerCase() !== address?.toLowerCase());

  const problems: string[] = [];
  if (nameBytes === 0) problems.push("Give the circle a name.");
  if (nameBytes > 48) problems.push("The name is too long (48 characters at most).");
  if (!c || c === 0n) problems.push("Enter how much each member pays each round.");
  if (!b || b === 0n) problems.push("Enter the bond each member locks.");
  if (!Number.isInteger(n) || n < 2 || n > 20) problems.push("A circle has 2 to 20 members.");
  if (inviteOnly && parsed.bad.length > 0) problems.push(`Not a wallet address: ${parsed.bad.slice(0, 3).join(", ")}${parsed.bad.length > 3 ? "…" : ""}`);
  if (inviteOnly && parsed.bad.length === 0 && invited.length === 0) problems.push("Add at least one wallet to invite, or let anyone with the link join.");
  if (inviteOnly && invited.length > 50) problems.push("You can invite 50 wallets at most here; add more from the circle page.");
  if (b && wif !== undefined && wif < b) problems.push(`You have ${amount(wif, WIF.decimals)} WIF; the bond needs ${amount(b, WIF.decimals)}.`);

  const ok = problems.length === 0 && c && b;

  async function submit() {
    if (!ok) return;
    const receipt = await tx.run(
      { abi: ajoAbi, address: AJO_ADDRESS as `0x${string}`, functionName: "createCircle", args: [name.trim(), c, b, n, len, inviteOnly ? invited : []] },
      "Create the circle",
      { token: WIF.address, amount: b, symbol: "WIF" },
    );
    if (!receipt) return;
    const [created] = parseEventLogs({ abi: ajoAbi, logs: receipt.logs, eventName: "CircleCreated" });
    if (created) go(`/c/${created.args.id}`);
    else go("/");
  }

  return (
    <div className="mx-auto max-w-2xl">
      <a href="#/" className="text-dim hover:underline">← All circles</a>
      <h1 className="mt-3 font-display text-4xl font-bold uppercase leading-none sm:text-6xl">Start a circle</h1>
      <p className="mt-2 text-dim">
        You set the terms, so you take the <strong className="text-ink">last</strong> pot: everyone else is paid before you, so nobody can accuse you of setting a
        weak bond to take the first pot yourself. Share the link and the circle starts once it is full.
      </p>

      <Panel className="mt-6">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="block">
            <span className="font-display text-xs uppercase tracking-wider text-dim">Name</span>
            <input className={field} value={name} maxLength={48} onChange={(e) => setName(e.target.value)} placeholder="Market women, Lagos" />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="font-display text-xs uppercase tracking-wider text-dim">Each member pays, every round</span>
              <div className="relative">
                <input className={field} inputMode="decimal" value={contribution} onChange={(e) => setContribution(e.target.value)} placeholder="1" />
                <span className="pointer-events-none absolute right-3.5 top-1/2 mt-0.75 -translate-y-1/2 text-dim">USDG</span>
              </div>
            </label>
            <label className="block">
              <span className="font-display text-xs uppercase tracking-wider text-dim">Bond to join</span>
              <div className="relative">
                <input className={field} inputMode="decimal" value={bond} onChange={(e) => setBond(e.target.value)} placeholder="100" />
                <span className="pointer-events-none absolute right-3.5 top-1/2 mt-0.75 -translate-y-1/2 text-dim">WIF</span>
              </div>
              {wif !== undefined && <span className="mt-1 block text-dim">You have {amount(wif, WIF.decimals)} WIF</span>}
            </label>
            <label className="block">
              <span className="font-display text-xs uppercase tracking-wider text-dim">Members (2–20)</span>
              <input className={field} type="number" min={2} max={20} value={size} onChange={(e) => setSize(e.target.value)} />
            </label>
            <label className="block">
              <span className="font-display text-xs uppercase tracking-wider text-dim">Each round lasts</span>
              <select className={field} value={roundLength} onChange={(e) => setRoundLength(e.target.value)}>
                {ROUND_CHOICES.map((r) => (
                  <option key={r.seconds} value={r.seconds}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="space-y-3">
            <legend className="font-display text-xs uppercase tracking-wider text-dim">Who can join</legend>
            <label className="flex min-h-11 cursor-pointer items-start gap-3">
              <input type="radio" name="who" className="mt-1.5 accent-lime" checked={inviteOnly} onChange={() => setInviteOnly(true)} />
              <span>
                <span className="font-semibold">Only wallets I invite</span> <span className="text-lime">(recommended)</span>
                <span className="block text-dim">Strangers can't rush in to grab the early turns. You can add more wallets until the circle starts.</span>
              </span>
            </label>
            {inviteOnly && (
              <label className="block pl-7">
                <span className="font-display text-xs uppercase tracking-wider text-dim">Wallets to invite</span>
                <textarea
                  className={`${field} min-h-28 font-sans`}
                  value={inviteText}
                  onChange={(e) => setInviteText(e.target.value)}
                  placeholder={"0x… one per line (or separated by commas)"}
                  spellCheck={false}
                />
                <span className="mt-1 block text-dim">
                  {invited.length} wallet{invited.length === 1 ? "" : "s"} invited. Ask each person for their Robinhood Chain (0x…) address.
                </span>
              </label>
            )}
            <label className="flex min-h-11 cursor-pointer items-start gap-3">
              <input type="radio" name="who" className="mt-1.5 accent-lime" checked={!inviteOnly} onChange={() => setInviteOnly(false)} />
              <span>
                <span className="font-semibold">Anyone with the link</span>
                <span className="block text-dim">Turns go to whoever joins first.</span>
              </span>
            </label>
          </fieldset>

          {ok && (
            <div className="bg-void border border-line p-4 leading-relaxed">
              <p>
                {n} members each pay <strong>{amount(c, USDG.decimals)} USDG</strong> every {duration(len)}, for {n} rounds (
                {duration(len * n)} in all). Each round one member takes the pot of{" "}
                <strong>{amount(c * BigInt(n), USDG.decimals)} USDG</strong>, in joining order, with you last. If everyone pays, each member puts in{" "}
                {amount(c * BigInt(n), USDG.decimals)} USDG in total and takes out the same.
              </p>
              <p className="mt-2">
                Each member locks <strong>{amount(b, WIF.decimals)} WIF</strong>. It comes back at the end, plus a share of any bonds lost by
                members who missed a round.
              </p>
              <p className="mt-2 text-dim">
                Choosing the bond: someone who takes an early pot and then stops paying skips up to{" "}
                {amount(c * BigInt(n - 1), USDG.decimals)} USDG of payments. For the bond to make that a bad deal, it should be worth at least that much. You are paid last, so you are the one this protects most.
              </p>
            </div>
          )}

          {problems.length > 0 && (contribution || bond || name) && (
            <ul className="list-disc space-y-1 pl-5 text-amber">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}

          {isConnected ? (
            <div>
              <Button type="submit" disabled={!ok || tx.busy} className="w-full sm:w-auto">
                Create and lock my bond
              </Button>
              <p className="mt-2 text-dim">Your wallet asks up to twice: first to allow Ajo to take exactly the WIF bond (skipped if already allowed), then to create the circle.</p>
            </div>
          ) : (
            <ConnectButton label="Connect a wallet to create" />
          )}
          <TxStatus step={tx.step} error={tx.error} />
        </form>
      </Panel>
    </div>
  );
}
