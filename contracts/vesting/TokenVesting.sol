// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TokenVesting
 * @notice Linear vesting with cliff for team, investors, and advisors.
 *         Each beneficiary gets exactly one schedule.
 */
contract TokenVesting is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    struct Schedule {
        uint256 total;       // tokens granted
        uint256 released;    // tokens already claimed
        uint256 start;       // vesting start (unix ts)
        uint256 cliff;       // cliff duration in seconds
        uint256 duration;    // vesting duration AFTER cliff, in seconds
        bool    revoked;
    }

    mapping(address => Schedule) public schedules;

    event VestingCreated(address indexed beneficiary, uint256 total, uint256 cliff, uint256 duration);
    event TokensClaimed(address indexed beneficiary, uint256 amount);
    event VestingRevoked(address indexed beneficiary, uint256 returned);

    constructor(address _token, address initialOwner) Ownable(initialOwner) {
        require(_token != address(0), "Vesting: zero token");
        token = IERC20(_token);
    }

    /**
     * @notice Create a vesting schedule for a beneficiary.
     * @param beneficiary  Recipient address.
     * @param total        Total tokens to vest.
     * @param cliff        Seconds before any tokens unlock.
     * @param duration     Seconds of linear unlock after cliff ends.
     * @param startOffset  Seconds from now when vesting begins (0 = now).
     */
    function createVesting(
        address beneficiary,
        uint256 total,
        uint256 cliff,
        uint256 duration,
        uint256 startOffset
    ) external onlyOwner {
        require(beneficiary != address(0), "Vesting: zero beneficiary");
        require(total > 0, "Vesting: zero amount");
        require(duration > 0, "Vesting: zero duration");
        require(schedules[beneficiary].total == 0, "Vesting: schedule exists");

        schedules[beneficiary] = Schedule({
            total:    total,
            released: 0,
            start:    block.timestamp + startOffset,
            cliff:    cliff,
            duration: duration,
            revoked:  false
        });

        token.safeTransferFrom(msg.sender, address(this), total);
        emit VestingCreated(beneficiary, total, cliff, duration);
    }

    /**
     * @notice Claim all currently vested tokens.
     */
    function claim() external nonReentrant {
        Schedule storage s = schedules[msg.sender];
        require(s.total > 0, "Vesting: no schedule");
        require(!s.revoked, "Vesting: revoked");

        uint256 claimable = _vestedAmount(s) - s.released;
        require(claimable > 0, "Vesting: nothing to claim");

        s.released += claimable;
        token.safeTransfer(msg.sender, claimable);
        emit TokensClaimed(msg.sender, claimable);
    }

    /**
     * @notice Revoke a schedule (team/advisor only).
     *         Already-vested-but-unclaimed tokens go to the beneficiary.
     *         Unvested tokens return to owner.
     */
    function revoke(address beneficiary) external onlyOwner {
        Schedule storage s = schedules[beneficiary];
        require(s.total > 0, "Vesting: no schedule");
        require(!s.revoked, "Vesting: already revoked");

        uint256 vested   = _vestedAmount(s);
        uint256 claimable = vested - s.released;
        uint256 unvested  = s.total - vested;

        s.revoked = true;

        // Pay out tokens already earned but not yet claimed — do not trap them.
        if (claimable > 0) {
            s.released += claimable;
            token.safeTransfer(beneficiary, claimable);
            emit TokensClaimed(beneficiary, claimable);
        }

        if (unvested > 0) {
            token.safeTransfer(owner(), unvested);
        }

        emit VestingRevoked(beneficiary, unvested);
    }

    function vestedAmount(address beneficiary) external view returns (uint256) {
        return _vestedAmount(schedules[beneficiary]);
    }

    function claimableAmount(address beneficiary) external view returns (uint256) {
        Schedule storage s = schedules[beneficiary];
        return _vestedAmount(s) - s.released;
    }

    function _vestedAmount(Schedule storage s) private view returns (uint256) {
        if (block.timestamp < s.start + s.cliff) {
            return 0;
        }
        uint256 elapsed = block.timestamp - (s.start + s.cliff);
        if (elapsed >= s.duration) {
            return s.total;
        }
        return (s.total * elapsed) / s.duration;
    }
}
