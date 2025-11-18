// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title RewardDistributorV2
 * @notice Central contract for distributing DCU points (upgradeable)
 * @dev Handles level rewards, streak rewards, referral rewards, and impact form rewards
 * 
 * IMPORTANT: Currently uses points system. DCU token contract will be integrated soon.
 * When DCU token is deployed, points will be migrated to actual tokens via migratePointsToToken().
 * 
 * This contract is upgradeable using UUPS pattern to allow:
 * - Adding DCU token integration without redeployment
 * - Fixing bugs and adding features
 * - Migrating from points to token system seamlessly
 */
contract RewardDistributorV2 is OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    // Reward amounts (in points, 18 decimals for consistency with ERC20)
    uint256 public constant LEVEL_REWARD = 10 * 10**18; // 10 points per level
    uint256 public constant STREAK_REWARD = 2 * 10**18; // 2 points per week
    uint256 public constant REFERRAL_REWARD = 3 * 10**18; // 3 points for both referrer and referee
    uint256 public constant IMPACT_FORM_REWARD = 5 * 10**18; // 5 points per enhanced form
    
    // Impact Product NFT contract
    address public impactProductNFT;
    
    // DCU Token contract address (will be set after token deployment)
    // TODO: Replace with actual DCU token contract address after TGE
    address public dcuToken;
    bool public tokenMigrationEnabled;
    
    // Verifier allowlist (multiple verifiers can distribute rewards)
    mapping(address => bool) public verifiers;
    
    // Points tracking (user => points balance)
    // NOTE: These points will be migrated to DCU tokens after token deployment
    mapping(address => uint256) public pointsBalance;
    
    // Total points distributed
    uint256 public totalPointsDistributed;
    
    // Migration tracking (user => has migrated points to tokens)
    mapping(address => bool) public hasMigrated;
    
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
    event DCUTokenSet(address indexed tokenAddress);
    event TokenMigrationEnabled(bool enabled);
    event PointsMigrated(address indexed user, uint256 pointsAmount, uint256 tokenAmount);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @notice Initialize the contract (replaces constructor for upgradeable contracts)
     * @param _impactProductNFT Impact Product NFT contract address
     * @param _initialVerifiers Array of initial verifier addresses
     */
    function initialize(
        address _impactProductNFT,
        address[] memory _initialVerifiers
    ) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        require(_impactProductNFT != address(0), "Invalid Impact Product NFT address");
        
        // Add initial verifiers to allowlist
        for (uint256 i = 0; i < _initialVerifiers.length; i++) {
            require(_initialVerifiers[i] != address(0), "Invalid verifier address");
            verifiers[_initialVerifiers[i]] = true;
            emit VerifierAdded(_initialVerifiers[i]);
        }
        
        impactProductNFT = _impactProductNFT;
        dcuToken = address(0); // Will be set after token deployment
        tokenMigrationEnabled = false;
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
    
    /**
     * @notice Get user's points balance
     * @param user User address
     * @return Points balance
     */
    function getPointsBalance(address user) external view returns (uint256) {
        return pointsBalance[user];
    }
    
    // ============ DCU Token Migration Functions ============
    
    /**
     * @notice Set DCU token contract address (only owner)
     * @dev Call this after DCU token is deployed to enable migration
     * @param _dcuToken DCU token contract address
     */
    function setDCUToken(address _dcuToken) external onlyOwner {
        require(_dcuToken != address(0), "Invalid token address");
        dcuToken = _dcuToken;
        emit DCUTokenSet(_dcuToken);
    }
    
    /**
     * @notice Enable/disable token migration (only owner)
     * @param _enabled Whether migration is enabled
     */
    function setTokenMigrationEnabled(bool _enabled) external onlyOwner {
        require(dcuToken != address(0), "DCU token not set");
        tokenMigrationEnabled = _enabled;
        emit TokenMigrationEnabled(_enabled);
    }
    
    /**
     * @notice Migrate user's points to DCU tokens (1:1 conversion)
     * @dev Users can migrate their points to actual DCU tokens after token deployment
     * @return tokenAmount Amount of tokens received
     */
    function migratePointsToToken() external nonReentrant returns (uint256) {
        require(tokenMigrationEnabled, "Migration not enabled");
        require(dcuToken != address(0), "DCU token not set");
        require(!hasMigrated[msg.sender], "Already migrated");
        require(pointsBalance[msg.sender] > 0, "No points to migrate");
        
        uint256 pointsAmount = pointsBalance[msg.sender];
        
        // Mark as migrated and clear points
        hasMigrated[msg.sender] = true;
        pointsBalance[msg.sender] = 0;
        
        // Transfer tokens (1:1 conversion)
        // NOTE: Contract must have sufficient DCU token balance
        IERC20(dcuToken).transfer(msg.sender, pointsAmount);
        
        emit PointsMigrated(msg.sender, pointsAmount, pointsAmount);
        
        return pointsAmount;
    }
    
    /**
     * @notice Get user's DCU token balance (if migrated) or points balance
     * @param user User address
     * @return balance Balance in tokens (if migrated) or points (if not migrated)
     * @return isTokenBalance True if balance is in tokens, false if in points
     */
    function getDCUBalance(address user) external view returns (uint256 balance, bool isTokenBalance) {
        if (hasMigrated[user] && dcuToken != address(0)) {
            balance = IERC20(dcuToken).balanceOf(user);
            isTokenBalance = true;
        } else {
            balance = pointsBalance[user];
            isTokenBalance = false;
        }
    }
    
    // ============ Admin Functions ============
    
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
     * @notice Authorize upgrade (only owner)
     * @dev Required by UUPS pattern
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

