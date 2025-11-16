// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RewardDistributor
 * @notice Central contract for distributing DCU points
 * @dev Handles level rewards, streak rewards, referral rewards, and impact form rewards
 */
contract RewardDistributor is Ownable, ReentrancyGuard {
    // Reward amounts (in points, 18 decimals for consistency)
    uint256 public constant LEVEL_REWARD = 10 * 10**18; // 10 points per level
    uint256 public constant STREAK_REWARD = 2 * 10**18; // 2 points per week
    uint256 public constant REFERRAL_REWARD = 3 * 10**18; // 3 points for both referrer and referee
    uint256 public constant IMPACT_FORM_REWARD = 5 * 10**18; // 5 points per enhanced form
    
    // Impact Product NFT contract
    address public impactProductNFT;
    
    // Verifier allowlist (multiple verifiers can distribute rewards)
    mapping(address => bool) public verifiers;
    
    // Points tracking (user => points balance)
    mapping(address => uint256) public pointsBalance;
    
    // Total points distributed
    uint256 public totalPointsDistributed;
    
    // Streak tracking
    mapping(address => uint256) public lastCleanupTimestamp;
    mapping(address => uint256) public streakCount;
    
    // Referral tracking
    mapping(address => address) public referrer; // referee => referrer
    mapping(address => uint256) public referralCount; // referrer => count
    mapping(address => bool) public hasClaimedReferral; // referee => has claimed
    
    // Impact form tracking
    mapping(address => mapping(uint256 => bool)) public hasClaimedImpactForm; // user => cleanupId => claimed
    
    // Events
    event LevelRewardDistributed(address indexed user, uint256 amount);
    event StreakRewardDistributed(address indexed user, uint256 amount);
    event ReferralRewardDistributed(address indexed referrer, address indexed referee, uint256 amount);
    event ImpactFormRewardDistributed(address indexed user, uint256 cleanupId, uint256 amount);
    event ReferrerSet(address indexed referee, address indexed referrer);
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);
    
    /**
     * @notice Constructor
     * @param _impactProductNFT Impact Product NFT contract address
     * @param _initialVerifiers Array of initial verifier addresses
     */
    constructor(
        address _impactProductNFT,
        address[] memory _initialVerifiers
    ) Ownable(msg.sender) {
        require(_impactProductNFT != address(0), "Invalid Impact Product NFT address");
        
        // Add initial verifiers to allowlist
        for (uint256 i = 0; i < _initialVerifiers.length; i++) {
            require(_initialVerifiers[i] != address(0), "Invalid verifier address");
            verifiers[_initialVerifiers[i]] = true;
            emit VerifierAdded(_initialVerifiers[i]);
        }
        
        impactProductNFT = _impactProductNFT;
    }
    
    /**
     * @notice Distribute level reward (10 points)
     * @param user User address
     */
    function distributeLevelReward(address user) external {
        require(msg.sender == impactProductNFT, "Not authorized");
        require(user != address(0), "Invalid address");
        
        pointsBalance[user] += LEVEL_REWARD;
        totalPointsDistributed += LEVEL_REWARD;
        
        emit LevelRewardDistributed(user, LEVEL_REWARD);
    }
    
    /**
     * @notice Distribute streak reward (2 points per week)
     * @param user User address
     */
    function distributeStreakReward(address user) external {
        require(verifiers[msg.sender] || msg.sender == owner(), "Not authorized");
        require(user != address(0), "Invalid address");
        
        uint256 lastCleanup = lastCleanupTimestamp[user];
        uint256 currentTime = block.timestamp;
        
        // Check if user submitted cleanup within last 7 days
        if (lastCleanup > 0 && currentTime - lastCleanup <= 7 days) {
            streakCount[user]++;
            pointsBalance[user] += STREAK_REWARD;
            totalPointsDistributed += STREAK_REWARD;
            emit StreakRewardDistributed(user, STREAK_REWARD);
        } else {
            // Reset streak if more than 7 days (spec says "reset on miss")
            streakCount[user] = 0;
        }
        
        // Update last cleanup timestamp
        lastCleanupTimestamp[user] = currentTime;
    }
    
    /**
     * @notice Distribute referral reward (3 points to both referrer and referee)
     * @param referrerAddress Referrer address
     * @param refereeAddress Referee address
     */
    function distributeReferralReward(address referrerAddress, address refereeAddress) external {
        require(verifiers[msg.sender] || msg.sender == owner(), "Not authorized");
        require(referrerAddress != address(0), "Invalid referrer address");
        require(refereeAddress != address(0), "Invalid referee address");
        require(referrer[refereeAddress] == referrerAddress, "Invalid referral relationship");
        require(!hasClaimedReferral[refereeAddress], "Referral already claimed");
        
        // Mark as claimed
        hasClaimedReferral[refereeAddress] = true;
        
        // Distribute to both referrer and referee
        pointsBalance[referrerAddress] += REFERRAL_REWARD;
        pointsBalance[refereeAddress] += REFERRAL_REWARD;
        totalPointsDistributed += REFERRAL_REWARD * 2;
        
        // Update referral count
        referralCount[referrerAddress]++;
        
        emit ReferralRewardDistributed(referrerAddress, refereeAddress, REFERRAL_REWARD);
    }
    
    /**
     * @notice Distribute impact form reward (5 points)
     * @param user User address
     * @param cleanupId Cleanup ID
     */
    function distributeImpactFormReward(address user, uint256 cleanupId) external {
        require(verifiers[msg.sender] || msg.sender == owner(), "Not authorized");
        require(user != address(0), "Invalid address");
        require(!hasClaimedImpactForm[user][cleanupId], "Impact form reward already claimed");
        
        // Mark as claimed
        hasClaimedImpactForm[user][cleanupId] = true;
        
        pointsBalance[user] += IMPACT_FORM_REWARD;
        totalPointsDistributed += IMPACT_FORM_REWARD;
        
        emit ImpactFormRewardDistributed(user, cleanupId, IMPACT_FORM_REWARD);
    }
    
    /**
     * @notice Set referrer for a user (only verifier or owner)
     * @param refereeAddress Referee address
     * @param referrerAddress Referrer address
     */
    function setReferrer(address refereeAddress, address referrerAddress) external {
        require(verifiers[msg.sender] || msg.sender == owner(), "Not authorized");
        require(refereeAddress != address(0), "Invalid referee address");
        require(referrerAddress != address(0), "Invalid referrer address");
        require(refereeAddress != referrerAddress, "Cannot refer yourself");
        require(referrer[refereeAddress] == address(0), "Referrer already set");
        
        referrer[refereeAddress] = referrerAddress;
        
        emit ReferrerSet(refereeAddress, referrerAddress);
    }
    
    /**
     * @notice Get user's streak count
     * @param user User address
     * @return Streak count
     */
    function getStreakCount(address user) external view returns (uint256) {
        return streakCount[user];
    }
    
    /**
     * @notice Get user's referral count
     * @param user User address
     * @return Referral count
     */
    function getReferralCount(address user) external view returns (uint256) {
        return referralCount[user];
    }
    
    /**
     * @notice Check if user has active streak
     * @param user User address
     * @return True if user has active streak (submitted within last 7 days)
     */
    function hasActiveStreak(address user) external view returns (bool) {
        uint256 lastCleanup = lastCleanupTimestamp[user];
        if (lastCleanup == 0) {
            return false;
        }
        return block.timestamp - lastCleanup <= 7 days;
    }
    
    // Admin functions
    
    /**
     * @notice Add verifier to allowlist (only owner)
     */
    function addVerifier(address _verifier) external onlyOwner {
        require(_verifier != address(0), "Invalid address");
        require(!verifiers[_verifier], "Verifier already added");
        verifiers[_verifier] = true;
        emit VerifierAdded(_verifier);
    }
    
    /**
     * @notice Remove verifier from allowlist (only owner)
     */
    function removeVerifier(address _verifier) external onlyOwner {
        require(verifiers[_verifier], "Verifier not in allowlist");
        verifiers[_verifier] = false;
        emit VerifierRemoved(_verifier);
    }
    
    /**
     * @notice Check if address is a verifier
     */
    function isVerifier(address _address) external view returns (bool) {
        return verifiers[_address];
    }
    
    /**
     * @notice Set Impact Product NFT address (only owner)
     */
    function setImpactProductNFT(address _impactProductNFT) external onlyOwner {
        require(_impactProductNFT != address(0), "Invalid address");
        impactProductNFT = _impactProductNFT;
    }
    
    /**
     * @notice Update last cleanup timestamp (only verifier or owner)
     * @param user User address
     * @param timestamp Timestamp
     */
    function updateLastCleanupTimestamp(address user, uint256 timestamp) external {
        require(verifiers[msg.sender] || msg.sender == owner(), "Not authorized");
        lastCleanupTimestamp[user] = timestamp;
    }
    
    /**
     * @notice Get user's points balance
     * @param user User address
     * @return Points balance
     */
    function getPointsBalance(address user) external view returns (uint256) {
        return pointsBalance[user];
    }
}

