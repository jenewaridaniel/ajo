# Ajo app

The web app for Ajo: Vite, React, TypeScript, wagmi, viem, RainbowKit and Tailwind. See the [main README](../README.md) for what Ajo is.

```sh
npm install
npm run dev     # local development
npm run build   # production build into dist/
npm run lint
```

Settings live in `app/.env` (public values: contract address, deploy block, WalletConnect project ID). Override them locally in `app/.env.local`, which is not committed.

Pages use hash routes, so any static host works: `#/` circles, `#/new` start a circle, `#/c/<id>` a circle, `#/leaders` leaderboard, `#/guide` the guide.

`src/abi.ts` is generated from `contracts/out/Ajo.sol/Ajo.json`. Regenerate it after changing the contract.
