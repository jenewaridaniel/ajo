// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Ajo: a rotating savings circle, run by code instead of a trusted organiser.
/// @notice A group of people each put the same amount in every round, and each
/// round one of them takes the whole pot, in the order they joined, with the
/// creator always last. It is the
/// ajo / esusu that millions of people already use, with its oldest problem
/// fixed: to join, every member locks a bond in $WIF. A member who misses a
/// round loses that bond to the members who kept paying, so taking the pot
/// early and disappearing costs you.
///
/// Savings are in a stable token (for example USDG), so what people save does
/// not swing with a token price. $WIF is the commitment, not the savings.
///
/// Money only ever leaves through `withdraw` and `claimBond`, pulled by the
/// person it belongs to; nothing is pushed out while a round is being settled.
contract Ajo is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Limits ───────────────────────────────────────────────────────────
    uint256 public constant MIN_MEMBERS = 2;
    uint256 public constant MAX_MEMBERS = 20; // keeps every loop small and cheap
    uint256 public constant MIN_ROUND = 60; // seconds; short rounds make a live demo possible
    uint256 public constant MAX_ROUND = 30 days;
    uint256 public constant MAX_NAME = 48; // bytes
    uint256 public constant MAX_INVITES = 50; // per call, so one call stays cheap

    // ─── Tokens ───────────────────────────────────────────────────────────
    IERC20 public immutable savingsToken; // what members save, e.g. USDG
    IERC20 public immutable bondToken; // what members lock to join: $WIF

    // ─── Circles ──────────────────────────────────────────────────────────
    struct Circle {
        address creator;
        uint128 contribution; // savings token each member pays each round
        uint128 bond; // bond token each member locks to join
        uint32 size; // members needed before it starts
        uint32 roundLength; // seconds per round
        uint64 startedAt; // 0 until the circle is full
        uint32 roundsSettled; // rounds paid out so far; the circle ends at `size`
        uint32 defaults; // members who missed a round
        uint256 penaltyPool; // bond tokens taken from members who missed a round
        bool inviteOnly; // only wallets the creator invited can join
        string name;
    }

    Circle[] internal _circles;
    mapping(uint256 => address[]) internal _members; // in payout order; the creator is always last
    mapping(uint256 => mapping(address => bool)) public isMember;
    mapping(uint256 => mapping(address => bool)) public isInvited;
    mapping(uint256 => mapping(address => bool)) public isDefaulted;
    mapping(uint256 => mapping(address => bool)) public bondClaimed;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasPaid; // circle => round => member
    mapping(uint256 => mapping(uint256 => uint256)) public roundPot; // circle => round => amount

    /// @notice Savings token each address can withdraw (payouts and refunds).
    mapping(address => uint256) public owed;

    // ─── Events ───────────────────────────────────────────────────────────
    event CircleCreated(uint256 indexed id, address indexed creator, string name, uint256 contribution, uint256 bond, uint256 size, uint256 roundLength);
    event Invited(uint256 indexed id, address indexed member);
    event Joined(uint256 indexed id, address indexed member, uint256 position); // position when they joined
    event Left(uint256 indexed id, address indexed member);
    event Started(uint256 indexed id, uint256 startedAt);
    event Contributed(uint256 indexed id, uint256 indexed round, address indexed member, uint256 amount);
    event Defaulted(uint256 indexed id, uint256 indexed round, address indexed member, uint256 bondLost);
    event RoundSettled(uint256 indexed id, uint256 indexed round, address indexed recipient, uint256 pot, bool refunded);
    event Withdrawn(address indexed account, uint256 amount);
    event BondClaimed(uint256 indexed id, address indexed member, uint256 amount);

    // ─── Errors ───────────────────────────────────────────────────────────
    error BadSize();
    error BadRoundLength();
    error BadAmount();
    error BadName();
    error NoSuchCircle();
    error AlreadyStarted();
    error NotStarted();
    error Full();
    error AlreadyMember();
    error NotMember();
    error MemberDefaulted();
    error CircleOver();
    error AlreadyPaid();
    error RoundStillOpen();
    error NotOver();
    error AlreadyClaimed();
    error NothingOwed();
    error NotInvited();
    error NotCreator();
    error NotInviteOnly();
    error TooManyInvites();

    constructor(IERC20 savingsToken_, IERC20 bondToken_) {
        if (address(savingsToken_) == address(0) || address(bondToken_) == address(0)) revert BadAmount();
        savingsToken = savingsToken_;
        bondToken = bondToken_;
    }

    // ─── Before the start ─────────────────────────────────────────────────

    /// @notice Start a new circle and join it. The creator sets the terms, so the
    /// creator takes the LAST pot: nobody can set a weak bond, take the first pot
    /// and walk away. Pass the wallets allowed to join in `invited`, or none to
    /// let anyone join.
    function createCircle(
        string calldata name,
        uint128 contribution,
        uint128 bond,
        uint32 size,
        uint32 roundLength,
        address[] calldata invited
    )
        external
        nonReentrant
        returns (uint256 id)
    {
        if (size < MIN_MEMBERS || size > MAX_MEMBERS) revert BadSize();
        if (roundLength < MIN_ROUND || roundLength > MAX_ROUND) revert BadRoundLength();
        if (contribution == 0 || bond == 0) revert BadAmount();
        if (bytes(name).length == 0 || bytes(name).length > MAX_NAME) revert BadName();

        id = _circles.length;
        _circles.push();
        Circle storage c = _circles[id];
        c.creator = msg.sender;
        c.contribution = contribution;
        c.bond = bond;
        c.size = size;
        c.roundLength = roundLength;
        c.name = name;

        emit CircleCreated(id, msg.sender, name, contribution, bond, size, roundLength);
        if (invited.length > 0) {
            c.inviteOnly = true;
            _invite(id, invited);
        }
        _join(id, c);
    }

    /// @notice Join a circle that is not full yet, locking its bond in $WIF.
    function join(uint256 id) external nonReentrant {
        _join(id, _circle(id));
    }

    /// @notice The creator of an invite-only circle adds wallets that may join, until it starts.
    function invite(uint256 id, address[] calldata who) external {
        Circle storage c = _circle(id);
        if (msg.sender != c.creator) revert NotCreator();
        if (!c.inviteOnly) revert NotInviteOnly();
        if (c.startedAt != 0) revert AlreadyStarted();
        _invite(id, who);
    }

    /// @notice Leave a circle before it starts and get your bond back.
    function leave(uint256 id) external nonReentrant {
        Circle storage c = _circle(id);
        if (c.startedAt != 0) revert AlreadyStarted();
        if (!isMember[id][msg.sender]) revert NotMember();

        address[] storage list = _members[id];
        uint256 n = list.length;
        for (uint256 i; i < n; ++i) {
            if (list[i] == msg.sender) {
                // Keep the joining order for everyone else.
                for (uint256 j = i; j + 1 < n; ++j) list[j] = list[j + 1];
                list.pop();
                break;
            }
        }
        isMember[id][msg.sender] = false;
        emit Left(id, msg.sender);
        bondToken.safeTransfer(msg.sender, c.bond);
    }

    // ─── While it runs ────────────────────────────────────────────────────

    /// @notice Pay this round's contribution. Any earlier round whose time is up
    /// is closed first, so a round nobody remembered to close never stops you paying.
    function contribute(uint256 id) external nonReentrant {
        Circle storage c = _circle(id);
        if (c.startedAt == 0) revert NotStarted();
        if (!isMember[id][msg.sender]) revert NotMember();

        _settleDue(id, c);
        uint256 round = c.roundsSettled; // after _settleDue, this is the round the clock is in
        if (round >= c.size) revert CircleOver();
        if (isDefaulted[id][msg.sender]) revert MemberDefaulted();
        if (hasPaid[id][round][msg.sender]) revert AlreadyPaid();

        hasPaid[id][round][msg.sender] = true;
        roundPot[id][round] += c.contribution;
        emit Contributed(id, round, msg.sender, c.contribution);
        savingsToken.safeTransferFrom(msg.sender, address(this), c.contribution);
    }

    /// @notice Close the oldest open round. Anyone can call it once the round's
    /// time is up, or as soon as every member still in good standing has paid.
    /// Whoever did not pay loses their bond; the pot goes to this round's member,
    /// or back to the payers if that member had already defaulted.
    /// (Paying and claiming a bond also close overdue rounds on their own.)
    function settleRound(uint256 id) external nonReentrant {
        Circle storage c = _circle(id);
        if (c.startedAt == 0) revert NotStarted();
        uint256 round = c.roundsSettled;
        if (round >= c.size) revert CircleOver();

        if (!_timeUp(c, round)) {
            address[] storage list = _members[id];
            uint256 n = list.length;
            for (uint256 i; i < n; ++i) {
                address m = list[i];
                if (!isDefaulted[id][m] && !hasPaid[id][round][m]) revert RoundStillOpen();
            }
        }
        _settle(id, c, round);
    }

    // ─── Taking money out ─────────────────────────────────────────────────

    /// @notice Withdraw your payouts and refunds.
    function withdraw() external nonReentrant {
        uint256 amount = owed[msg.sender];
        if (amount == 0) revert NothingOwed();
        owed[msg.sender] = 0;
        emit Withdrawn(msg.sender, amount);
        savingsToken.safeTransfer(msg.sender, amount);
    }

    /// @notice After the last round, every member who never missed a round takes
    /// back their bond plus an equal share of the bonds lost by those who did.
    /// If every member missed a round there is nobody to share with, so each
    /// takes back only their own bond rather than leaving it locked forever.
    function claimBond(uint256 id) external nonReentrant {
        Circle storage c = _circle(id);
        if (c.startedAt == 0) revert NotOver();
        _settleDue(id, c); // the last round closes itself once its time is up
        if (c.roundsSettled < c.size) revert NotOver();
        if (!isMember[id][msg.sender]) revert NotMember();
        if (isDefaulted[id][msg.sender] && c.defaults < c.size) revert MemberDefaulted();
        if (bondClaimed[id][msg.sender]) revert AlreadyClaimed();

        bondClaimed[id][msg.sender] = true;
        uint256 amount = bondShare(id);
        emit BondClaimed(id, msg.sender, amount);
        bondToken.safeTransfer(msg.sender, amount);
    }

    // ─── Reading ──────────────────────────────────────────────────────────

    function circleCount() external view returns (uint256) {
        return _circles.length;
    }

    function getCircle(uint256 id) external view returns (Circle memory) {
        return _circle(id);
    }

    function getMembers(uint256 id) external view returns (address[] memory) {
        _circle(id);
        return _members[id];
    }

    /// @notice The round the clock is in (it can be ahead of `roundsSettled`).
    /// Returns `size` once the last round's time is over.
    function currentRound(uint256 id) external view returns (uint256) {
        Circle storage c = _circle(id);
        if (c.startedAt == 0) revert NotStarted();
        uint256 r = _roundAt(c);
        return r > c.size ? c.size : r;
    }

    /// @notice What a member in good standing gets back from `claimBond`.
    /// Any remainder from the division stays in the contract.
    function bondShare(uint256 id) public view returns (uint256) {
        Circle storage c = _circle(id);
        uint256 honest = uint256(c.size) - c.defaults;
        if (honest == 0) return c.bond; // everyone defaulted: each takes back their own
        return uint256(c.bond) + c.penaltyPool / honest;
    }

    // ─── Internal ─────────────────────────────────────────────────────────

    function _circle(uint256 id) internal view returns (Circle storage) {
        if (id >= _circles.length) revert NoSuchCircle();
        return _circles[id];
    }

    function _roundAt(Circle storage c) internal view returns (uint256) {
        return (block.timestamp - c.startedAt) / c.roundLength;
    }

    function _timeUp(Circle storage c, uint256 round) internal view returns (bool) {
        return block.timestamp >= uint256(c.startedAt) + (round + 1) * uint256(c.roundLength);
    }

    /// Close, in order, every round whose time is up. At most `size` rounds of
    /// at most 20 members each, so the loop stays small.
    function _settleDue(uint256 id, Circle storage c) internal {
        uint256 round = c.roundsSettled;
        while (round < c.size && _timeUp(c, round)) {
            _settle(id, c, round);
            ++round;
        }
    }

    /// Close one round: whoever did not pay defaults and loses their bond; the
    /// pot goes to this round's member, or back to the payers if they defaulted.
    function _settle(uint256 id, Circle storage c, uint256 round) internal {
        address[] storage list = _members[id];
        uint256 n = list.length;
        for (uint256 i; i < n; ++i) {
            address m = list[i];
            if (!isDefaulted[id][m] && !hasPaid[id][round][m]) {
                isDefaulted[id][m] = true;
                c.defaults += 1;
                c.penaltyPool += c.bond;
                emit Defaulted(id, round, m, c.bond);
            }
        }

        uint256 pot = roundPot[id][round];
        address recipient = list[round];
        bool refunded = isDefaulted[id][recipient];
        if (refunded) {
            // A member who stopped paying does not collect: everyone who paid gets their money back.
            for (uint256 i; i < n; ++i) {
                address m = list[i];
                if (hasPaid[id][round][m]) owed[m] += c.contribution;
            }
        } else {
            owed[recipient] += pot;
        }

        c.roundsSettled = uint32(round + 1);
        emit RoundSettled(id, round, recipient, pot, refunded);
    }

    function _invite(uint256 id, address[] calldata who) internal {
        if (who.length > MAX_INVITES) revert TooManyInvites();
        for (uint256 i; i < who.length; ++i) {
            address a = who[i];
            if (a == address(0) || isInvited[id][a]) continue;
            isInvited[id][a] = true;
            emit Invited(id, a);
        }
    }

    function _join(uint256 id, Circle storage c) internal {
        if (c.startedAt != 0) revert AlreadyStarted();
        if (isMember[id][msg.sender]) revert AlreadyMember();
        if (c.inviteOnly && msg.sender != c.creator && !isInvited[id][msg.sender]) revert NotInvited();
        address[] storage list = _members[id];
        if (list.length >= c.size) revert Full();

        isMember[id][msg.sender] = true;
        list.push(msg.sender);
        uint256 position = list.length - 1;
        // The creator always takes the last turn. While the creator is a member
        // they sit at the end of the list, so a new member goes just before them.
        if (msg.sender != c.creator && isMember[id][c.creator]) {
            list[position] = c.creator;
            list[position - 1] = msg.sender;
            position -= 1;
        }
        emit Joined(id, msg.sender, position);

        if (list.length == c.size) {
            c.startedAt = uint64(block.timestamp);
            emit Started(id, block.timestamp);
        }
        bondToken.safeTransferFrom(msg.sender, address(this), c.bond);
    }
}
