// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";

/**
 * @title BTSH — BITESHA Token
 * @notice Fixed-supply ERC-20 with on-chain vote delegation (ERC20Votes).
 *         Genesis mint only. No inflation. Pausable by owner (should be transferred to DAO).
 */
contract BTSH is ERC20, ERC20Permit, ERC20Votes, Ownable, Pausable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18; // 1 billion BTSH

    bool public minted = false;

    event InitialMint(address indexed treasury, uint256 amount);

    constructor(address initialOwner)
        ERC20("BITESHA", "BTSH")
        ERC20Permit("BITESHA")
        Ownable(initialOwner)
    {}

    /**
     * @notice One-time genesis mint to the treasury. Cannot be called again.
     * @param treasury  Address that receives the full supply (must be the multisig treasury).
     * @param amount    Must not exceed MAX_SUPPLY.
     */
    function mintInitial(address treasury, uint256 amount) external onlyOwner {
        require(!minted, "BTSH: already minted");
        require(amount <= MAX_SUPPLY, "BTSH: exceeds max supply");
        require(treasury != address(0), "BTSH: zero address");

        minted = true;
        _mint(treasury, amount);

        emit InitialMint(treasury, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ── Required overrides ─────────────────────────────────────────────────

    // ERC20Votes and Pausable both hook into _update; cover both parents.
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
        whenNotPaused
    {
        super._update(from, to, value);
    }

    // ERC20Permit and ERC20Votes both inherit Nonces which exposes nonces().
    // Override is required to resolve the ambiguity.
    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
