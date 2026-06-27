// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CharityVault
 * @notice On-chain enforcement of BITESHA's charity policy:
 *         every deposit is split 80% to FOOD, 20% to OPERATIONS.
 *
 *         Mission: feed people on the streets of New York.
 *         80% of funds buy food. 20% run the logistics that distribute it.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHAT THIS CONTRACT GUARANTEES (on-chain, immutable, verifiable by anyone):
 *   1. The 80/20 split is fixed in code and cannot be changed by anyone.
 *   2. Every dollar received is accounted to either the food or ops fund.
 *   3. Every withdrawal is public, with a stated purpose and a receipt hash.
 *   4. Cumulative totals (received / spent) are queryable forever.
 *
 * WHAT THIS CONTRACT CANNOT GUARANTEE (happens off-chain, in the real world):
 *   - That the 80% withdrawn from the food fund is actually spent on food.
 *     The contract routes USDC to the food operator; the operator buys food
 *     from real NYC suppliers in USD. Accountability for that step relies on
 *     the published purpose + receiptHash of each spend, NOT on code.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Operational design:
 *   - Funds are held in a stablecoin (USDC) so $80 stays $80 until food is bought.
 *   - Spenders are roles, intended to be held by multisig wallets (Gnosis Safe),
 *     NOT a slow timelock — feeding people must be operationally fast.
 *   - The 80/20 ratio is immutable. For a charity promise, mutability would
 *     undermine trust, so it is deliberately NOT governable.
 */
contract CharityVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Immutable charity policy ───────────────────────────────────────────
    uint16 public constant FOOD_BPS = 8000; // 80%
    uint16 public constant OPS_BPS  = 2000; // 20%
    uint16 public constant BPS_DENOMINATOR = 10_000;

    // Stablecoin the vault holds and spends (e.g. USDC). Immutable.
    IERC20 public immutable stablecoin;

    // ── Roles ──────────────────────────────────────────────────────────────
    bytes32 public constant FOOD_SPENDER_ROLE = keccak256("FOOD_SPENDER_ROLE");
    bytes32 public constant OPS_SPENDER_ROLE  = keccak256("OPS_SPENDER_ROLE");

    // ── Live fund balances (spendable, in stablecoin units) ────────────────
    uint256 public foodBalance;
    uint256 public opsBalance;

    // ── Cumulative transparency counters (never decrease) ──────────────────
    uint256 public totalReceived;
    uint256 public totalToFood;
    uint256 public totalToOps;
    uint256 public totalSpentFood;
    uint256 public totalSpentOps;

    // ── Events ─────────────────────────────────────────────────────────────
    event Deposited(address indexed from, uint256 amount, uint256 toFood, uint256 toOps);
    event Synced(uint256 unaccounted, uint256 toFood, uint256 toOps);
    event FoodSpent(address indexed to, uint256 amount, string purpose, bytes32 receiptHash);
    event OpsSpent(address indexed to, uint256 amount, string purpose, bytes32 receiptHash);

    constructor(address _stablecoin, address admin) {
        require(_stablecoin != address(0), "Charity: zero stablecoin");
        require(admin != address(0), "Charity: zero admin");
        stablecoin = IERC20(_stablecoin);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ── Deposits ───────────────────────────────────────────────────────────

    /**
     * @notice Deposit stablecoin into the vault. Splits 80/20 atomically.
     *         Caller must have approved this contract for `amount`.
     * @dev    Any rounding dust goes to FOOD (charity-favouring).
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Charity: zero amount");

        // Floor the OPS share and give the remainder (incl. rounding dust) to FOOD.
        // This guarantees food always receives >= 80%, never less.
        uint256 toOps  = (amount * OPS_BPS) / BPS_DENOMINATOR;
        uint256 toFood = amount - toOps;

        // Pull funds first, then update accounting.
        stablecoin.safeTransferFrom(msg.sender, address(this), amount);

        foodBalance   += toFood;
        opsBalance    += toOps;
        totalReceived += amount;
        totalToFood   += toFood;
        totalToOps    += toOps;

        emit Deposited(msg.sender, amount, toFood, toOps);
    }

    /**
     * @notice Allocate any stablecoin sent directly to the vault (bypassing
     *         deposit) by splitting the unaccounted balance 80/20.
     *         Lets the vault safely absorb raw transfers / donations.
     */
    function sync() external nonReentrant {
        uint256 onChain = stablecoin.balanceOf(address(this));
        uint256 accounted = foodBalance + opsBalance;
        require(onChain > accounted, "Charity: nothing to sync");

        uint256 unaccounted = onChain - accounted;
        // Floor the OPS share; remainder (incl. dust) goes to FOOD. Food always >= 80%.
        uint256 toOps  = (unaccounted * OPS_BPS) / BPS_DENOMINATOR;
        uint256 toFood = unaccounted - toOps;

        foodBalance   += toFood;
        opsBalance    += toOps;
        totalReceived += unaccounted;
        totalToFood   += toFood;
        totalToOps    += toOps;

        emit Synced(unaccounted, toFood, toOps);
    }

    // ── Spending ─────────────────────────────────────────────────────────────

    /**
     * @notice Spend from the FOOD fund to buy food (off-chain, in NYC).
     * @param to          Supplier / payout address.
     * @param amount      Stablecoin amount.
     * @param purpose     Human-readable purpose (e.g. "500 meals — Bronx, 2026-07-01").
     * @param receiptHash Hash of the off-chain receipt/invoice (IPFS CID hash or keccak).
     */
    function spendFood(address to, uint256 amount, string calldata purpose, bytes32 receiptHash)
        external
        onlyRole(FOOD_SPENDER_ROLE)
        nonReentrant
    {
        require(to != address(0), "Charity: zero recipient");
        require(amount > 0 && amount <= foodBalance, "Charity: invalid food amount");

        foodBalance    -= amount;
        totalSpentFood += amount;

        stablecoin.safeTransfer(to, amount);
        emit FoodSpent(to, amount, purpose, receiptHash);
    }

    /**
     * @notice Spend from the OPERATIONS fund (logistics, legal, volunteers).
     */
    function spendOps(address to, uint256 amount, string calldata purpose, bytes32 receiptHash)
        external
        onlyRole(OPS_SPENDER_ROLE)
        nonReentrant
    {
        require(to != address(0), "Charity: zero recipient");
        require(amount > 0 && amount <= opsBalance, "Charity: invalid ops amount");

        opsBalance    -= amount;
        totalSpentOps += amount;

        stablecoin.safeTransfer(to, amount);
        emit OpsSpent(to, amount, purpose, receiptHash);
    }

    // ── Transparency views ───────────────────────────────────────────────────

    /**
     * @notice Full public snapshot for dashboards and audits.
     */
    function stats()
        external
        view
        returns (
            uint256 received,
            uint256 allocatedFood,
            uint256 allocatedOps,
            uint256 spentFood,
            uint256 spentOps,
            uint256 availableFood,
            uint256 availableOps
        )
    {
        return (
            totalReceived,
            totalToFood,
            totalToOps,
            totalSpentFood,
            totalSpentOps,
            foodBalance,
            opsBalance
        );
    }

    /**
     * @notice The effective share of all received funds that went to food, in bps.
     *         Always >= FOOD_BPS because rounding dust favours food.
     */
    function effectiveFoodShareBps() external view returns (uint256) {
        if (totalReceived == 0) return FOOD_BPS;
        return (totalToFood * BPS_DENOMINATOR) / totalReceived;
    }
}
