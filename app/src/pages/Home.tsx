import { useAccount } from "wagmi";
import { USDG, WIF } from "../config";
import { clock, phaseOf, useCircles, useNow, type Circle } from "../lib/ajo";
import { amount, countdown, duration } from "../lib/format";
import { Badge, Button, Eyebrow, Panel } from "../components/ui";
import { Dissolve, Pixels } from "../components/pixel";
import { POT } from "../components/bitmaps";
import { MASCOT, Robin } from "../components/robin";

export default function Home() {
  const { circles, total, loading, error } = useCircles();
  const { address } = useAccount();
  const now = useNow();
  const me = address?.toLowerCase();
  const mine = circles.filter((c) => c.members.some((m) => m.toLowerCase() === me));
  const others = circles.filter((c) => !mine.includes(c));
  const joinable = others.filter((c) => phaseOf(c) === "open");
  const rest = others.filter((c) => phaseOf(c) !== "open");

  return (
    <div className="space-y-16 sm:space-y-24">
      <Hero openCount={joinable.length} />
      <HowItWorks />

      <section className="space-y-10">
        {error && <p className="border border-red px-3 py-2 text-red">Could not reach the chain right now. It will retry on its own.</p>}
        {loading ? (
          <ListSkeleton />
        ) : total === 0 ? (
          <Panel label="× × × Circles" className="text-center">
            <h2 className="font-display text-2xl uppercase">No circles yet</h2>
            <p className="mx-auto mt-2 max-w-md text-dim">Be the first: start one and send the link to the people you save with.</p>
            <Button className="mt-5" onClick={() => (window.location.hash = "/new")}>
              Start a circle
            </Button>
          </Panel>
        ) : (
          <>
            {mine.length > 0 && <CircleList title="Your circles" circles={mine} now={now} />}
            {joinable.length > 0 && <CircleList id="open" title="Open to join" circles={joinable} now={now} />}
            {rest.length > 0 && <CircleList title="Running and finished" circles={rest} now={now} />}
          </>
        )}
      </section>
    </div>
  );
}

function Hero({ openCount }: { openCount: number }) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Savings circle</Eyebrow>
        <Eyebrow tone="lime">× × ×</Eyebrow>
        <Eyebrow>& Bond</Eyebrow>
      </div>

      <div className="relative mt-6 overflow-hidden border border-line bg-panel">
        <h1 className="px-4 pt-6 font-display text-[22vw] font-bold uppercase leading-[0.85] tracking-tight sm:px-8 sm:text-[168px] lg:text-[200px]">
          Ajo
        </h1>

        <div className="grid gap-6 px-4 pb-0 pt-6 sm:px-8 md:grid-cols-[1fr_1fr_1.1fr]">
          <div>
            <Eyebrow className="mb-2">On the surface</Eyebrow>
            <p className="text-dim">An ajo, esusu, susu or chama: a group that saves together. Everyone pays in each round, and one member takes the pot.</p>
          </div>
          <div>
            <Eyebrow className="mb-2">Behind the scenes</Eyebrow>
            <p className="text-dim">A contract holds the money and keeps the order. A $WIF bond means nobody can take the pot early and walk away for free.</p>
          </div>
          <div className="relative flex flex-col items-center md:-mt-40">
            <Pixels rows={POT} className="relative z-1 w-48 sm:w-64" title="A pot with coins dropping in" />
          </div>
        </div>

        <div className="relative">
          <Dissolve width={96} height={12} className="block w-full" />
          <div className="absolute inset-x-0 bottom-3 flex flex-wrap justify-center gap-3 px-4 sm:bottom-6">
            <Button onClick={() => (window.location.hash = "/new")}>Start a circle</Button>
            {openCount > 0 && (
              <Button kind="secondary" className="bg-void" onClick={() => document.getElementById("open")?.scrollIntoView({ behavior: "smooth" })}>
                Join one ({openCount} open)
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** First stop for new visitors: Robin offers the guide. */
function HowItWorks() {
  return (
    <section className="grid items-end gap-10 md:grid-cols-[minmax(0,460px)_1fr]">
      <div className="bg-lime p-6 text-on-lime shadow-block">
        <div className="flex items-start justify-between gap-4">
          <Robin className="w-20 sm:w-24" />
          <p className="text-right font-display text-base uppercase leading-tight">
            New here?
            <br />
            Meet {MASCOT}
          </p>
        </div>
        <p className="mt-5 text-[17px] leading-snug">
          Hi, I'm {MASCOT}. In seven short steps I'll show you why Ajo exists, what you need in your wallet, and how a circle works from joining to getting your bond
          back.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <a
            href="#/guide"
            className="inline-flex min-h-11 items-center bg-on-lime px-5 font-display uppercase text-lime transition duration-150 hover:opacity-90"
          >
            Show me around →
          </a>
          <a href="#/guide/3" className="font-display text-sm uppercase underline underline-offset-4">
            What do I need?
          </a>
        </div>
      </div>
      <p className="text-right font-display text-3xl font-bold uppercase leading-[1.05] sm:text-5xl lg:text-6xl">
        Save together.
        <br />
        Pay on time.
        <br />
        <span className="text-lime">Take the pot.</span>
      </p>
    </section>
  );
}

function CircleList({ title, circles, now, id }: { title: string; circles: Circle[]; now: number; id?: string }) {
  return (
    <div id={id} className="scroll-mt-24">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl uppercase">{title}</h2>
        <Eyebrow>{circles.length} × circle{circles.length === 1 ? "" : "s"}</Eyebrow>
      </div>
      <ul className="border-t border-line">
        {circles.map((c) => (
          <CircleRow key={c.id} c={c} now={now} />
        ))}
      </ul>
    </div>
  );
}

function CircleRow({ c, now }: { c: Circle; now: number }) {
  const phase = phaseOf(c);
  const k = clock(c, now);
  const live = phase === "running" && !k.timeUp;
  return (
    <li className="border-b border-x border-line bg-panel transition-colors duration-150 hover:bg-void">
      <a href={`#/c/${c.id}`} className="grid gap-3 p-4 sm:grid-cols-[1.6fr_repeat(4,1fr)] sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold">{c.name}</span>
          {phase === "open" && <Badge tone="lime">{c.members.length} of {c.size} joined</Badge>}
          {phase === "running" && (k.timeUp ? <Badge tone="amber">Round {k.open + 1} ready to close</Badge> : <Badge tone="lime">Round {k.open + 1} of {c.size}</Badge>)}
          {phase === "finished" && <Badge>Finished</Badge>}
        </div>
        <Cell label="Each round" value={`${amount(c.contribution, USDG.decimals)} USDG`} />
        <Cell label="Pot" value={`${amount(c.contribution * BigInt(c.size), USDG.decimals)} USDG`} />
        <Cell label="Bond" value={`${amount(c.bond, WIF.decimals)} WIF`} />
        <Cell label={live ? "Time left" : "Round length"} value={live ? countdown(k.timeLeft) : duration(c.roundLength)} />
      </a>
    </li>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:block">
      <Eyebrow>{label}</Eyebrow>
      <div className="tabular sm:mt-1">{value}</div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div aria-label="Loading circles" className="border-t border-line">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex h-18.5 items-center gap-4 border-x border-b border-line bg-panel px-4">
          <div className="h-4 w-40 animate-pulse bg-line" />
          <div className="ml-auto hidden h-4 w-64 animate-pulse bg-line sm:block" />
        </div>
      ))}
    </div>
  );
}
