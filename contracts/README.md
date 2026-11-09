# Ajo contracts

The savings-circle contract, built with [Foundry](https://getfoundry.sh). See the [main README](../README.md) for what it does.

- `src/Ajo.sol`: the contract.
- `test/Ajo.t.sol`: tests, including a fuzz test that checks money is conserved.
- `script/Deploy.s.sol`: deploys with USDG (savings) and World is Flat $WIF (bond). It refuses any chain but Robinhood Chain (4663).

```sh
forge build
forge test
```

Deploy with an encrypted keystore, so no private key is ever in a file:

```sh
cast wallet import ajo-deployer --interactive
forge script script/Deploy.s.sol --rpc-url https://rpc.mainnet.chain.robinhood.com --account ajo-deployer --broadcast
```

Libraries: OpenZeppelin Contracts v5.7.0 (git submodule) and forge-std.
