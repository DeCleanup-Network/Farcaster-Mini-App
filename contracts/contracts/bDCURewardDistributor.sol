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
    uint256 public constant VERIFIER_REWARD = 1 * 10**18;     // 1 $bDCU per verification (approved or rejected)
    
    // Authorized contracts
    address public impactProductNFT;
    address public verificationContract;
    mapping(address => bool) public verifiers;
    
    // Distribution tracking
    mapping(address => uint256) public totalDistributed; // user => total tokens received
    uint256 public globalTotalDistributed;
    
    // Streak tracking
    mapping(address => uint256) public streakCount; // user => current streak count (in weeks)
    mapping(address => uint256) public lastCleanupTimestamp; // user => timestamp of last cleanup that counted for streak
    uint256 public constant STREAK_WINDOW = 7 days; // Streak must be maintained within 7 days
    
    // Referral tracking - prevent duplicate referral rewards
    mapping(address => bool) public hasReceivedReferralReward; // referee => whether they've received referral reward
    
    // Events
    event LevelRewardDistributed(address indexed user, uint256 amount);
    event StreakRewardDistributed(address indexed user, uint256 amount);
    event ReferralRewardDistributed(address indexed referrer, address indexed referee, uint256 amount);
    event ImpactFormRewardDistributed(address indexed user, uint256 cleanupId, uint256 amount);
    event VerifierRewardDistributed(address indexed verifier, uint256 cleanupId, uint256 amount);
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
     * Updates streak count and distributes reward if streak is maintained
     * 
     * Streak logic:
     * - First cleanup: Start streak at 1, no reward (this is the first cleanup)
     * - Next cleanup within 7 days: Increment streak, give 2 $bDCU reward
     * - Cleanup after 7+ days: Reset streak to 1, no reward (streak broken, starting new)
     * 
     * @param user User address to receive tokens
     */
    function distributeStreakReward(address user) external whenNotPaused nonReentrant {
        require(_isAuthorizedCaller(), "Not authorized");
        require(user != address(0), "Invalid address");
        
        uint256 currentTime = block.timestamp;
        uint256 lastCleanup = lastCleanupTimestamp[user];
        
        // Check if user has an active streak (last cleanup within STREAK_WINDOW)
        // For first cleanup, lastCleanup will be 0, so this will be false
        bool hasActiveStreak = lastCleanup > 0 && (currentTime - lastCleanup) <= STREAK_WINDOW;
        
        if (hasActiveStreak) {
            // User maintained streak - increment count and distribute reward
            streakCount[user] += 1;
            lastCleanupTimestamp[user] = currentTime;
            
            uint256 contractBalance = bDCUToken.balanceOf(address(this));
            require(contractBalance >= STREAK_REWARD, "Insufficient token balance");
            
            require(bDCUToken.transfer(user, STREAK_REWARD), "Transfer failed");
            
            totalDistributed[user] += STREAK_REWARD;
            globalTotalDistributed += STREAK_REWARD;
            
            emit StreakRewardDistributed(user, STREAK_REWARD);
        } else {
            // User is starting a new streak (first cleanup or streak was broken)
            // Reset streak to 1 for the current cleanup
            streakCount[user] = 1;
            lastCleanupTimestamp[user] = currentTime;
            
            // No streak reward for first cleanup or when streak is broken
            // User still gets level reward (10 $bDCU) from ImpactProductNFT
        }
    }
    
    /**
     * @notice Get user's current streak count
     * @param user User address
     * @return Current streak count (in weeks)
     */
    function getStreakCount(address user) external view returns (uint256) {
        // Check if streak is still active
        uint256 currentTime = block.timestamp;
        uint256 lastCleanup = lastCleanupTimestamp[user];
        
        if (lastCleanup == 0) {
            return 0; // No streak started
        }
        
        // If streak is broken (outside window), return 0
        if ((currentTime - lastCleanup) > STREAK_WINDOW) {
            return 0;
        }
        
        return streakCount[user];
    }
    
    /**
     * @notice Check if user has an active streak
     * @param user User address
     * @return True if user has an active streak (last cleanup within STREAK_WINDOW)
     */
    function hasActiveStreak(address user) external view returns (bool) {
        uint256 currentTime = block.timestamp;
        uint256 lastCleanup = lastCleanupTimestamp[user];
        
        if (lastCleanup == 0) {
            return false; // No streak started
        }
        
        // Streak is active if last cleanup was within STREAK_WINDOW
        return (currentTime - lastCleanup) <= STREAK_WINDOW;
    }
    
    /**
     * @notice Distribute referral reward (3 $bDCU to both referrer and referee)
     * @dev Can only be called once per referee - prevents duplicate referral rewards
     * @param referrerAddress Referrer address
     * @param refereeAddress Referee address (must be first-time user)
     */
    function distributeReferralReward(address referrerAddress, address refereeAddress) external whenNotPaused nonReentrant {
        require(_isAuthorizedCaller(), "Not authorized");
        require(referrerAddress != address(0) && refereeAddress != address(0), "Invalid address");
        require(referrerAddress != refereeAddress, "Cannot refer yourself");
        
        // IMPORTANT: Referee can only receive referral reward ONCE (on their first submission)
        // This prevents users from getting multiple referral rewards by using different referral links
        require(!hasReceivedReferralReward[refereeAddress], "Referee has already received referral reward");
        
        // Mark referee as having received referral reward (prevents future rewards)
        hasReceivedReferralReward[refereeAddress] = true;
        
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
     * @notice Distribute verifier reward (1 $bDCU)
     * Called by VerificationContract when verifier approves or rejects a cleanup
     * @param verifierAddress Verifier address to receive tokens
     * @param cleanupId Cleanup ID that was verified/rejected
     */
    function distributeVerifierReward(address verifierAddress, uint256 cleanupId) external whenNotPaused nonReentrant {
        require(msg.sender == verificationContract, "Not authorized");
        require(verifierAddress != address(0), "Invalid address");
        
        uint256 contractBalance = bDCUToken.balanceOf(address(this));
        require(contractBalance >= VERIFIER_REWARD, "Insufficient token balance");
        
        require(bDCUToken.transfer(verifierAddress, VERIFIER_REWARD), "Transfer failed");
        
        totalDistributed[verifierAddress] += VERIFIER_REWARD;
        globalTotalDistributed += VERIFIER_REWARD;
        
        emit VerifierRewardDistributed(verifierAddress, cleanupId, VERIFIER_REWARD);
    }
    
    /**
     * @notice Deposit tokens to contract (owner only)
     * Use this to fund the contract with tokens from dev buy
     * Requires approval from token holder first
     * @param amount Amount of tokens to deposit
     */
    function depositTokens(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(bDCUToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit TokensDeposited(amount);
    }
    
    /**
     * @notice Receive tokens directly (anyone can call)
     * Multisig can use this to transfer tokens directly to the contract
     * This is the preferred method for multisig deposits (no approval needed)
     * Multisig should call: token.transfer(rewardDistributorAddress, amount)
     * The tokens will automatically be received by this contract
     */
    // ERC20 tokens sent directly to this contract will be received automatically
    // No special function needed - just transfer tokens to this contract address
    
    /**
     * @notice Deposit tokens from multisig or any address
     * Alternative to direct transfer - allows depositing on behalf of another address
     * Requires approval from token holder first
     * @param from Address to transfer tokens from (must have approved this contract)
     * @param amount Amount of tokens to deposit
     */
    function depositTokensFrom(address from, uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(bDCUToken.transferFrom(from, address(this), amount), "Transfer failed");
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

