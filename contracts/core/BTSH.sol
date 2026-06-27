// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BTSH — BITESHA Token
 * @notice Fixed-supply ERC-20. Genesis mint only. No inflation.
 */
contract BTSH is ERC20, ERC20Permit, Ownable, Pausable {
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

    function _update(address from, address to, uint256 value) internal override whenNotPaused {
        super._update(from, to, value);
    }
}
