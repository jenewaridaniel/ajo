// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ajo} from "../src/Ajo.sol";
import {MockToken} from "./Ajo.t.sol";

/// Drives the contract with random sequences of every action, by several people
/// across several circles. Reverts are expected (most random calls are not
/// allowed) and are simply skipped.
contract Handler is Test {
    Ajo public ajo;
    MockToken public usdg;
    MockToken public wif;
    address[] public people;

    /// WIF paid out by claimBond, per circle (to check bonds are never overpaid).
    mapping(uint256 => uint256) public wifClaimed;

    // How often each meaningful thing really happened (to prove the runs go deep).
    uint256 public okJoins;
    uint256 public okPays;
    uint256 public okSettles;
    uint256 public okWithdraws;
    uint256 public okClaims;

    constructor(Ajo ajo_, MockToken usdg_, MockToken wif_) {
        ajo = ajo_;
        usdg = usdg_;
        wif = wif_;
        for (uint256 i; i < 5; ++i) {
            address p = makeAddr(string(abi.encodePacked("person", vm.toString(i))));
            people.push(p);
            usdg.mint(p, 1_000_000e6);
            wif.mint(p, 1_000_000e18);
            vm.startPrank(p);
            usdg.approve(address(ajo), type(uint256).max);
            wif.approve(address(ajo), type(uint256).max);
            vm.stopPrank();
        }
    }

    function _who(uint256 seed) internal view returns (address) {
        return people[seed % people.length];
    }

    function _circle(uint256 seed) internal view returns (bool ok, uint256 id) {
        uint256 n = ajo.circleCount();
        if (n == 0) return (false, 0);
        return (true, seed % n);
    }

    function create(uint256 who, uint256 size, uint256 pay, uint256 bond, uint256 len, bool inviteOnly, uint256 guest) external {
        if (ajo.circleCount() >= 6) return; // keep the state small enough to explore deeply
        address[] memory invited = new address[](inviteOnly ? 2 : 0);
        if (inviteOnly) {
            invited[0] = _who(guest);
            invited[1] = _who(guest + 1);
        }
        vm.prank(_who(who));
        try ajo.createCircle("c", uint128(bound(pay, 1, 1_000e6)), uint128(bound(bond, 1, 1_000e18)), uint32(bound(size, 2, 4)), uint32(bound(len, 30, 3 days)), invited) {} catch {}
    }

    function join(uint256 who, uint256 c) external {
        (bool ok, uint256 id) = _circle(c);
        if (!ok) return;
        bool vouched = ajo.vouchFrom(id, _who(who)) != address(0);
        vm.prank(_who(who));
        try ajo.join(id) {
            ++okJoins;
            if (vouched) ++okVouchedJoins;
        } catch {}
    }

    function leave(uint256 who, uint256 c) external {
        (bool ok, uint256 id) = _circle(c);
        if (!ok) return;
        vm.prank(_who(who));
        try ajo.leave(id) {} catch {}
    }

    function invite(uint256 who, uint256 c, uint256 guest) external {
        (bool ok, uint256 id) = _circle(c);
        if (!ok) return;
        address[] memory list = new address[](1);
        list[0] = _who(guest);
        vm.prank(_who(who));
        try ajo.invite(id, list) {} catch {}
    }

    uint256 public okVouches;
    uint256 public okVouchedJoins;

    function vouch(uint256 who, uint256 c, uint256 friend) external {
        (bool ok, uint256 id) = _circle(c);
        if (!ok) return;
        vm.prank(_who(who));
        try ajo.vouch(id, _who(friend)) {
            ++okVouches;
        } catch {}
    }

    function withdrawVouch(uint256 who, uint256 c, uint256 friend) external {
        (bool ok, uint256 id) = _circle(c);
        if (!ok) return;
        vm.prank(_who(who));
        try ajo.withdrawVouch(id, _who(friend)) {} catch {}
    }

    function contribute(uint256 who, uint256 c) external {
        (bool ok, uint256 id) = _circle(c);
        if (!ok) return;
        vm.prank(_who(who));
        try ajo.contribute(id) {
            ++okPays;
        } catch {}
    }

    function settle(uint256 c) external {
        (bool ok, uint256 id) = _circle(c);
        if (!ok) return;
        try ajo.settleRound(id) {
            ++okSettles;
        } catch {}
    }

    function withdraw(uint256 who) external {
        vm.prank(_who(who));
        try ajo.withdraw() {
            ++okWithdraws;
        } catch {}
    }

    function claim(uint256 who, uint256 c) external {
        (bool ok, uint256 id) = _circle(c);
        if (!ok) return;
        address p = _who(who);
        // Measure what leaves the contract: with a voucher, one claim pays two people.
        uint256 before = wif.balanceOf(address(ajo));
        vm.prank(_who(who + 1)); // anyone may claim for a member
        try ajo.claimBond(id, p) {
            wifClaimed[id] += before - wif.balanceOf(address(ajo));
            ++okClaims;
        } catch {}
    }

    function wait(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 2 days));
    }

    function peopleCount() external view returns (uint256) {
        return people.length;
    }
}

