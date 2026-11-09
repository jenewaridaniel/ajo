import type { ReactNode } from "react";
import { useAccount } from "wagmi";
import { explorer } from "../config";
import { short } from "../lib/format";

/** A bordered box on the grid, with an optional eyebrow label. Never nest these. */
export function Panel({ children, label, className = "" }: { children: ReactNode; label?: ReactNode; className?: string }) {
  return (
    <section className={`border border-line bg-panel p-5 sm:p-6 ${className}`}>
      {label && <Eyebrow className="mb-4">{label}</Eyebrow>}
      {children}
    </section>
  );
}

/** Small uppercase pixel label, like "× × ×  ROUND 2". */
export function Eyebrow({ children, className = "", tone = "dim" }: { children: ReactNode; className?: string; tone?: "dim" | "lime" }) {
  return (
    <p className={`font-display text-xs uppercase tracking-wider ${tone === "lime" ? "text-lime" : "text-dim"} ${className}`}>
      {children}
    </p>
  );
}

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  kind?: "primary" | "secondary" | "quiet";
  type?: "button" | "submit";
  className?: string;
};

export function Button({ children, onClick, disabled, kind = "primary", type = "button", className = "" }: ButtonProps) {
  const look = {
    primary:
      "bg-lime text-on-lime shadow-block hover:-translate-x-px hover:-translate-y-px active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
    secondary: "border border-lime text-lime hover:bg-lime hover:text-on-lime",
    quiet: "text-lime underline-offset-4 hover:underline",
  }[kind];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 font-display text-base uppercase transition duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:translate-none ${look} ${className}`}
    >
      {children}
    </button>
  );
}

const badgeLook = {
  lime: "border-lime text-lime",
  amber: "border-amber text-amber",
  red: "border-red text-red",
  violet: "border-violet bg-violet text-ink",
  plain: "border-line text-dim",
};

export function Badge({ children, tone = "plain" }: { children: ReactNode; tone?: keyof typeof badgeLook }) {
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 font-display text-xs uppercase leading-5 ${badgeLook[tone]}`}>{children}</span>
  );
}

/** An address, shown short, linked to the explorer, marked when it is you. */
export function Addr({ address }: { address: `0x${string}` }) {
  const { address: me } = useAccount();
  const isMe = me?.toLowerCase() === address.toLowerCase();
  return (
    <span className="inline-flex items-center gap-2">
      <a href={`${explorer}/address/${address}`} target="_blank" rel="noreferrer" className="tabular hover:text-lime hover:underline">
        {short(address)}
      </a>
      {isMe && <Badge tone="violet">you</Badge>}
    </span>
  );
}

/** What a transaction is doing right now, or why it failed. */
export function TxStatus({ step, error, hash }: { step: string | null; error: string | null; hash?: `0x${string}` | null }) {
  if (step)
    return (
      <p role="status" className="mt-3 flex items-center gap-2 text-dim">
        <span className="size-3 animate-pulse bg-lime" />
        {step}
      </p>
    );
  if (error)
    return (
      <p role="alert" className="mt-3 border border-red px-3 py-2 text-red">
        {error}
      </p>
    );
  if (hash)
    return (
      <p className="mt-3 text-lime">
        Done.{" "}
        <a className="underline" href={`${explorer}/tx/${hash}`} target="_blank" rel="noreferrer">
          See it on the explorer
        </a>
      </p>
    );
  return null;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="border-line p-4">
      <Eyebrow>{label}</Eyebrow>
      <div className="tabular mt-2 font-display text-xl leading-tight">{value}</div>
      {hint && <div className="mt-1 text-sm text-dim">{hint}</div>}
    </div>
  );
}

/** A note in a coloured frame: for "you paid", "you missed", warnings. */
export function Note({ children, tone }: { children: ReactNode; tone: "lime" | "amber" | "red" }) {
  const look = { lime: "border-lime text-lime", amber: "border-amber text-amber", red: "border-red text-red" }[tone];
  return <p className={`border px-3 py-2 ${look}`}>{children}</p>;
}
