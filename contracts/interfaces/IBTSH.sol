// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBTSH is IERC20 {
    function MAX_SUPPLY() external view returns (uint256);
    function minted() external view returns (bool);
    function mintInitial(address treasury, uint256 amount) external;
    function pause() external;
    function unpause() external;
}
