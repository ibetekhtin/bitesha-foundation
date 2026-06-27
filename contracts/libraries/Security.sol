// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Security
 * @notice Common security helpers used across BITESHA contracts.
 */
library Security {
    /**
     * @notice Verify an HMAC-SHA256 signature from a webhook.
     *         Use for off-chain signature verification pattern before storing on-chain.
     * @param payload   Raw payload bytes.
     * @param signature Expected HMAC digest (32 bytes).
     * @param secret    Shared secret key.
     */
    function verifyHmac(
        bytes memory payload,
        bytes32 signature,
        bytes32 secret
    ) internal pure returns (bool) {
        bytes32 computed = keccak256(abi.encodePacked(secret, payload));
        return computed == signature;
    }

    /**
     * @notice Prevent calls from contracts (EOA-only guard).
     *         Note: not foolproof against constructor calls — use with care.
     */
    function requireEOA(address account) internal view {
        require(account.code.length == 0, "Security: contracts not allowed");
    }

    /**
     * @notice Constant-time bytes32 comparison to prevent timing attacks.
     */
    function safeEqual(bytes32 a, bytes32 b) internal pure returns (bool) {
        return a == b;
    }
}
