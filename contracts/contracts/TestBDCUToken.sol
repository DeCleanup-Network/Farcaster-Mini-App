// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TestBDCUToken
 * @notice Simple ERC20 test token for Base Sepolia testing
 * @dev This is a test token only - not for production use
 * 
 * Features:
 * - 100 billion total supply (matching Clanker token structure)
 * - Mintable by owner (for testing purposes)
 * - 18 decimals (standard ERC20)
 */
contract TestBDCUToken is ERC20, Ownable {
    uint256 public constant TOTAL_SUPPLY = 100_000_000_000 * 10**18; // 100 billion tokens
    
    constructor() ERC20("bDCU", "bDCU") Ownable(msg.sender) {
        // Mint total supply to deployer
        _mint(msg.sender, TOTAL_SUPPLY);
    }
    
    /**
     * @notice Mint additional tokens (for testing only)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @notice Burn tokens
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}

