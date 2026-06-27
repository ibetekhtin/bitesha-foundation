// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BTSHStaking
 * @notice Time-weighted BTSH staking with a bounded reward pool.
 *
 * Reward model:
 *   - Treasury deposits a fixed reward budget.
 *   - Owner sets rewardRate (tokens/second across all stakers).
 *   - rewardEndsAt is derived from (deposited budget / rewardRate).
 *   - rewardPerToken() is capped at rewardEndsAt — the contract can never
 *     promise more tokens than it holds for rewards.
 *
 * Lock model:
 *   - The lock timer starts when a position goes from 0 → non-zero.
 *   - Adding to an existing position does NOT reset the lock.
 *   - After full unstake the timer resets on the next stake.
 *
 * Emergency withdrawal:
 *   - If the contract is paused (owner), stakers can withdraw principal
 *     without rewards via emergencyWithdraw().
 */
contract BTSHStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable btsh;

    // ── Reward accounting ──────────────────────────────────────────────────
    uint256 public rewardRate;             // tokens per second, across all stakers
    uint256 public rewardPerTokenStored;
    uint256 public lastUpdateTime;
    uint256 public rewardEndsAt;           // timestamp after which no more rewards accrue
    uint256 public rewardBudgetRemaining;  // rewards deposited but not yet distributed

    // ── Staking ───────────────────────────────────────────────────────────
    uint256 public totalStaked;
    uint256 public constant LOCK_PERIOD = 7 days;

    bool public emergencyMode;

    struct StakeInfo {
        uint256 amount;
        uint256 rewardDebt;   // rewardPerToken snapshot at last interaction
        uint256 earned;       // pending rewards not yet transferred
        uint256 stakedAt;     // set once when amount goes 0 → non-zero
    }

    mapping(address => StakeInfo) public stakes;

    // ── Events ────────────────────────────────────────────────────────────
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);
    event RewardsDeposited(uint256 amount, uint256 newRewardEndsAt);
    event RewardRateUpdated(uint256 newRate, uint256 newRewardEndsAt);
    event EmergencyModeEnabled();
    event EmergencyWithdrawn(address indexed user, uint256 amount);

    constructor(address _btsh, address initialOwner) Ownable(initialOwner) {
        require(_btsh != address(0), "Staking: zero token");
        btsh = IERC20(_btsh);
    }

    // ── Modifiers ─────────────────────────────────────────────────────────

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = _applicableTime();
        if (account != address(0)) {
            stakes[account].earned = _earned(account);
            stakes[account].rewardDebt = rewardPerTokenStored;
        }
        _;
    }

    // ── User actions ──────────────────────────────────────────────────────

    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(!emergencyMode, "Staking: emergency mode");
        require(amount > 0, "Staking: zero amount");

        StakeInfo storage s = stakes[msg.sender];

        // Lock timer starts only when the position is opened from zero.
        // Additional top-ups do NOT reset the lock.
        if (s.amount == 0) {
            s.stakedAt = block.timestamp;
        }

        s.amount += amount;
        totalStaked += amount;
        btsh.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(!emergencyMode, "Staking: use emergencyWithdraw");
        StakeInfo storage s = stakes[msg.sender];
        require(amount > 0 && amount <= s.amount, "Staking: invalid amount");
        require(block.timestamp >= s.stakedAt + LOCK_PERIOD, "Staking: lock period active");

        s.amount -= amount;
        totalStaked -= amount;
        // Reset stakedAt when position is fully closed so next stake starts a fresh lock.
        if (s.amount == 0) {
            s.stakedAt = 0;
        }
        btsh.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function claimReward() external nonReentrant updateReward(msg.sender) {
        require(!emergencyMode, "Staking: emergency mode");
        uint256 reward = stakes[msg.sender].earned;
        require(reward > 0, "Staking: no rewards");

        stakes[msg.sender].earned = 0;
        rewardBudgetRemaining -= reward; // underflow reverts if budget exhausted
        btsh.safeTransfer(msg.sender, reward);
        emit RewardClaimed(msg.sender, reward);
    }

    /**
     * @notice Emergency exit: returns staked principal, forfeits pending rewards.
     *         Only callable when emergencyMode is active.
     */
    function emergencyWithdraw() external nonReentrant {
        require(emergencyMode, "Staking: not emergency mode");
        StakeInfo storage s = stakes[msg.sender];
        uint256 amount = s.amount;
        require(amount > 0, "Staking: nothing staked");

        s.amount = 0;
        s.earned = 0;
        s.stakedAt = 0;
        totalStaked -= amount;

        btsh.safeTransfer(msg.sender, amount);
        emit EmergencyWithdrawn(msg.sender, amount);
    }

    // ── Owner actions ─────────────────────────────────────────────────────

    /**
     * @notice Deposit reward tokens and extend the reward period accordingly.
     *         rewardRate must be set before depositing (or set atomically after).
     */
    function depositRewards(uint256 amount) external onlyOwner updateReward(address(0)) {
        require(amount > 0, "Staking: zero amount");
        btsh.safeTransferFrom(msg.sender, address(this), amount);
        rewardBudgetRemaining += amount;

        if (rewardRate > 0) {
            // Extend reward end time by how long the new budget will last at current rate.
            uint256 extension = amount / rewardRate;
            uint256 base = rewardEndsAt > block.timestamp ? rewardEndsAt : block.timestamp;
            rewardEndsAt = base + extension;
        }
        emit RewardsDeposited(amount, rewardEndsAt);
    }

    /**
     * @notice Set reward rate. Recalculates rewardEndsAt from remaining budget.
     */
    function setRewardRate(uint256 newRate) external onlyOwner updateReward(address(0)) {
        require(newRate > 0 || rewardBudgetRemaining == 0, "Staking: zero rate with budget");
        rewardRate = newRate;

        if (newRate > 0 && rewardBudgetRemaining > 0) {
            rewardEndsAt = block.timestamp + rewardBudgetRemaining / newRate;
        } else {
            rewardEndsAt = block.timestamp;
        }
        emit RewardRateUpdated(newRate, rewardEndsAt);
    }

    /**
     * @notice Enable emergency mode. Stakers can then call emergencyWithdraw().
     *         Irreversible — intended for critical contract failures only.
     */
    function enableEmergencyMode() external onlyOwner {
        emergencyMode = true;
        emit EmergencyModeEnabled();
    }

    // ── View functions ────────────────────────────────────────────────────

    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) return rewardPerTokenStored;
        uint256 dt = _applicableTime() - lastUpdateTime;
        return rewardPerTokenStored + (dt * rewardRate * 1e18) / totalStaked;
    }

    function earned(address account) external view returns (uint256) {
        return _earned(account);
    }

    // ── Internals ─────────────────────────────────────────────────────────

    function _applicableTime() private view returns (uint256) {
        // Reward accrual stops at rewardEndsAt — prevents budget over-promise.
        return block.timestamp < rewardEndsAt ? block.timestamp : rewardEndsAt;
    }

    function _earned(address account) private view returns (uint256) {
        StakeInfo storage s = stakes[account];
        return s.earned + (s.amount * (rewardPerToken() - s.rewardDebt)) / 1e18;
    }
}
