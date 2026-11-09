// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ajo} from "../src/Ajo.sol";

/// Deploys Ajo on Robinhood Chain (chain ID 4663) with savings in USDG and the
/// bond in $WIF ("World is Flat"). Both addresses were checked on the chain
/// itself on 2026-11-08: name, symbol and decimals match.
///
/// Run it with an encrypted keystore, so no private key is ever in a file:
///   cast wallet import ajo-deployer --interactive
///   forge script script/Deploy.s.sol --rpc-url robinhood --account ajo-deployer --broadcast
contract Deploy is Script {
    uint256 constant ROBINHOOD_CHAIN = 4663;
    // Global Dollar (USDG), 6 decimals. Paxos lists this as the Robinhood Mainnet token.
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    // World is Flat (WIF), 18 decimals. NOT 0x423c…2ba9, which is "dogwifhat".
    address constant WIF = 0x5173b8eA6923c2d40267890D45C46a3480954773;

    function run() external returns (Ajo ajo) {
        require(block.chainid == ROBINHOOD_CHAIN, "not Robinhood Chain");
        vm.startBroadcast();
        ajo = new Ajo(IERC20(USDG), IERC20(WIF));
        vm.stopBroadcast();
        console.log("Ajo deployed at", address(ajo));
    }
}
