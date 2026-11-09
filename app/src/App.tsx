import { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ajoAbi } from "./abi";
import { AJO_ADDRESS, PRACTICE, USDG, WIF, explorer } from "./config";
import { contractConfigured, useWallet } from "./lib/ajo";
import { amount } from "./lib/format";
import { useTx } from "./lib/tx";
import { Eyebrow, TxStatus } from "./components/ui";
import { Pixels } from "./components/pixel";
import { LOGO } from "./components/bitmaps";
import Home from "./pages/Home";
import CreateCircle from "./pages/CreateCircle";
import CircleView from "./pages/CircleView";
import Leaderboard from "./pages/Leaderboard";
import Guide from "./pages/Guide";

// Routes live in the URL hash (#/c/3), so links can be shared and any static host works.
function useRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || "/");
  useEffect(() => {
    const on = () => {
      setHash(window.location.hash.slice(1) || "/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

function Logo() {
  return (
    <a href="#/" className="flex items-center gap-3" aria-label="Ajo home">
      <Pixels rows={LOGO} className="size-8" />
      <span className="font-display text-2xl font-bold leading-none">AJO</span>
    </a>
  );
}

/** Payouts and refunds wait in the contract until you take them. */
function OwedBanner() {
  const { owed } = useWallet();
  const tx = useTx();
  if (!owed && !tx.step && !tx.error && !tx.lastHash) return null;
  return (
    <div className="border-b border-lime-deep bg-lime text-on-lime">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p>
          {owed ? (
            <>
              <strong className="tabular font-display">{amount(owed, USDG.decimals)} USDG</strong> is waiting for you: payouts and refunds.
            </>
          ) : (
            "Nothing waiting for you."
          )}
        </p>
        {!!owed && (
          <button
            disabled={tx.busy}
            onClick={() => tx.run({ abi: ajoAbi, address: AJO_ADDRESS as `0x${string}`, functionName: "withdraw" }, "Withdraw")}
            className="min-h-11 bg-on-lime px-5 py-2 font-display uppercase text-lime transition duration-150 hover:opacity-90 disabled:opacity-50"
          >
            Withdraw to my wallet
          </button>
        )}
      </div>
      {(tx.step || tx.error || tx.lastHash) && (
        <div className="mx-auto max-w-6xl bg-void px-4 pb-3 [&>p]:mt-0 [&>p]:pt-3">
          <TxStatus step={tx.step} error={tx.error} hash={tx.lastHash} />
        </div>
      )}
    </div>
  );
}

export default function App() {
  const route = useRoute();
  const circleMatch = route.match(/^\/c\/(\d+)$/);
  const guideMatch = route.match(/^\/guide(?:\/(\d+))?$/);

  let page;
  // The guide is useful even before the contract is set, so it comes first.
  if (guideMatch) page = <Guide step={Number(guideMatch[1] ?? 1) - 1} />;
  else if (!contractConfigured) page = <NotDeployed />;
  else if (route === "/new") page = <CreateCircle />;
  else if (circleMatch) page = <CircleView id={Number(circleMatch[1])} />;
  else if (route === "/leaders") page = <Leaderboard />;
  else page = <Home />;

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-void/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <nav className="order-last flex w-full items-center gap-2 overflow-x-auto md:order-none md:w-auto" aria-label="Main">
            <a href="#/guide" className="shrink-0 whitespace-nowrap border border-violet px-3 py-1.5 font-display text-xs uppercase text-violet-ink hover:bg-violet hover:text-ink">
              Guide
            </a>
            <a href="#/" className="shrink-0 whitespace-nowrap border border-line px-3 py-1.5 font-display text-xs uppercase text-dim hover:border-lime hover:text-lime">
              Circles
            </a>
            <a href="#/new" className="shrink-0 whitespace-nowrap border border-line px-3 py-1.5 font-display text-xs uppercase text-dim hover:border-lime hover:text-lime">
              Start one
            </a>
            <a href="#/leaders" className="shrink-0 whitespace-nowrap border border-line px-3 py-1.5 font-display text-xs uppercase text-dim hover:border-lime hover:text-lime">
              Leaderboard
            </a>
          </nav>
          <ConnectButton chainStatus="icon" accountStatus={{ smallScreen: "avatar", largeScreen: "full" }} showBalance={false} />
        </div>
      </header>
      {PRACTICE && (
        <div className="border-b border-amber bg-void">
          <p className="mx-auto max-w-6xl px-4 py-2 font-display text-xs uppercase tracking-wider text-amber">
            Practice mode: reading a test chain on this computer. Buttons will not send anything.
          </p>
        </div>
      )}
      {contractConfigured && !PRACTICE && <OwedBanner />}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">{page}</main>
      <footer className="border-t border-line bg-void">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 text-dim sm:grid-cols-2">
          <div>
            <Eyebrow className="mb-2">× × × Onchain</Eyebrow>
            <p className="text-sm">
              Savings in{" "}
              <a className="text-ink underline hover:text-lime" href={`${explorer}/token/${USDG.address}`} target="_blank" rel="noreferrer">USDG</a>, bonds in{" "}
              <a className="text-ink underline hover:text-lime" href={`${explorer}/token/${WIF.address}`} target="_blank" rel="noreferrer">$WIF</a>, on Robinhood Chain.
              {AJO_ADDRESS && (
                <>
                  {" "}
                  <a className="text-ink underline hover:text-lime" href={`${explorer}/address/${AJO_ADDRESS}`} target="_blank" rel="noreferrer">See the contract</a>.
                </>
              )}
            </p>
          </div>
          <div className="sm:text-right">
            <Eyebrow className="mb-2">Read this</Eyebrow>
            <p className="text-sm">Hackathon build. The contract has not been audited: use small amounts.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NotDeployed() {
  return (
    <div className="mx-auto max-w-xl border border-amber bg-panel p-6 text-amber">
      <h1 className="font-display text-lg uppercase">Contract address not set</h1>
      <p className="mt-2">
        Deploy the contract, then put its address in <code>app/.env</code> as <code>VITE_AJO_ADDRESS=0x…</code> and restart the app.
      </p>
    </div>
  );
}