contract AjoInvariantTest is Test {
    Ajo ajo;
    MockToken usdg;
    MockToken wif;
    Handler h;

    function setUp() public {
        usdg = new MockToken("USDG", 6);
        wif = new MockToken("WIF", 18);
        ajo = new Ajo(usdg, wif);
        h = new Handler(ajo, usdg, wif);
        targetContract(address(h));
    }

    /// Every USDG the contract holds is either owed to someone (withdrawable) or
    /// sitting in a round that has not been closed yet. Nothing more, nothing less.
    function invariant_usdgFullyAccounted() public view {
        uint256 expected;
        for (uint256 i; i < h.peopleCount(); ++i) expected += ajo.owed(h.people(i));
        uint256 n = ajo.circleCount();
        for (uint256 id; id < n; ++id) {
            Ajo.Circle memory c = ajo.getCircle(id);
            for (uint256 r = c.roundsSettled; r < c.size; ++r) expected += ajo.roundPot(id, r);
        }
        assertEq(usdg.balanceOf(address(ajo)), expected, "USDG held != owed + open pots");
    }

    /// Every WIF the contract holds is a bond that is still locked: members of
    /// circles not yet started, or all bonds of a started circle minus what has
    /// been claimed. Division dust (under one unit per claimer) may stay behind.
    function invariant_wifFullyAccounted() public view {
        uint256 locked;
        uint256 n = ajo.circleCount();
        for (uint256 id; id < n; ++id) {
            Ajo.Circle memory c = ajo.getCircle(id);
            uint256 inIt = (c.startedAt == 0 ? ajo.getMembers(id).length : c.size) * uint256(c.bond);
            assertLe(h.wifClaimed(id), inIt, "a circle paid out more WIF than was locked in it");
            locked += inIt - h.wifClaimed(id) + ajo.pendingVouches(id);
        }
        uint256 held = wif.balanceOf(address(ajo));
        assertGe(held, locked, "contract holds less WIF than the bonds still locked");
        assertLe(held - locked, n * 20, "more than division dust left over");
    }

    /// The creator, while a member, is always last in the payout order, and
    /// nobody appears twice.
    function invariant_creatorLastAndNoDuplicates() public view {
        uint256 n = ajo.circleCount();
        for (uint256 id; id < n; ++id) {
            Ajo.Circle memory c = ajo.getCircle(id);
            address[] memory m = ajo.getMembers(id);
            assertLe(m.length, c.size, "more members than seats");
            for (uint256 i; i < m.length; ++i) {
                for (uint256 j = i + 1; j < m.length; ++j) assertTrue(m[i] != m[j], "member listed twice");
                if (m[i] == c.creator) assertEq(i, m.length - 1, "creator not last");
            }
        }
    }

    uint256 maxJoins;
    uint256 maxPays;
    uint256 maxSettles;
    uint256 maxWithdraws;
    uint256 maxClaims;
    uint256 maxDefaults;

    function afterInvariant() public {
        uint256 defaults;
        for (uint256 id; id < ajo.circleCount(); ++id) defaults += ajo.getCircle(id).defaults;
        if (h.okJoins() > maxJoins) maxJoins = h.okJoins();
        if (h.okPays() > maxPays) maxPays = h.okPays();
        if (h.okSettles() > maxSettles) maxSettles = h.okSettles();
        if (h.okWithdraws() > maxWithdraws) maxWithdraws = h.okWithdraws();
        if (h.okClaims() > maxClaims) maxClaims = h.okClaims();
        if (defaults > maxDefaults) maxDefaults = defaults;
        emit log_named_string(
            "run reached",
            string.concat(
                "joins ", vm.toString(h.okJoins()), ", pays ", vm.toString(h.okPays()), ", rounds closed by hand ", vm.toString(h.okSettles()),
                ", withdrawals ", vm.toString(h.okWithdraws()), ", bonds claimed ", vm.toString(h.okClaims()), ", missed payments ", vm.toString(defaults)
            )
        );
    }

    /// The same checks, driven by a seeded random walk so the depth reached can
    /// be measured exactly: every rule is checked after every single step.
    uint256 constant RUNS = 40;
    uint256 constant STEPS = 150;

    function test_randomWalkKeepsEveryRule() public {
        uint256[9] memory total; // joins, pays, settles, withdraws, claims, defaults, finished circles, vouches, vouched joins
        for (uint256 run; run < RUNS; ++run) {
            uint256 snap = vm.snapshotState();
            for (uint256 step; step < STEPS; ++step) {
                uint256 r = uint256(keccak256(abi.encode(run, step)));
                uint256 a = r % 100;
                uint256 x = r >> 8;
                uint256 y = r >> 72;
                if (a < 6) h.create(x, y, x >> 3, y >> 3, x >> 40, (y & 1) == 1, y >> 9);
                else if (a < 28) h.join(x, y);
                else if (a < 31) h.leave(x, y);
                else if (a < 33) h.invite(x, y, x >> 20);
                else if (a < 36) h.vouch(x, y, x >> 30);
                else if (a < 37) h.withdrawVouch(x, y, x >> 30);
                else if (a < 63) h.contribute(x, y);
                else if (a < 72) h.settle(y);
                else if (a < 80) h.withdraw(x);
                else if (a < 88) h.claim(x, y);
                else h.wait(x % 100 < 70 ? 30 + (y % 200) : 1 days);
                invariant_usdgFullyAccounted();
                invariant_wifFullyAccounted();
                invariant_creatorLastAndNoDuplicates();
                invariant_roundsBounded();
            }
            total[0] += h.okJoins();
            total[1] += h.okPays();
            total[2] += h.okSettles();
            total[3] += h.okWithdraws();
            total[4] += h.okClaims();
            total[7] += h.okVouches();
            total[8] += h.okVouchedJoins();
            for (uint256 id; id < ajo.circleCount(); ++id) {
                Ajo.Circle memory c = ajo.getCircle(id);
                total[5] += c.defaults;
                if (c.startedAt != 0 && c.roundsSettled == c.size) ++total[6];
            }
            vm.revertToState(snap);
        }
        emit log_named_uint("successful joins", total[0]);
        emit log_named_uint("successful payments", total[1]);
        emit log_named_uint("rounds closed by hand", total[2]);
        emit log_named_uint("withdrawals", total[3]);
        emit log_named_uint("bonds claimed", total[4]);
        emit log_named_uint("missed payments (defaults)", total[5]);
        emit log_named_uint("circles that finished", total[6]);
        emit log_named_uint("vouches made", total[7]);
        emit log_named_uint("members who joined on a vouch", total[8]);
        assertGt(total[4], 0, "the walk never reached a bond claim");
        assertGt(total[5], 0, "the walk never reached a missed payment");
    }

    /// Each finished round paid out exactly once: roundsSettled never exceeds size.
    function invariant_roundsBounded() public view {
        uint256 n = ajo.circleCount();
        for (uint256 id; id < n; ++id) {
            Ajo.Circle memory c = ajo.getCircle(id);
            assertLe(c.roundsSettled, c.size);
            assertLe(c.defaults, c.size);
        }
    }
}
