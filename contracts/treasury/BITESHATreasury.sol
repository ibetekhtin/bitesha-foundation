// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BITESHATreasury
 * @notice BITESHA Foundation treasury.
 *
 * Role model (post-deployment):
 *   DEFAULT_ADMIN_ROLE  → Timelock (transferred in deploy script; renounced from deployer)
 *   GOVERNOR_ROLE       → Timelock (allows DAO to initiate allocations)
 *   TIMELOCK_ROLE       → Timelock (required for amounts ≥ LARGE_ALLOCATION_THRESHOLD)
 *
 * Attack surface mitigations:
 *   - Large BTSH allocations require TIMELOCK_ROLE (DAO + 2-day delay).
 *   - ALL ETH allocations require TIMELOCK_ROLE regardless of amount.
 *   - Split-allocation attack is limited by a per-period cap enforced off-chain
 *     through DAO governance; on-chain threshold is a defence-in-depth measure.
 *   - DEFAULT_ADMIN_ROLE must NOT remain with the deployer EOA after deployment.
 */
contract BITESHATreasury is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant GOVERNOR_ROLE = keccak256("GOVERNOR_ROLE");
    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");

    IERC20 public immutable btsh;

    // Amounts at or above this threshold require TIMELOCK_ROLE.
    uint256 public constant LARGE_ALLOCATION_THRESHOLD = 1_000_000 * 10 ** 18; // 1 M BTSH

    event BTSHAllocated(address indexed to, uint256 amount, string reason);
    event ETHAllocated(address indexed to, uint256 amount, string reason);
    event Received(address indexed from, uint256 amount);

    constructor(address _btsh, address admin) {
        require(_btsh != address(0), "Treasury: zero token");
        btsh = IERC20(_btsh);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GOVERNOR_ROLE, admin);
        // IMPORTANT: deploy script must call transferAdmin(timelock) and then
        // renounceRole(DEFAULT_ADMIN_ROLE, deployer) after deployment.
    }

    /**
     * @notice Transfer DEFAULT_ADMIN_ROLE to a new admin (should be the Timelock).
     *         Caller must hold DEFAULT_ADMIN_ROLE. Revoke own role immediately after.
     */
    function transferAdmin(address newAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newAdmin != address(0), "Treasury: zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
        // Caller must separately renounce their own DEFAULT_ADMIN_ROLE.
    }

    /**
     * @notice Allocate BTSH tokens.
     *         Amounts < LARGE_ALLOCATION_THRESHOLD: requires GOVERNOR_ROLE.
     *         Amounts ≥ LARGE_ALLOCATION_THRESHOLD: requires TIMELOCK_ROLE.
     */
    function allocateBTSH(address to, uint256 amount, string calldata reason)
        external
        nonReentrant
    {
        require(to != address(0), "Treasury: zero address");
        require(amount > 0, "Treasury: zero amount");

        if (amount >= LARGE_ALLOCATION_THRESHOLD) {
            require(hasRole(TIMELOCK_ROLE, msg.sender), "Treasury: requires timelock");
        } else {
            require(hasRole(GOVERNOR_ROLE, msg.sender), "Treasury: not governor");
        }

        btsh.safeTransfer(to, amount);
        emit BTSHAllocated(to, amount, reason);
    }

    /**
     * @notice Allocate native ETH.
     *         Always requires TIMELOCK_ROLE regardless of amount — ETH has no threshold bypass.
     */
    function allocateETH(address payable to, uint256 amount, string calldata reason)
        external
        onlyRole(TIMELOCK_ROLE)
        nonReentrant
    {
        require(to != address(0), "Treasury: zero address");
        require(amount <= address(this).balance, "Treasury: insufficient ETH");

        (bool ok,) = to.call{value: amount}("");
        require(ok, "Treasury: ETH transfer failed");
        emit ETHAllocated(to, amount, reason);
    }

    function btshBalance() external view returns (uint256) {
        return btsh.balanceOf(address(this));
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
}
