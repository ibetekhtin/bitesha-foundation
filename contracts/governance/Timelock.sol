// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * @title BITESHATimelock
 * @notice 2-day timelock for DAO proposals. Governor is the only proposer.
 *         Anyone can execute after delay.
 */
contract BITESHATimelock is TimelockController {
    uint256 public constant MIN_DELAY = 2 days;

    constructor(
        address[] memory proposers,
        address[] memory executors,
        address admin
    )
        TimelockController(MIN_DELAY, proposers, executors, admin)
    {}
}
