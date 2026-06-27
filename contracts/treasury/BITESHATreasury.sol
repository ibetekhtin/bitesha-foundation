// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BITESHATreasury
 * @notice BITESHA Foundation treasury.
 *         GOVERNOR role can allocate funds.
 *         TIMELOCK_ROLE enforces a delay on large allocations (set by MultisigController).
 */
contract BITESHATreasury is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant GOVERNOR_ROLE  = keccak256("GOVERNOR_ROLE");
    bytes32 public constant TIMELOCK_ROLE  = keccak256("TIMELOCK_ROLE");

    IERC20 public immutable btsh;

    uint256 public constant LARGE_ALLOCATION_THRESHOLD = 1_000_000 * 10 ** 18; // 1 M BTSH

    event BTSHAllocated(address indexed to, uint256 amount, string reason);
    event ETHAllocated(address indexed to, uint256 amount, string reason);
    event Received(address indexed from, uint256 amount);

    constructor(address _btsh, address admin) {
        require(_btsh != address(0), "Treasury: zero token");
        btsh = IERC20(_btsh);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GOVERNOR_ROLE, admin);
    }

    /**
     * @notice Allocate BTSH tokens.
     *         Amounts >= LARGE_ALLOCATION_THRESHOLD require TIMELOCK_ROLE (multisig + delay).
     */
    function allocateBTSH(address to, uint256 amount, string calldata reason)
        external
        nonReentrant
    {
        require(to != address(0), "Treasury: zero address");
        require(amount > 0, "Treasury: zero amount");

        if (amount >= LARGE_ALLOCATION_THRESHOLD) {
            require(hasRole(TIMELOCK_ROLE, msg.sender), "Treasury: requires timelock for large allocation");
        } else {
            require(hasRole(GOVERNOR_ROLE, msg.sender), "Treasury: not governor");
        }

        btsh.safeTransfer(to, amount);
        emit BTSHAllocated(to, amount, reason);
    }

    /**
     * @notice Allocate native ETH / gas token.
     */
    function allocateETH(address payable to, uint256 amount, string calldata reason)
        external
        onlyRole(GOVERNOR_ROLE)
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
