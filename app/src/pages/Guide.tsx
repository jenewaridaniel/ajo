import type { ReactNode } from "react";
import { useAccount, useBalance } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { USDG, WIF, chain, explorer } from "../config";
import { useWallet } from "../lib/ajo";
import { amount, short } from "../lib/format";
import { Badge, Button, Eyebrow, Panel } from "../components/ui";
import { MASCOT, RobinSays } from "../components/robin";

// The bridge Robinhood's own docs point to (docs.robinhood.com/chain/bridging).
const BRIDGE = "https://portal.arbitrum.io/bridge?destinationChain=robinhood-chain&sourceChain=ethereum";

type Step = { tab: string; title: string; says: ReactNode; body: () => ReactNode };

const steps: Step[] = [
  {
    tab: "Hello",
    title: `Hi, I'm ${MASCOT}`,
    says: <>I'll show you why Ajo exists and how to use it. Seven short steps, about two minutes.</>,
    body: () => (
      <>
        <Why>
          An ajo (also called esusu, susu or chama) is a group that saves together. Everyone pays the same amount each round, and each round one member takes the
          whole pot. By the last round, everyone has had a turn.
        </Why>
        <Why>
          It has always run on trust, and that is its oldest problem: someone takes the pot early and stops paying, or the person holding the money disappears.
        </Why>
        <Why>
          Ajo puts the rules in a contract on Robinhood Chain. The contract holds the money, keeps the order and pays out. No organiser can run off with it, and
          nobody can change the order once it starts.
        </Why>
      </>
    ),
  },
  {
    tab: "The bond",
    title: "Why there is a $WIF bond",
    says: <>To join, everyone locks the same $WIF bond. It's your promise to keep paying.</>,
    body: () => (
      <List
        items={[
          <>Pay every round and you get your bond back at the end, plus an equal share of any bonds other members lost.</>,
          <>Miss a round and your bond goes to the members who kept paying. Taking the pot and walking away now costs you.</>,
          <>Savings are in USDG, a dollar stablecoin, so the pot doesn't move with a meme coin's price. $WIF is only the promise.</>,
        ]}
      />
    ),
  },
  {
    tab: "What you need",
    title: "What you need",
    says: <>Four things, all on Robinhood Chain. Connect your wallet and I'll check them for you.</>,
    body: () => <WalletCheck />,
  },
  {
    tab: "Vouch",
    title: "Vouch for someone",
    says: (
      <>
        No $WIF? That's fine, if someone who knows you vouches for you. It's how an ajo has always welcomed new people: someone answers for them.
      </>
    ),
    body: () => (
      <List
        items={[
          <>
            <strong>What it is:</strong> someone with $WIF locks the bond on your behalf, so you only need USDG to take part.
          </>,
          <>
            <strong>Pay every round</strong> and the bond goes back to them. Any share of bonds lost by others is yours.
          </>,
          <>
            <strong>Miss a round</strong> and they lose their bond. So vouch only for people you know, and only accept a vouch from someone you'd hate to let
            down.
          </>,
          <>
            <strong>You still decide.</strong> A vouch never makes anyone join, and until you do, the voucher can take it back.
          </>,
          <>
            <strong>It's on the record.</strong> The leaderboard shows how many of each person's vouches were kept.
          </>,
          <>
            <strong>How:</strong> on the circle's page, use "Vouch for someone" with their wallet address. In an invite-only circle, they need to be on the invite
            list first.
          </>,
        ]}
      />
    ),
  },
  {
    tab: "Start or join",
    title: "Start a circle, or join one",
    says: <>Start a circle and send the link to the people you save with, or open a link a friend sent you.</>,
    body: () => (
      <List
        items={[
          <>
            <strong>Start:</strong> choose the amount each round, the bond, how many members (2 to 20) and how long a round lasts. You set the terms, so you take
            the <strong>last</strong> pot, so you can't set a weak bond and take the first pot yourself.
          </>,
          <>
            <strong>Invite:</strong> make the circle invite-only and list the wallets of the people you save with, so strangers can't rush in to grab the early
            turns.
          </>,
          <>
            <strong>Join:</strong> open the invite link and press Join. The pot goes round in the order people joined, with the creator last.
          </>,
          <>Your wallet asks twice: first to allow that exact amount (nothing more), then to do it.</>,
          <>Until the circle is full, you can leave and take your bond back. The moment it's full, round 1 starts.</>,
        ]}
      />
    ),
  },
  {
    tab: "Each round",
    title: "Every round",
    says: <>Pay before the clock runs out. That's the whole job.</>,
    body: () => (
      <List
        items={[
          <>Each round, everyone pays the same USDG amount. The circle page shows who has paid and how long is left.</>,
          <>When everyone has paid, anyone can close the round early. Otherwise it closes once the time is up.</>,
          <>The pot goes to that round's member. It waits in the contract until they press Withdraw, in the green bar at the top of the page.</>,
          <>
            Miss the deadline and you are out: your bond goes to the members who paid. If the member who misses is the one due the pot, it goes back to the payers.
          </>,
        ]}
      />
    ),
  },
  {
    tab: "The end",
    title: "When the circle ends",
    says: <>Finish a circle and it counts. Then start the next one.</>,
    body: () => (
      <>
        <List
          items={[
            <>
              After the last round, everyone who paid every round claims their bond back, plus an equal share of any bonds that were lost. If someone vouched
              for you, the bond goes back to them and the share is yours.
            </>,
            <>Every round you pay on time shows on the leaderboard, and so does every vouch you make, so people can see who keeps their word.</>,
            <>This is a hackathon build and the contract has not been audited. Use small amounts.</>,
          ]}
        />
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => (window.location.hash = "/new")}>Start a circle</Button>
          <Button kind="secondary" onClick={() => (window.location.hash = "/")}>
            See circles
          </Button>
        </div>
      </>
    ),
  },
];

