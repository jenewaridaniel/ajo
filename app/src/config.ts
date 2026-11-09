import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { fallback, http } from "viem";
import { robinhood } from "viem/chains";

// Robinhood Chain (chain ID 4663) is built into viem, with its RPC and explorer.
export const chain = robinhood;
export const explorer = robinhood.blockExplorers.default.url;

// Both checked on the chain itself on 2026-11-08 (name, symbol, decimals).
export const USDG = {
  address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  symbol: "USDG",
  decimals: 6,
} as const;

// "World is Flat". Not 0x423c…2ba9, which is a different token ("dogwifhat")
// that also calls itself WIF.
export const WIF = {
  address: "0x5173b8eA6923c2d40267890D45C46a3480954773",
  symbol: "WIF",
  decimals: 18,
} as const;

// Filled in after the contract is deployed (see contracts/script/Deploy.s.sol).
const rawAddress = (import.meta.env.VITE_AJO_ADDRESS ?? "").trim();
export const AJO_ADDRESS = (/^0x[0-9a-fA-F]{40}$/.test(rawAddress) ? rawAddress : "") as `0x${string}` | "";

// The block the contract was deployed in. Only used to look up round history;
// the app works without it.
const rawBlock = (import.meta.env.VITE_AJO_DEPLOY_BLOCK ?? "").trim();
export const AJO_DEPLOY_BLOCK = /^\d+$/.test(rawBlock) ? BigInt(rawBlock) : undefined;

// The public RPC is rate-limited and often drops connections, so retry and
// fall back to the second public RPC viem lists for this chain.
// VITE_RPC_URL replaces them (a private RPC, or a local fork for testing).
const rpcOverride = (import.meta.env.VITE_RPC_URL ?? "").trim();
const rpcs = rpcOverride ? [rpcOverride] : robinhood.rpcUrls.default.http;

// Reading from a chain on this computer (a practice fork). A connected wallet
// would still send to the REAL chain (same chain id), so the app must not send.
export const PRACTICE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/.test(rpcOverride);

export const wagmiConfig = getDefaultConfig({
  appName: "Ajo",
  // A free WalletConnect project id lets phone wallets connect by QR code.
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "ajo-local",
  chains: [robinhood],
  transports: {
    [robinhood.id]: fallback(rpcs.map((url) => http(url, { retryCount: 4, retryDelay: 400, batch: true }))),
  },
});
