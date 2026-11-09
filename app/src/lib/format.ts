import { formatUnits } from "viem";

/** A token amount for people: at most `max` decimals, no trailing zeros. */
export function amount(value: bigint | undefined, decimals: number, max = 4): string {
  if (value === undefined) return "…";
  const s = formatUnits(value, decimals);
  const [whole, frac = ""] = s.split(".");
  const cut = frac.slice(0, max).replace(/0+$/, "");
  const w = BigInt(whole).toLocaleString("en-US");
  if (cut === "" && value > 0n && BigInt(whole) === 0n) return `<0.${"0".repeat(max - 1)}1`;
  return cut ? `${w}.${cut}` : w;
}

export function short(addr: string | undefined): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** "5 min", "1 h 30 min", "2 days" */
export function duration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d} day${d === 1 ? "" : "s"}`);
  if (h) parts.push(`${h} h`);
  if (m && !d) parts.push(`${m} min`);
  return parts.join(" ") || "0 min";
}

/** A live countdown: "4:59", "1:02:03", "2 days 3 h" */
export function countdown(seconds: number): string {
  if (seconds <= 0) return "0:00";
  if (seconds >= 86400) return duration(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
