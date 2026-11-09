// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ajo} from "../src/Ajo.sol";

/// A plain token anyone can mint, standing in for USDG and $WIF in tests.
contract MockToken is ERC20 {
    uint8 private immutable _dec;

    constructor(string memory n, uint8 d) ERC20(n, n) {
        _dec = d;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract AjoTest is Test {
    Ajo ajo;
    MockToken usdg; // savings, 6 decimals
    MockToken wif; // bond, 18 decimals

    address ada = makeAddr("ada");
    address ben = makeAddr("ben");
    address chi = makeAddr("chi");
    address dan = makeAddr("dan");

    uint128 constant PAY = 10e6; // 10 USDG a round
    uint128 constant BOND = 100e18; // 100 WIF to join
    uint32 constant ROUND = 1 days;

    function setUp() public {
        usdg = new MockToken("USDG", 6);
        wif = new MockToken("WIF", 18);
        ajo = new Ajo(usdg, wif);
        address[4] memory people = [ada, ben, chi, dan];
        for (uint256 i; i < people.length; ++i) {
            usdg.mint(people[i], 1_000e6);
            wif.mint(people[i], 1_000e18);
            vm.startPrank(people[i]);
            usdg.approve(address(ajo), type(uint256).max);
            wif.approve(address(ajo), type(uint256).max);
            vm.stopPrank();
        }
    }

    // ─── helpers ──────────────────────────────────────────────────────────

    address[] none; // an empty invite list: anyone may join

    /// A circle of `size` whose payout order is ada, ben, chi, dan (as many as fit).
    /// The creator always takes the last turn, so the last of them creates it and
    /// the rest join in order.
    function _circle(uint32 size) internal returns (uint256 id) {
        address[4] memory people = [ada, ben, chi, dan];
        vm.prank(people[size - 1]);
        id = ajo.createCircle("Friday ajo", PAY, BOND, size, ROUND, none);
        for (uint256 i; i + 1 < size; ++i) {
            vm.prank(people[i]);
            ajo.join(id);
        }
    }

    function _pay(uint256 id, address who) internal {
        vm.prank(who);
        ajo.contribute(id);
    }

    // ─── joining ──────────────────────────────────────────────────────────

    function test_createLocksBondAndStartsWhenFull() public {
        uint256 id = _circle(3);
        Ajo.Circle memory c = ajo.getCircle(id);
        assertEq(c.startedAt, block.timestamp, "starts when full");
        assertEq(wif.balanceOf(address(ajo)), 3 * BOND, "every bond locked");
        address[] memory m = ajo.getMembers(id);
        assertEq(m[0], ada);
        assertEq(m[1], ben);
        assertEq(m[2], chi);
    }

    function test_cannotJoinTwiceOrWhenFull() public {
        vm.prank(ada);
        uint256 id = ajo.createCircle("x", PAY, BOND, 2, ROUND, none);
        vm.prank(ada);
        vm.expectRevert(Ajo.AlreadyMember.selector);
        ajo.join(id);
        vm.prank(ben);
        ajo.join(id);
        vm.prank(chi);
        vm.expectRevert(Ajo.AlreadyStarted.selector);
        ajo.join(id);
    }

    function test_rejectsBadSettings() public {
        vm.startPrank(ada);
        vm.expectRevert(Ajo.BadSize.selector);
        ajo.createCircle("x", PAY, BOND, 1, ROUND, none);
        vm.expectRevert(Ajo.BadSize.selector);
        ajo.createCircle("x", PAY, BOND, 21, ROUND, none);
        vm.expectRevert(Ajo.BadRoundLength.selector);
        ajo.createCircle("x", PAY, BOND, 3, 59, none);
        vm.expectRevert(Ajo.BadAmount.selector);
        ajo.createCircle("x", 0, BOND, 3, ROUND, none);
        vm.expectRevert(Ajo.BadName.selector);
        ajo.createCircle("", PAY, BOND, 3, ROUND, none);
        vm.stopPrank();
    }

    function test_leaveBeforeStartReturnsBondAndKeepsOrder() public {
        vm.prank(ada);
        uint256 id = ajo.createCircle("x", PAY, BOND, 4, ROUND, none);
        vm.prank(ben);
        ajo.join(id);
        vm.prank(chi);
        ajo.join(id);

        uint256 before = wif.balanceOf(ben);
        vm.prank(ben);
        ajo.leave(id);
        assertEq(wif.balanceOf(ben), before + BOND, "bond back");
        address[] memory m = ajo.getMembers(id);
        assertEq(m.length, 2);
        assertEq(m[0], chi, "order kept");
        assertEq(m[1], ada, "the creator stays last");

        // Once it starts, nobody can leave.
        vm.prank(ben);
        ajo.join(id);
        vm.prank(dan);
        ajo.join(id);
        vm.prank(dan);
        vm.expectRevert(Ajo.AlreadyStarted.selector);
        ajo.leave(id);
    }

    // ─── a circle where everyone pays ─────────────────────────────────────

    function test_fullCircleEveryonePaysEveryoneGetsAPot() public {
        uint256 id = _circle(3);
        address[3] memory order = [ada, ben, chi];

        for (uint256 r; r < 3; ++r) {
            _pay(id, ada);
            _pay(id, ben);
            _pay(id, chi);
            // Everyone has paid, so the round can close before its time is up.
            ajo.settleRound(id);
            assertEq(ajo.owed(order[r]), 3 * PAY, "this round's member is owed the pot");
            vm.prank(order[r]);
            ajo.withdraw();
            vm.warp(block.timestamp + ROUND);
        }

        // Each paid 3 x 10 and received 30 once: back where they started.
        assertEq(usdg.balanceOf(ada), 1_000e6);
        assertEq(usdg.balanceOf(ben), 1_000e6);
        assertEq(usdg.balanceOf(chi), 1_000e6);

        // Bonds come back in full.
        for (uint256 i; i < 3; ++i) {
            vm.prank(order[i]);
            ajo.claimBond(id);
            assertEq(wif.balanceOf(order[i]), 1_000e18);
        }
        assertEq(usdg.balanceOf(address(ajo)), 0);
        assertEq(wif.balanceOf(address(ajo)), 0);
    }

    function test_cannotPayTwiceOrCloseAnOpenRoundEarly() public {
        uint256 id = _circle(3);
        _pay(id, ada);
        vm.prank(ada);
        vm.expectRevert(Ajo.AlreadyPaid.selector);
        ajo.contribute(id);

        vm.expectRevert(Ajo.RoundStillOpen.selector);
        ajo.settleRound(id);
    }

    function test_payingClosesAnOverdueRoundFirst() public {
        uint256 id = _circle(2);
        _pay(id, ada);
        _pay(id, ben);
        vm.warp(block.timestamp + ROUND); // round 1 by the clock; nobody closed round 0
        _pay(id, ada); // closes round 0 on the way, then pays round 1

        assertEq(ajo.getCircle(id).roundsSettled, 1);
        assertEq(ajo.owed(ada), 2 * PAY); // round 0's pot
        assertTrue(ajo.hasPaid(id, 1, ada));
        assertFalse(ajo.isDefaulted(id, ada));
        assertFalse(ajo.isDefaulted(id, ben));
    }

    /// The trap this fixes: before, nobody could pay round 1 until someone closed
    /// round 0, so if nobody did, round 1's time ran out and payers lost their bonds.
    function test_anUnclosedRoundNoLongerCostsPayersTheirBond() public {
        uint256 id = _circle(3);
        _pay(id, ada);
        _pay(id, ben);
        _pay(id, chi);
        vm.warp(block.timestamp + ROUND); // round 1; round 0 never closed by hand
        _pay(id, ada);
        _pay(id, ben); // chi does not pay round 1
        vm.warp(block.timestamp + ROUND); // round 2
        _pay(id, ada); // closes round 1: only chi defaults

        assertFalse(ajo.isDefaulted(id, ada));
        assertFalse(ajo.isDefaulted(id, ben));
        assertTrue(ajo.isDefaulted(id, chi));
        assertEq(ajo.getCircle(id).defaults, 1);
        assertEq(ajo.owed(ben), 2 * PAY); // round 1's pot: ada and ben paid
    }

    function test_roundsWithNoPaymentAtAllStillDefaultEveryone() public {
        uint256 id = _circle(2);
        vm.warp(block.timestamp + ROUND); // round 0's time is over and nobody paid
        vm.prank(ada);
        vm.expectRevert(Ajo.MemberDefaulted.selector); // closing round 0 defaults ada too
        ajo.contribute(id);
    }

    function test_claimingTheBondClosesTheLastRound() public {
        uint256 id = _circle(2);
        _pay(id, ada);
        _pay(id, ben);
        vm.warp(block.timestamp + ROUND);
        _pay(id, ada);
        _pay(id, ben);
        vm.warp(block.timestamp + ROUND); // the circle's time is over; last round not closed

        uint256 before = wif.balanceOf(ben);
        vm.prank(ben);
        ajo.claimBond(id);
        assertEq(wif.balanceOf(ben) - before, BOND);
        assertEq(ajo.getCircle(id).roundsSettled, 2);
        assertEq(ajo.owed(ben), 2 * PAY); // the last pot reached ben
    }

    function test_cannotPayAfterTheLastRound() public {
        uint256 id = _circle(2);
        vm.warp(block.timestamp + 2 * ROUND);
        vm.prank(ada);
        vm.expectRevert(Ajo.CircleOver.selector);
        ajo.contribute(id);
    }

    // ─── when someone stops paying ────────────────────────────────────────

    function test_missedPaymentLosesTheBondToThoseWhoPaid() public {
        uint256 id = _circle(3);

        // Round 0: everyone pays, ada collects.
        _pay(id, ada);
        _pay(id, ben);
        _pay(id, chi);
        ajo.settleRound(id);

        // Round 1: ada took the pot and disappears.
        vm.warp(block.timestamp + ROUND);
        _pay(id, ben);
        _pay(id, chi);
        vm.warp(block.timestamp + ROUND); // round 1's time is up
        ajo.settleRound(id);
        assertTrue(ajo.isDefaulted(id, ada), "ada defaulted");
        assertEq(ajo.owed(ben), 2 * PAY, "ben still gets round 1's pot");

        // Round 2: ben and chi pay, chi collects.
        _pay(id, ben);
        _pay(id, chi);
        ajo.settleRound(id); // everyone still in good standing paid
        assertEq(ajo.owed(chi), 2 * PAY);

        // ada cannot pay again or reclaim her bond.
        vm.prank(ada);
        vm.expectRevert(Ajo.MemberDefaulted.selector);
        ajo.claimBond(id);

        // ben and chi split ada's bond.
        vm.prank(ben);
        ajo.claimBond(id);
        vm.prank(chi);
        ajo.claimBond(id);
        assertEq(wif.balanceOf(ben), 1_000e18 + BOND / 2);
        assertEq(wif.balanceOf(chi), 1_000e18 + BOND / 2);
    }

    function test_aDefaultedMemberDoesNotCollectAndPayersAreRefunded() public {
        uint256 id = _circle(3);

        // Round 0: ben never pays.
        _pay(id, ada);
        _pay(id, chi);
        vm.warp(block.timestamp + ROUND);
        ajo.settleRound(id);
        assertTrue(ajo.isDefaulted(id, ben));
        assertEq(ajo.owed(ada), 2 * PAY, "ada collects round 0");

        // Round 1 is ben's turn. He has defaulted, so he gets nothing.
        _pay(id, ada);
        _pay(id, chi);
        ajo.settleRound(id);
        assertEq(ajo.owed(ben), 0, "ben gets nothing");
        assertEq(ajo.owed(ada), 2 * PAY + PAY, "ada refunded round 1");
        assertEq(ajo.owed(chi), PAY, "chi refunded round 1");

        vm.prank(ben);
        vm.expectRevert(Ajo.NothingOwed.selector);
        ajo.withdraw();
    }

    function test_settleOnlyAfterTimeUpWhenSomeoneHasNotPaid() public {
        uint256 id = _circle(3);
        _pay(id, ada);
        _pay(id, ben);
        vm.warp(block.timestamp + ROUND - 1);
        vm.expectRevert(Ajo.RoundStillOpen.selector);
        ajo.settleRound(id);
        vm.warp(block.timestamp + 1);
        ajo.settleRound(id);
        assertTrue(ajo.isDefaulted(id, chi));
    }

    function test_bondOnlyAfterTheEnd() public {
        uint256 id = _circle(2);
        vm.prank(ada);
        vm.expectRevert(Ajo.NotOver.selector);
        ajo.claimBond(id);
    }

    function test_claimBondOnce() public {
        uint256 id = _circle(2);
        for (uint256 r; r < 2; ++r) {
            _pay(id, ada);
            _pay(id, ben);
            ajo.settleRound(id);
            vm.warp(block.timestamp + ROUND);
        }
        vm.prank(ada);
        ajo.claimBond(id);
        vm.prank(ada);
        vm.expectRevert(Ajo.AlreadyClaimed.selector);
        ajo.claimBond(id);
    }

    function test_strangersCannotTouchACircle() public {
        uint256 id = _circle(2);
        address eve = makeAddr("eve");
        vm.prank(eve);
        vm.expectRevert(Ajo.NotMember.selector);
        ajo.contribute(id);
        vm.expectRevert(Ajo.NoSuchCircle.selector);
        ajo.join(99);
    }

    // ─── anti-cheat: creator last, invite lists ────────────────────────────

    /// The cheat this blocks: set a tiny bond, take the first pot, disappear.
    /// The creator now takes the last pot, after paying every round.
    function test_creatorTakesTheLastTurn() public {
        vm.prank(ada);
        uint256 id = ajo.createCircle("x", PAY, 1, 3, ROUND, none); // a tiny bond: 1 wei of WIF
        vm.prank(ben);
        ajo.join(id);
        vm.prank(chi);
        ajo.join(id);

        address[] memory m = ajo.getMembers(id);
        assertEq(m[0], ben);
        assertEq(m[1], chi);
        assertEq(m[2], ada, "creator last");

        _pay(id, ada);
        _pay(id, ben);
        _pay(id, chi);
        ajo.settleRound(id);
        assertEq(ajo.owed(ben), 3 * PAY, "round 1's pot goes to the first joiner");
        assertEq(ajo.owed(ada), 0, "the creator gets nothing early");
    }

    function test_creatorWhoLeavesAndRejoinsIsStillLast() public {
        vm.prank(ada);
        uint256 id = ajo.createCircle("x", PAY, BOND, 3, ROUND, none);
        vm.prank(ben);
        ajo.join(id);
        vm.prank(ada);
        ajo.leave(id);
        vm.prank(chi);
        ajo.join(id);
        vm.prank(ada);
        ajo.join(id); // fills it: [ben, chi, ada]

        address[] memory m = ajo.getMembers(id);
        assertEq(m[0], ben);
        assertEq(m[1], chi);
        assertEq(m[2], ada);
    }

    function test_inviteOnlyKeepsStrangersOut() public {
        address[] memory guests = new address[](1);
        guests[0] = ben;
        vm.prank(ada);
        uint256 id = ajo.createCircle("x", PAY, BOND, 3, ROUND, guests);
        assertTrue(ajo.getCircle(id).inviteOnly);
        assertTrue(ajo.isInvited(id, ben));

        vm.prank(chi);
        vm.expectRevert(Ajo.NotInvited.selector);
        ajo.join(id);

        vm.prank(ben);
        ajo.join(id);

        // Only the creator can add wallets.
        address[] memory more = new address[](1);
        more[0] = chi;
        vm.prank(ben);
        vm.expectRevert(Ajo.NotCreator.selector);
        ajo.invite(id, more);

        vm.prank(ada);
        ajo.invite(id, more);
        vm.prank(chi);
        ajo.join(id); // full: it starts

        more[0] = dan;
        vm.prank(ada);
        vm.expectRevert(Ajo.AlreadyStarted.selector);
        ajo.invite(id, more);
    }

    /// KNOWN LIMIT (review finding): "creator last" does not stop a creator who
    /// also controls a SECOND wallet. They invite it and join with it first, so
    /// that wallet takes round 1's pot. Only the bond's value, and members
    /// checking who is ahead of them, protect against this. Kept as a test so
    /// the limit stays documented and visible.
    function test_knownLimit_creatorWithSecondWalletCanStillGoFirst() public {
        address alt = makeAddr("ada's other wallet");
        usdg.mint(alt, 1_000e6);
        wif.mint(alt, 1_000e18);
        vm.startPrank(alt);
        usdg.approve(address(ajo), type(uint256).max);
        wif.approve(address(ajo), type(uint256).max);
        vm.stopPrank();

        address[] memory guests = new address[](3);
        guests[0] = alt;
        guests[1] = ben;
        guests[2] = chi;
        vm.prank(ada);
        uint256 id = ajo.createCircle("x", PAY, 1, 4, ROUND, guests); // a tiny bond
        vm.prank(alt);
        ajo.join(id); // first in line
        vm.prank(ben);
        ajo.join(id);
        vm.prank(chi);
        ajo.join(id);

        _pay(id, alt);
        _pay(id, ben);
        _pay(id, chi);
        _pay(id, ada);
        ajo.settleRound(id);
        assertEq(ajo.owed(alt), 4 * PAY, "the second wallet collects round 1");
        // If alt and ada now stop paying, they keep 3 x PAY of other people's money
        // and lose only two tiny bonds. Nothing in the contract can price that.
    }

    function test_openCirclesCannotBeTurnedInviteOnly() public {
        vm.prank(ada);
        uint256 id = ajo.createCircle("x", PAY, BOND, 3, ROUND, none);
        address[] memory more = new address[](1);
        more[0] = ben;
        vm.prank(ada);
        vm.expectRevert(Ajo.NotInviteOnly.selector);
        ajo.invite(id, more);
    }

    function test_inviteListsHaveACap() public {
        address[] memory crowd = new address[](51);
        for (uint256 i; i < crowd.length; ++i) crowd[i] = address(uint160(i + 1));
        vm.prank(ada);
        vm.expectRevert(Ajo.TooManyInvites.selector);
        ajo.createCircle("x", PAY, BOND, 3, ROUND, crowd);
    }

    // ─── money is never created or lost ───────────────────────────────────

    /// Whatever any member pays or skips, when every round is settled and
    /// everyone has withdrawn and claimed, the contract holds nothing but
    /// division dust, and no one ends up with more than went in.
    function testFuzz_moneyIsConserved(uint8 seed) public {
        uint256 id = _circle(4);
        address[4] memory people = [ada, ben, chi, dan];

        for (uint256 r; r < 4; ++r) {
            for (uint256 i; i < 4; ++i) {
                bool skip = (uint256(keccak256(abi.encode(seed, r, i))) % 4) == 0;
                if (skip || ajo.isDefaulted(id, people[i])) continue;
                // If last round was left open, paying closes it first, which can
                // default this payer (they skipped it): that is the only allowed failure.
                vm.prank(people[i]);
                try ajo.contribute(id) {}
                catch (bytes memory err) {
                    assertEq(bytes4(err), Ajo.MemberDefaulted.selector, "only a member who missed may be refused");
                }
            }
            vm.warp(block.timestamp + ROUND);
            // Half the time nobody closes the round by hand; the next payment must do it.
            bool closeByHand = (uint256(keccak256(abi.encode(seed, r, "close"))) % 2) == 0;
            if (closeByHand) ajo.settleRound(id);
        }
        while (ajo.getCircle(id).roundsSettled < 4) ajo.settleRound(id);
        assertEq(ajo.getCircle(id).roundsSettled, 4, "every round closed");

        for (uint256 i; i < 4; ++i) {
            if (ajo.owed(people[i]) > 0) {
                vm.prank(people[i]);
                ajo.withdraw();
            }
            bool everyoneDefaulted = ajo.getCircle(id).defaults == 4;
            if (!ajo.isDefaulted(id, people[i]) || everyoneDefaulted) {
                vm.prank(people[i]);
                ajo.claimBond(id);
            }
        }

        uint256 usdgTotal;
        uint256 wifTotal;
        for (uint256 i; i < 4; ++i) {
            usdgTotal += usdg.balanceOf(people[i]);
            wifTotal += wif.balanceOf(people[i]);
        }
        assertEq(usdgTotal + usdg.balanceOf(address(ajo)), 4 * 1_000e6, "no USDG created or lost");
        assertEq(wifTotal + wif.balanceOf(address(ajo)), 4 * 1_000e18, "no WIF created or lost");
        assertEq(usdg.balanceOf(address(ajo)), 0, "every USDG paid in was paid out");
        assertLt(wif.balanceOf(address(ajo)), 4, "at most division dust left");
    }
}
