// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BTSHStaking
 * @notice Time-weighted BTSH staking. Boosts governance voting power.
 *         No inflationary rewards — reward budget must be deposited by the treasury.
 *
 * Reward model: proportional share of the reward pool, accruing per second.
 */
contract BTSHStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable btsh;

    uint256 public rewardRate;        // tokens per second distributed across all stakers
    uint256 public rewardPerTokenStored;
    uint256 public lastUpdateTime;
    uint256 public totalStaked;

    uint256 public constant LOCK_PERIOD = 7 days;

    struct StakeInfo {
        uint256 amount;
        uint256 rewardDebt;       // rewardPerToken at last claim
        uint256 earned;           // pending rewards
        uint256 stakedAt;
    }

    mapping(address => StakeInfo) public stakes;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);
    event RewardRateUpdated(uint256 newRate);

    constructor(address _btsh, address initialOwner) Ownable(initialOwner) {
        require(_btsh != address(0), "Staking: zero token");
        btsh = IERC20(_btsh);
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;
        if (account != address(0)) {
            stakes[account].earned = _earned(account);
            stakes[account].rewardDebt = rewardPerTokenStored;
        }
        _;
    }

    function stake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "Staking: zero amount");
        stakes[msg.sender].amount += amount;
        stakes[msg.sender].stakedAt = block.timestamp;
        totalStaked += amount;
        btsh.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        StakeInfo storage s = stakes[msg.sender];
        require(amount <= s.amount, "Staking: exceeds balance");
        require(block.timestamp >= s.stakedAt + LOCK_PERIOD, "Staking: lock period active");

        s.amount -= amount;
        totalStaked -= amount;
        btsh.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function claimReward() external nonReentrant updateReward(msg.sender) {
        uint256 reward = stakes[msg.sender].earned;
        require(reward > 0, "Staking: no rewards");
        stakes[msg.sender].earned = 0;
        btsh.safeTransfer(msg.sender, reward);
        emit RewardClaimed(msg.sender, reward);
    }

    function setRewardRate(uint256 newRate) external onlyOwner updateReward(address(0)) {
        rewardRate = newRate;
        emit RewardRateUpdated(newRate);
    }

    function depositRewards(uint256 amount) external onlyOwner {
        btsh.safeTransferFrom(msg.sender, address(this), amount);
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) return rewardPerTokenStored;
        return rewardPerTokenStored
            + ((block.timestamp - lastUpdateTime) * rewardRate * 1e18) / totalStaked;
    }

    function _earned(address account) private view returns (uint256) {
        StakeInfo storage s = stakes[account];
        return s.earned
            + (s.amount * (rewardPerToken() - s.rewardDebt)) / 1e18;
    }

    function earned(address account) external view returns (uint256) {
        return _earned(account);
    }
}
