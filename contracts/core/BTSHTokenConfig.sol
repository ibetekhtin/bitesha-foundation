// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BTSHTokenConfig
 * @notice Distribution constants for the BTSH genesis allocation.
 *         All values in basis points (10 000 = 100 %).
 *
 *         BTSH is a DONATION + GOVERNANCE token, not an investment instrument.
 *         There is deliberately NO private-investor allocation and NO staking-yield
 *         allocation — both would signal a profit expectation (Howey). Buckets fund
 *         the charity mission, its governance, and its operation.
 */
library BTSHTokenConfig {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10 ** 18;

    // Allocation in basis points (must sum to 10 000)
    uint16 public constant ECOSYSTEM_BP       = 3000; // 30 % — ecosystem & growth of the mission
    uint16 public constant TEAM_BP            = 1500; // 15 % — team (vested 4 yr, compensation)
    uint16 public constant TREASURY_BP        = 2000; // 20 % — foundation treasury
    uint16 public constant CHARITY_RESERVE_BP = 1000; // 10 % — long-term charity reserve, DAO-governed
    uint16 public constant PUBLIC_DONATION_BP =  500; //  5 % — public donation round
    uint16 public constant COMMUNITY_BP       = 1500; // 15 % — community & DAO governance distribution
    uint16 public constant LIQUIDITY_BP       =  500; //  5 % — initial DEX liquidity

    function allocationOf(uint16 basisPoints) internal pure returns (uint256) {
        return (TOTAL_SUPPLY * basisPoints) / 10_000;
    }
}