export default function Guide({ step }: { step: number }) {
  const i = Math.min(Math.max(step, 0), steps.length - 1);
  const s = steps[i];
  const n = (k: number) => String(k + 1).padStart(2, "0");
  const go = (k: number) => (window.location.hash = `/guide/${k + 1}`);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>Guide</Eyebrow>
          <Eyebrow tone="lime">× × ×</Eyebrow>
          <Eyebrow>
            Step {n(i)} of {n(steps.length - 1)}
          </Eyebrow>
        </div>
        <h1 className="mt-6 font-display text-4xl font-bold uppercase leading-[0.95] sm:text-6xl">{s.title}</h1>
      </div>

      <nav aria-label="Guide steps" className="-mx-4 overflow-x-auto px-4">
        <ol className="flex min-w-max gap-2">
          {steps.map((st, k) => (
            <li key={st.tab}>
              <a
                href={`#/guide/${k + 1}`}
                aria-current={k === i ? "step" : undefined}
                className={`flex min-h-11 items-center gap-2 border px-3 font-display text-xs uppercase ${
                  k === i ? "border-lime bg-lime text-on-lime" : k < i ? "border-lime-deep text-lime" : "border-line text-dim hover:border-lime hover:text-lime"
                }`}
              >
                <span className="tabular">{n(k)}</span> {st.tab}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start">
        <div aria-live="polite">
          <RobinSays size="lg">{s.says}</RobinSays>
        </div>
        <Panel>
          <div className="space-y-4">{s.body()}</div>
        </Panel>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-6">
        <Button kind="secondary" disabled={i === 0} onClick={() => go(i - 1)}>
          ← Back
        </Button>
        {i < steps.length - 1 ? (
          <Button onClick={() => go(i + 1)}>Next: {steps[i + 1].tab} →</Button>
        ) : (
          <Button onClick={() => (window.location.hash = "/new")}>Start a circle</Button>
        )}
      </div>
    </div>
  );
}

function Why({ children }: { children: ReactNode }) {
  return <p className="leading-relaxed">{children}</p>;
}

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-3">
      {items.map((it, k) => (
        <li key={k} className="grid grid-cols-[auto_1fr] gap-3 leading-relaxed">
          <span aria-hidden className="mt-2 size-2 bg-lime" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** The four things a member needs, checked live against the connected wallet. */
function WalletCheck() {
  const { address, isConnected, chainId } = useAccount();
  const eth = useBalance({ address, chainId: chain.id, query: { enabled: !!address } });
  const { usdg, wif } = useWallet();
  const has = (v: bigint | undefined) => (v === undefined ? undefined : v > 0n);
  const link = "text-ink underline underline-offset-2 hover:text-lime";

  return (
    <>
      <ul className="divide-y divide-line border-y border-line">
        <Need
          label="A wallet on Robinhood Chain"
          ok={isConnected ? true : undefined}
          status={isConnected ? `Connected as ${short(address)}${chainId === chain.id ? "" : ". Your wallet is on another network; the app will ask it to switch."}` : undefined}
        >
          Any wallet that can use Robinhood Chain (chain ID {chain.id}). We tested with Phantom: turn the network on under Settings → Active Networks.
        </Need>
        <Need label="A little ETH for fees" ok={has(eth.data?.value)} status={eth.data && `You have ${amount(eth.data.value, 18, 6)} ETH`}>
          Fees are paid in ETH on Robinhood Chain. In our test each step cost well under a cent. Coming from Ethereum? Use the{" "}
          <a className={link} href={BRIDGE} target="_blank" rel="noreferrer">
            official bridge
          </a>
          .
        </Need>
        <Need label="USDG to save" ok={has(usdg)} status={usdg !== undefined ? `You have ${amount(usdg, USDG.decimals)} USDG` : undefined}>
          Enough for every round: the amount per round × the number of members. Swap a little ETH for USDG in your wallet. Address{" "}
          <TokenLink address={USDG.address} />.
        </Need>
        <Need label="$WIF for the bond" ok={has(wif)} status={wif !== undefined ? `You have ${amount(wif, WIF.decimals)} WIF` : undefined}>
          Swap ETH for WIF in your wallet or on Pons. Check the address: <TokenLink address={WIF.address} />. Another token also called WIF (dogwifhat) is not
          the one. No $WIF? Someone who knows you can{" "}
          <a className={link} href="#/guide/4">
            vouch
          </a>{" "}
          for you: they lock the bond on your behalf, and you only need USDG.
        </Need>
      </ul>
      {!isConnected && (
        <div className="pt-2">
          <ConnectButton label="Connect a wallet to check" />
        </div>
      )}
    </>
  );
}

function Need({ label, ok, status, children }: { label: string; ok: boolean | undefined; status?: string; children: ReactNode }) {
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-sm uppercase">{label}</h3>
        {ok === undefined ? <Badge>Not checked</Badge> : ok ? <Badge tone="lime">✓ Ready</Badge> : <Badge tone="amber">Needed</Badge>}
      </div>
      {status && <p className="tabular mt-1 text-sm text-dim">{status}</p>}
      <p className="mt-2 leading-relaxed">{children}</p>
    </li>
  );
}

function TokenLink({ address }: { address: string }) {
  return (
    <a className="tabular break-all text-ink underline underline-offset-2 hover:text-lime" href={`${explorer}/token/${address}`} target="_blank" rel="noreferrer">
      {address.slice(0, 6)}…{address.slice(-4)}
    </a>
  );
}
