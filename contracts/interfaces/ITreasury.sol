// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITreasury {
    function allocateBTSH(address to, uint256 amount, string calldata reason) external;
    function allocateETH(address payable to, uint256 amount, string calldata reason) external;
    function btshBalance() external view returns (uint256);
}
