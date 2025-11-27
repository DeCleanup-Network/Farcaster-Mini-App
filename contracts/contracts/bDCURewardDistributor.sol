// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title bDCURewardDistributor
 * @notice Central contract for automatically distributing $bDCU tokens to users
 * @dev Holds $bDCU tokens (from Clanker) and distributes them automatically when users perform actions
 * 
 * Reward Structure:
 * - Level Reward: 10 $bDCU per Impact Product level claimed
 * - Streak Reward: 2 $bDCU per week streak maintained
 * - Referral Reward: 3 $bDCU to both referrer and referee
 * - Impact Form Reward: 5 $bDCU per enhanced impact form submitted
 * 
 * Distribution: Automatic (no claim function needed)
 * Funding: Contract must be funded with $bDCU tokens from dev buy
 */
contract bDCURewardDistributor is Ownable, ReentrancyGuard, Pausable {
    // $bDCU Token contract (from Clanker)
    IERC20 public bDCUToken;
    
    // Reward amounts (in tokens, 18 decimals)
    uint256 public constant LEVEL_REWARD = 10 * 10**18;      // 10 $bDCU per level
    uint256 public constant STREAK_REWARD = 2 * 10**18;      // 2 $bDCU per week streak
    uint256 public constant REFERRAL_REWARD = 3 * 10**18;     // 3 $bDCU for both referrer and referee
    uint256 public constant IMPACT_FORM_REWARD = 5 * 10**18; // 5 $bDCU per enhanced form
    
    // Authorized contracts
    address public impactProductNFT;
    address public verificationContract;
    mapping(address => bool) public verifiers;
    
    // Distribution tracking
    mapping(address => uint256) public totalDistributed; // user => total tokens received
    uint256 public globalTotalDistributed;
    
    // Events
    event LevelRewardDistributed(address indexed user, uint256 amount);
    event StreakRewardDistributed(address indexed user, uint256 amount);
    event ReferralRewardDistributed(address indexed referrer, address indexed referee, uint256 amount);
    event ImpactFormRewardDistributed(address indexed user, uint256 cleanupId, uint256 amount);
    event TokensDeposited(uint256 amount);
    event TokensWithdrawn(uint256 amount);
    event ImpactProductNFTUpdated(address indexed newAddress);
    event VerificationContractUpdated(address indexed newAddress);
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);
    
    /**
     * @notice Constructor
     * @param _bDCUToken Address of $bDCU token contract (from Clanker)
     */
    constructor(address _bDCUToken) Ownable(msg.sender) {
        require(_bDCUToken != address(0), "Invalid token address");
        bDCUToken = IERC20(_bDCUToken);
    }
    
    /**
     * @notice Distribute level reward (10 $bDCU)
     * Called by ImpactProductNFT when user claims a level
     * @param user User address to receive tokens
     */
    function distributeLevelReward(address user) external whenNotPaused nonReentrant {
        require(msg.sender == impactProductNFT, "Not authorized");
        require(user != address(0), "Invalid address");
        
        uint256 contractBalance = bDCUToken.balanceOf(address(this));
        require(contractBalance >= LEVEL_REWARD, "Insufficient token balance");
        
        require(bDCUToken.transfer(user, LEVEL_REWARD), "Transfer failed");
        
        totalDistributed[user] += LEVEL_REWARD;
        globalTotalDistributed += LEVEL_REWARD;
        
        emit LevelRewardDistributed(user, LEVEL_REWARD);
    }
    
    /**
     * @notice Distribute streak reward (2 $bDCU)
     * Called by VerificationContract when user maintains streak
     * @param user User address to receive tokens
     */
    function distributeStreakReward(address user) external whenNotPaused nonReentrant {
        require(_isAuthorizedCaller(), "Not authorized");
        require(user != address(0), "Invalid address");
        
        uint256 contractBalance = bDCUToken.balanceOf(address(this));
        require(contractBalance >= STREAK_REWARD, "Insufficient token balance");
        
        require(bDCUToken.transfer(user, STREAK_REWARD), "Transfer failed");
        
        totalDistributed[user] += STREAK_REWARD;
        globalTotalDistributed += STREAK_REWARD;
        
        emit StreakRewardDistributed(user, STREAK_REWARD);
    }
    
    /**
     * @notice Distribute referral reward (3 $bDCU to both referrer and referee)
     * @param referrerAddress Referrer address
     * @param refereeAddress Referee address
     */
    function distributeReferralReward(address referrerAddress, address refereeAddress) external whenNotPaused nonReentrant {
        require(_isAuthorizedCaller(), "Not authorized");
        require(referrerAddress != address(0) && refereeAddress != address(0), "Invalid address");
        require(referrerAddress != refereeAddress, "Cannot refer yourself");
        
        uint256 totalNeeded = REFERRAL_REWARD * 2;
        uint256 contractBalance = bDCUToken.balanceOf(address(this));
        require(contractBalance >= totalNeeded, "Insufficient token balance");
        
        require(bDCUToken.transfer(referrerAddress, REFERRAL_REWARD), "Transfer failed");
        require(bDCUToken.transfer(refereeAddress, REFERRAL_REWARD), "Transfer failed");
        
        totalDistributed[referrerAddress] += REFERRAL_REWARD;
        totalDistributed[refereeAddress] += REFERRAL_REWARD;
        globalTotalDistributed += totalNeeded;
        
        emit ReferralRewardDistributed(referrerAddress, refereeAddress, REFERRAL_REWARD);
    }
    
    /**
     * @notice Distribute impact form reward (5 $bDCU)
     * @param user User address to receive tokens
     * @param cleanupId Cleanup ID associated with the impact form
     */
    function distributeImpactFormReward(address user, uint256 cleanupId) external whenNotPaused nonReentrant {
        require(_isAuthorizedCaller(), "Not authorized");
        require(user != address(0), "Invalid address");
        
        uint256 contractBalance = bDCUToken.balanceOf(address(this));
        require(contractBalance >= IMPACT_FORM_REWARD, "Insufficient token balance");
        
        require(bDCUToken.transfer(user, IMPACT_FORM_REWARD), "Transfer failed");
        
        totalDistributed[user] += IMPACT_FORM_REWARD;
        globalTotalDistributed += IMPACT_FORM_REWARD;
        
        emit ImpactFormRewardDistributed(user, cleanupId, IMPACT_FORM_REWARD);
    }
    
    /**
     * @notice Deposit tokens to contract (owner only)
     * Use this to fund the contract with tokens from dev buy
     * @param amount Amount of tokens to deposit
     */
    function depositTokens(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(bDCUToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit TokensDeposited(amount);
    }
    
    /**
     * @notice Withdraw tokens from contract (owner only, emergency use)
     * @param amount Amount of tokens to withdraw
     */
    function withdrawTokens(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        uint256 contractBalance = bDCUToken.balanceOf(address(this));
        require(contractBalance >= amount, "Insufficient balance");
        require(bDCUToken.transfer(owner(), amount), "Transfer failed");
        emit TokensWithdrawn(amount);
    }
    
    /**
     * @notice Get contract's token balance
     * @return Current $bDCU token balance in contract
     */
    function getContractBalance() external view returns (uint256) {
        return bDCUToken.balanceOf(address(this));
    }
    
    /**
     * @notice Get total tokens distributed to a user
     * @param user User address
     * @return Total tokens distributed to user
     */
    function getTotalDistributed(address user) external view returns (uint256) {
        return totalDistributed[user];
    }
    
    /**
     * @notice Set Impact Product NFT contract address (owner only)
     * @param _address Impact Product NFT contract address
     */
    function setImpactProductNFT(address _address) external onlyOwner {
        require(_address != address(0), "Invalid address");
        impactProductNFT = _address;
        emit ImpactProductNFTUpdated(_address);
    }
    
    /**
     * @notice Set Verification Contract address (owner only)
     * @param _address Verification Contract address
     */
    function setVerificationContract(address _address) external onlyOwner {
        require(_address != address(0), "Invalid address");
        verificationContract = _address;
        emit VerificationContractUpdated(_address);
    }
    
    /**
     * @notice Add verifier to allowlist (owner only)
     * @param _verifier Verifier address
     */
    function addVerifier(address _verifier) external onlyOwner {
        require(_verifier != address(0), "Invalid address");
        require(!verifiers[_verifier], "Verifier already added");
        verifiers[_verifier] = true;
        emit VerifierAdded(_verifier);
    }
    
    /**
     * @notice Remove verifier from allowlist (owner only)
     * @param _verifier Verifier address
     */
    function removeVerifier(address _verifier) external onlyOwner {
        require(verifiers[_verifier], "Verifier not in allowlist");
        verifiers[_verifier] = false;
        emit VerifierRemoved(_verifier);
    }
    
    /**
     * @notice Pause distributions (owner only, emergency use)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause distributions (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Internal helper to check if caller is authorized
     * @return True if caller is authorized
     */
    function _isAuthorizedCaller() internal view returns (bool) {
        return verifiers[msg.sender] || msg.sender == owner() || msg.sender == verificationContract;
    }
}

