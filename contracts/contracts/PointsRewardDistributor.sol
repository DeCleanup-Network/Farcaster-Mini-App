// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title PointsRewardDistributor
 * @notice Tracks DCU points and handles token claims based on points balance
 */
contract PointsRewardDistributor is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    IERC20 public bDCUToken;
    
    uint256 public LEVEL_POINTS;
    uint256 public STREAK_POINTS;
    uint256 public REFERRAL_POINTS;
    uint256 public IMPACT_FORM_POINTS;
    uint256 public VERIFIER_POINTS;
    
    uint256 public targetRewardValueUSD;
    uint256 public constant TARGET_REWARD_VALUE_MIN = 40;
    uint256 public constant TARGET_REWARD_VALUE_MAX = 60;
    
    uint256 public currentTokenPriceUSD; // 8 decimals
    
    mapping(address => uint256) public pointsBalance;
    mapping(address => uint256) public pointsClaimed;
    uint256 public globalTotalPoints;
    
    mapping(address => uint256) public stakedBalance;
    mapping(address => bool) public isVerifier;
    mapping(address => bool) public manuallyAddedVerifiers;
    uint256 public constant MINIMUM_LEVEL_FOR_STAKING = 3;
    uint256 public constant MINIMUM_POINTS_TO_CLAIM = 30; // Minimum DCU points (level 3 = 30) required to claim
    
    address public impactProductNFT;
    address public verificationContract;
    
    mapping(address => uint256) public streakCount;
    mapping(address => uint256) public lastCleanupTimestamp;
    uint256 public constant STREAK_WINDOW = 7 days;
    
    mapping(address => bool) public hasReceivedReferralReward;
    
    // Events
    event PointsAwarded(address indexed user, uint256 points, string rewardType);
    event TokensClaimed(address indexed user, uint256 pointsUsed, uint256 tokensReceived);
    event TokensStaked(address indexed user, uint256 amount);
    event TokensUnstaked(address indexed user, uint256 amount);
    event VerifierStatusChanged(address indexed user, bool isVerifier);
    event TokenPriceUpdated(uint256 newPrice);
    event TargetRewardValueUpdated(uint256 newValue);
    event TokensDeposited(uint256 amount);
    event TokensWithdrawn(uint256 amount);
    event ImpactProductNFTUpdated(address indexed newAddress);
    event VerificationContractUpdated(address indexed newAddress);
    event PointsMultiplierUpdated(string multiplierType, uint256 newValue);
    event VerifierManuallyAdded(address indexed verifier);
    event VerifierManuallyRemoved(address indexed verifier);
    event VerifierSlashed(address indexed verifier);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(address _bDCUToken, uint256 _initialTokenPrice) public initializer {
        require(_bDCUToken != address(0), "Invalid token address");
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();
        bDCUToken = IERC20(_bDCUToken);
        currentTokenPriceUSD = _initialTokenPrice;
        LEVEL_POINTS = 10;
        STREAK_POINTS = 1;
        REFERRAL_POINTS = 3;
        IMPACT_FORM_POINTS = 3;
        VERIFIER_POINTS = 1;
        targetRewardValueUSD = 50;
    }
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    uint256[50] private __gap;
    
    function awardLevelPoints(address user) external whenNotPaused nonReentrant {
        require(msg.sender == impactProductNFT, "Not authorized");
        require(user != address(0), "Invalid address");
        
        pointsBalance[user] += LEVEL_POINTS;
        globalTotalPoints += LEVEL_POINTS;
        
        emit PointsAwarded(user, LEVEL_POINTS, "level");
    }
    
    function awardStreakPoints(address user) external whenNotPaused nonReentrant {
        require(_isAuthorizedCaller(), "Not authorized");
        require(user != address(0), "Invalid address");
        
        uint256 currentTime = block.timestamp;
        uint256 lastCleanup = lastCleanupTimestamp[user];
        
        bool userHasActiveStreak = lastCleanup > 0 && (currentTime - lastCleanup) <= STREAK_WINDOW;
        
        if (userHasActiveStreak) {
            streakCount[user] += 1;
            lastCleanupTimestamp[user] = currentTime;
            pointsBalance[user] += STREAK_POINTS;
            globalTotalPoints += STREAK_POINTS;
            emit PointsAwarded(user, STREAK_POINTS, "streak");
        } else {
            streakCount[user] = 1;
            lastCleanupTimestamp[user] = currentTime;
        }
    }
    
    function getStreakCount(address user) external view returns (uint256) {
        uint256 currentTime = block.timestamp;
        uint256 lastCleanup = lastCleanupTimestamp[user];
        
        if (lastCleanup == 0 || (currentTime - lastCleanup) > STREAK_WINDOW) {
            return 0;
        }
        
        return streakCount[user];
    }
    
    function hasActiveStreak(address user) external view returns (bool) {
        uint256 lastCleanup = lastCleanupTimestamp[user];
        if (lastCleanup == 0) return false;
        return (block.timestamp - lastCleanup) <= STREAK_WINDOW;
    }
    
    function awardReferralPoints(address referrerAddress, address refereeAddress) external whenNotPaused nonReentrant {
        require(_isAuthorizedCaller(), "Not authorized");
        require(referrerAddress != address(0) && refereeAddress != address(0), "Invalid address");
        require(referrerAddress != refereeAddress, "Cannot refer yourself");
        require(!hasReceivedReferralReward[refereeAddress], "Referee has already received referral reward");
        
        hasReceivedReferralReward[refereeAddress] = true;
        
        pointsBalance[referrerAddress] += REFERRAL_POINTS;
        pointsBalance[refereeAddress] += REFERRAL_POINTS;
        globalTotalPoints += REFERRAL_POINTS * 2;
        
        emit PointsAwarded(referrerAddress, REFERRAL_POINTS, "referral");
        emit PointsAwarded(refereeAddress, REFERRAL_POINTS, "referral");
    }
    
    function awardImpactFormPoints(address user, uint256 cleanupId) external whenNotPaused nonReentrant {
        require(_isAuthorizedCaller(), "Not authorized");
        require(user != address(0), "Invalid address");
        
        pointsBalance[user] += IMPACT_FORM_POINTS;
        globalTotalPoints += IMPACT_FORM_POINTS;
        
        emit PointsAwarded(user, IMPACT_FORM_POINTS, "impact_form");
    }
    
    /**
     * @notice Batch claim rewards in one call (streak + referral + impact form). Level is awarded by ImpactProductNFT.
     * @dev Only VerificationContract. Reduces claim gas by replacing 3 external calls with 1.
     */
    function awardClaimRewards(address user, address referrer, uint256 cleanupId, bool hasImpactForm) external whenNotPaused nonReentrant {
        require(msg.sender == verificationContract, "Not authorized");
        require(user != address(0), "Invalid address");
        
        uint256 currentTime = block.timestamp;
        uint256 lastCleanup = lastCleanupTimestamp[user];
        bool userHasActiveStreak = lastCleanup > 0 && (currentTime - lastCleanup) <= STREAK_WINDOW;
        if (userHasActiveStreak) {
            streakCount[user] += 1;
            lastCleanupTimestamp[user] = currentTime;
            pointsBalance[user] += STREAK_POINTS;
            globalTotalPoints += STREAK_POINTS;
            emit PointsAwarded(user, STREAK_POINTS, "streak");
        } else {
            streakCount[user] = 1;
            lastCleanupTimestamp[user] = currentTime;
        }
        
        if (referrer != address(0) && referrer != user && !hasReceivedReferralReward[user]) {
            hasReceivedReferralReward[user] = true;
            pointsBalance[referrer] += REFERRAL_POINTS;
            pointsBalance[user] += REFERRAL_POINTS;
            globalTotalPoints += REFERRAL_POINTS * 2;
            emit PointsAwarded(referrer, REFERRAL_POINTS, "referral");
            emit PointsAwarded(user, REFERRAL_POINTS, "referral");
        }
        
        if (hasImpactForm) {
            pointsBalance[user] += IMPACT_FORM_POINTS;
            globalTotalPoints += IMPACT_FORM_POINTS;
            emit PointsAwarded(user, IMPACT_FORM_POINTS, "impact_form");
        }
    }
    
    function awardVerifierPoints(address verifierAddress, uint256 cleanupId) external whenNotPaused nonReentrant {
        require(msg.sender == verificationContract, "Not authorized");
        require(verifierAddress != address(0), "Invalid address");
        
        pointsBalance[verifierAddress] += VERIFIER_POINTS;
        globalTotalPoints += VERIFIER_POINTS;
        
        emit PointsAwarded(verifierAddress, VERIFIER_POINTS, "verifier");
    }
    
    function claimTokens(uint256 pointsToClaim) external whenNotPaused nonReentrant returns (uint256 tokensReceived) {
        require(pointsToClaim >= MINIMUM_POINTS_TO_CLAIM, "Must claim at least 30 DCU points");
        require(pointsBalance[msg.sender] >= pointsToClaim, "Insufficient points");
        require(currentTokenPriceUSD > 0, "Token price not set");
        require(_hasMinimumLevel(msg.sender), "Must reach minimum level to claim tokens");
        
        uint256 usdValueCents = (pointsToClaim * targetRewardValueUSD) / LEVEL_POINTS;
        uint256 usdValueDollars = (usdValueCents * 1e18) / 100;
        uint256 tokensToReceive = (usdValueDollars * 1e8) / currentTokenPriceUSD;
        
        require(tokensToReceive > 0, "Claim amount too small");
        
        uint256 contractBalance = bDCUToken.balanceOf(address(this));
        require(contractBalance >= tokensToReceive, "Insufficient token balance in contract");
        
        pointsBalance[msg.sender] -= pointsToClaim;
        pointsClaimed[msg.sender] += pointsToClaim;
        
        require(bDCUToken.transfer(msg.sender, tokensToReceive), "Transfer failed");
        
        emit TokensClaimed(msg.sender, pointsToClaim, tokensToReceive);
        
        return tokensToReceive;
    }
    
    function calculateClaimAmount(uint256 points) external view returns (uint256 tokens) {
        if (points == 0 || currentTokenPriceUSD == 0) {
            return 0;
        }
        
        uint256 usdValueCents = (points * targetRewardValueUSD) / LEVEL_POINTS;
        uint256 usdValueDollars = (usdValueCents * 1e18) / 100;
        uint256 tokensToReceive = (usdValueDollars * 1e8) / currentTokenPriceUSD;
        
        return tokensToReceive;
    }
    
    function stakeTokens(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(_hasMinimumLevel(msg.sender), "Must reach minimum level to stake tokens");
        
        uint256 userBalance = bDCUToken.balanceOf(msg.sender);
        
        // If not already a verifier and not manually added, must stake at least 51% of current balance
        if (!isVerifier[msg.sender] && !manuallyAddedVerifiers[msg.sender]) {
            require(amount >= (userBalance * 51) / 100, "Must stake at least 51% of your available tokens to become a verifier");
        }
        
        require(bDCUToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        stakedBalance[msg.sender] += amount;
        
        // Become verifier if: manually added OR (has minimum level AND staked >= 51%)
        if (!isVerifier[msg.sender]) {
            if (manuallyAddedVerifiers[msg.sender] || (_hasMinimumLevel(msg.sender) && amount >= (userBalance * 51) / 100)) {
                isVerifier[msg.sender] = true;
                emit VerifierStatusChanged(msg.sender, true);
            }
        }
        
        emit TokensStaked(msg.sender, amount);
    }
    
    function unstakeTokens(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(stakedBalance[msg.sender] >= amount, "Insufficient staked balance");
        
        uint256 balanceBefore = stakedBalance[msg.sender];
        stakedBalance[msg.sender] -= amount;
        uint256 balanceAfter = stakedBalance[msg.sender];
        
        if (isVerifier[msg.sender] && !manuallyAddedVerifiers[msg.sender] && balanceAfter < balanceBefore / 2) {
            isVerifier[msg.sender] = false;
            emit VerifierStatusChanged(msg.sender, false);
        }
        
        require(bDCUToken.transfer(msg.sender, amount), "Transfer failed");
        
        emit TokensUnstaked(msg.sender, amount);
    }
    
    function updateTokenPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Price must be greater than 0");
        currentTokenPriceUSD = newPrice;
        emit TokenPriceUpdated(newPrice);
    }
    
    function updateTargetRewardValue(uint256 newValue) external onlyOwner {
        require(newValue >= TARGET_REWARD_VALUE_MIN && newValue <= TARGET_REWARD_VALUE_MAX, "Value out of range");
        targetRewardValueUSD = newValue;
        emit TargetRewardValueUpdated(newValue);
    }
    
    function _hasMinimumLevel(address user) internal view returns (bool) {
        if (impactProductNFT == address(0)) {
            return false;
        }
        
        (bool success, bytes memory data) = impactProductNFT.staticcall(
            abi.encodeWithSignature("userCurrentLevel(address)", user)
        );
        
        if (!success || data.length == 0) {
            return false;
        }
        
        uint8 level = abi.decode(data, (uint8));
        return level >= MINIMUM_LEVEL_FOR_STAKING;
    }
    
    function depositTokens(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(bDCUToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit TokensDeposited(amount);
    }
    
    function getContractBalance() external view returns (uint256) {
        return bDCUToken.balanceOf(address(this));
    }
    
    function getPointsBalance(address user) external view returns (uint256) {
        return pointsBalance[user];
    }
    
    function getPointsClaimed(address user) external view returns (uint256) {
        return pointsClaimed[user];
    }
    
    function getMinimumLevelForStaking() external pure returns (uint256) {
        return MINIMUM_LEVEL_FOR_STAKING;
    }
    
    function hasMinimumLevel(address user) external view returns (bool) {
        return _hasMinimumLevel(user);
    }
    
    function setImpactProductNFT(address _address) external onlyOwner {
        require(_address != address(0), "Invalid address");
        impactProductNFT = _address;
        emit ImpactProductNFTUpdated(_address);
    }
    
    function setVerificationContract(address _address) external onlyOwner {
        require(_address != address(0), "Invalid address");
        verificationContract = _address;
        emit VerificationContractUpdated(_address);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function _isAuthorizedCaller() internal view returns (bool) {
        return isVerifier[msg.sender] || manuallyAddedVerifiers[msg.sender] || msg.sender == owner() || msg.sender == verificationContract;
    }
    
    function checkIsVerifier(address _address) external view returns (bool) {
        return isVerifier[_address] || manuallyAddedVerifiers[_address];
    }
    
    function manualAwardPoints(address user, uint256 points) external onlyOwner {
        require(user != address(0), "Invalid address");
        require(points > 0, "Points must be greater than 0");
        
        pointsBalance[user] += points;
        globalTotalPoints += points;
        
        emit PointsAwarded(user, points, "manual");
    }
    
    function addVerifier(address verifierAddress) external onlyOwner {
        require(verifierAddress != address(0), "Invalid address");
        require(!manuallyAddedVerifiers[verifierAddress], "Already a manual verifier");
        
        manuallyAddedVerifiers[verifierAddress] = true;
        if (!isVerifier[verifierAddress]) {
            isVerifier[verifierAddress] = true;
            emit VerifierStatusChanged(verifierAddress, true);
        }
        emit VerifierManuallyAdded(verifierAddress);
    }
    
    function removeVerifier(address verifierAddress) external onlyOwner {
        require(verifierAddress != address(0), "Invalid address");
        require(manuallyAddedVerifiers[verifierAddress], "Not a manual verifier");
        
        manuallyAddedVerifiers[verifierAddress] = false;
        
        if (isVerifier[verifierAddress] && stakedBalance[verifierAddress] == 0) {
            isVerifier[verifierAddress] = false;
            emit VerifierStatusChanged(verifierAddress, false);
        }
        emit VerifierManuallyRemoved(verifierAddress);
    }
    
    /**
     * @notice Slash verifier (owner only)
     * Removes verifier status even if they have staked tokens
     * Use this if a verifier misbehaves (e.g., incorrectly rejects good submissions)
     * @param verifierAddress Address of verifier to slash
     */
    function slashVerifier(address verifierAddress) external onlyOwner {
        require(verifierAddress != address(0), "Invalid address");
        require(isVerifier[verifierAddress], "Not a verifier");
        
        manuallyAddedVerifiers[verifierAddress] = false;
        isVerifier[verifierAddress] = false;
        
        emit VerifierStatusChanged(verifierAddress, false);
        emit VerifierSlashed(verifierAddress);
    }
    
    function updatePointMultipliers(
        uint256 _levelPoints,
        uint256 _streakPoints,
        uint256 _referralPoints,
        uint256 _impactFormPoints,
        uint256 _verifierPoints
    ) external onlyOwner {
        require(_levelPoints > 0, "Level points must be greater than 0");
        require(_streakPoints > 0, "Streak points must be greater than 0");
        require(_referralPoints > 0, "Referral points must be greater than 0");
        require(_impactFormPoints > 0, "Impact form points must be greater than 0");
        require(_verifierPoints > 0, "Verifier points must be greater than 0");
        
        LEVEL_POINTS = _levelPoints;
        STREAK_POINTS = _streakPoints;
        REFERRAL_POINTS = _referralPoints;
        IMPACT_FORM_POINTS = _impactFormPoints;
        VERIFIER_POINTS = _verifierPoints;
        
        emit PointsMultiplierUpdated("level", _levelPoints);
        emit PointsMultiplierUpdated("streak", _streakPoints);
        emit PointsMultiplierUpdated("referral", _referralPoints);
        emit PointsMultiplierUpdated("impactForm", _impactFormPoints);
        emit PointsMultiplierUpdated("verifier", _verifierPoints);
    }
    
    function withdrawTokens(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        uint256 contractBalance = bDCUToken.balanceOf(address(this));
        require(contractBalance >= amount, "Insufficient balance");
        require(bDCUToken.transfer(owner(), amount), "Transfer failed");
        emit TokensWithdrawn(amount);
    }
    
}

