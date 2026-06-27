// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Security
 * @notice Common security helpers used across BITESHA contracts.
 */
library Security {
    /**
     * @notice Verify a keyed hash (keccak256 with a secret key).
     *
     *         WARNING — this is NOT HMAC-SHA256. It is a keyed keccak256 digest:
     *             keccak256(abi.encode(secret, payload))
     *         Using abi.encode (not abi.encodePacked) avoids length-extension
     *         attacks that would affect a raw concatenation.
     *
     *         Do NOT use this where HMAC-SHA256 interoperability is required
     *         (e.g., verifying GitHub webhook signatures which use real HMAC).
     *         For those cases, verify off-chain and submit only the result on-chain.
     *
     * @param payload   Raw payload bytes to authenticate.
     * @param signature Expected keyed digest (32 bytes).
     * @param secret    Shared secret key (bytes32).
     */
    function verifyKeyedHash(
        bytes memory payload,
        bytes32 signature,
        bytes32 secret
    ) internal pure returns (bool) {
        bytes32 computed = keccak256(abi.encode(secret, payload));
        return computed == signature;
    }

    /**
     * @notice Prevent calls from contracts (EOA-only guard).
     *         NOTE: not foolproof — a contract can call from its constructor
     *         (code.length == 0 at construction time). Use with care and
     *         only as an additional layer, never as a sole security measure.
     */
    function requireEOA(address account) internal view {
        require(account.code.length == 0, "Security: contracts not allowed");
    }

    /**
     * @notice Constant-time bytes32 comparison.
     *         In the EVM, == on bytes32 is already branch-free, so this is
     *         equivalent to a direct == but documents the intent explicitly.
     */
    function safeEqual(bytes32 a, bytes32 b) internal pure returns (bool) {
        return a == b;
    }
}
