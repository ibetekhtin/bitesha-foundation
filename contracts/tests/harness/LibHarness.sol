// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../libraries/Security.sol";
import "../../core/BTSHTokenConfig.sol";

/**
 * @title LibHarness
 * @notice Test-only wrapper that exposes internal library functions as external
 *         calls so they can be exercised and covered by the Hardhat test suite.
 *         NOT part of the production deployment.
 */
contract LibHarness {
    function verifyKeyedHash(bytes memory payload, bytes32 signature, bytes32 secret)
        external
        pure
        returns (bool)
    {
        return Security.verifyKeyedHash(payload, signature, secret);
    }

    function computeKeyedHash(bytes memory payload, bytes32 secret)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(secret, payload));
    }

    function requireEOA(address account) external view {
        Security.requireEOA(account);
    }

    function safeEqual(bytes32 a, bytes32 b) external pure returns (bool) {
        return Security.safeEqual(a, b);
    }

    function allocationOf(uint16 basisPoints) external pure returns (uint256) {
        return BTSHTokenConfig.allocationOf(basisPoints);
    }

    function totalSupply() external pure returns (uint256) {
        return BTSHTokenConfig.TOTAL_SUPPLY;
    }
}
