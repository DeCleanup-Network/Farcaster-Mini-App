// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ImpactProductNFT.sol"; // This includes IRewardDistributor interface

/**
 * @title VerificationContract
 * @notice Handle cleanup verification and Impact Product claims
 * @dev Team-only verification for MVP, will add community verification later
 */
contract VerificationContract is Ownable, ReentrancyGuard {
    // Cleanup submission structure
    struct CleanupSubmission {
        address user;
        string beforePhotoHash; // IPFS hash
        string afterPhotoHash; // IPFS hash
        uint256 timestamp;
        uint256 latitude; // Scaled by 1e6
        uint256 longitude; // Scaled by 1e6
        bool verified;
        bool claimed;
        bool rejected; // Whether cleanup was rejected by verifier
        uint8 level; // Level to be claimed (1-10)
        address referrer; // Referrer address (if any)
        bool hasImpactForm; // Whether enhanced impact form was filled
        string impactReportHash; // IPFS hash for enhanced impact report (optional)
    }
    
    // Cleanup submissions mapping
    mapping(uint256 => CleanupSubmission) public cleanups;
    
    // Cleanup counter
    uint256 public cleanupCounter;
    
    // Track if user has ever submitted a cleanup (prevents multiple referral rewards)
    mapping(address => bool) public hasSubmittedCleanup;
    
    // Verifier allowlist (multiple verifiers can verify)
    mapping(address => bool) public verifiers;
    
    // Impact Product NFT contract
    ImpactProductNFT public impactProductNFT;
    
    // Reward Distributor contract (can be RewardDistributor or bDCURewardDistributor)
    address public rewardDistributor;
    
    // Optional submission fee (can be disabled by setting to 0)
    uint256 public submissionFee;
    bool public feeEnabled;
    
    // Optional claim fee (can be disabled by setting to 0)
    // Default: 2 cents USD equivalent in ETH (~7,142,857,142,857 wei at $2,800/ETH)
    uint256 public claimFee;
    bool public claimFeeEnabled;
    
    // Events
    event CleanupSubmitted(uint256 indexed cleanupId, address indexed user, uint256 timestamp);
    event CleanupVerified(uint256 indexed cleanupId, address indexed user, uint8 level);
    event CleanupRejected(uint256 indexed cleanupId, address indexed user);
    event ImpactProductClaimed(uint256 indexed cleanupId, address indexed user, uint8 level);
    event SubmissionFeeUpdated(uint256 newFee, bool enabled);
    event ClaimFeeUpdated(uint256 newFee, bool enabled);
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);
    
    /**
     * @notice Constructor
     * @param _initialVerifiers Array of initial verifier addresses
     * @param _impactProductNFT Impact Product NFT contract address
     * @param _rewardDistributor Reward Distributor contract address
     */
    constructor(
        address[] memory _initialVerifiers,
        address _impactProductNFT,
        address _rewardDistributor,
        uint256 _submissionFee,
        bool _feeEnabled,
        uint256 _claimFee,
        bool _claimFeeEnabled
    ) Ownable(msg.sender) {
        require(_impactProductNFT != address(0), "Invalid Impact Product NFT address");
        require(_rewardDistributor != address(0), "Invalid Reward Distributor address");
        
        // Add initial verifiers to allowlist
        for (uint256 i = 0; i < _initialVerifiers.length; i++) {
            require(_initialVerifiers[i] != address(0), "Invalid verifier address");
            verifiers[_initialVerifiers[i]] = true;
            emit VerifierAdded(_initialVerifiers[i]);
        }
        
        impactProductNFT = ImpactProductNFT(_impactProductNFT);
        rewardDistributor = _rewardDistributor;
        submissionFee = _submissionFee;
        feeEnabled = _feeEnabled;
        claimFee = _claimFee;
        claimFeeEnabled = _claimFeeEnabled;
        cleanupCounter = 1; // Start from cleanupId 1
    }
    
    /**
     * @notice Submit cleanup
     * @param beforePhotoHash IPFS hash of before photo
     * @param afterPhotoHash IPFS hash of after photo
     * @param latitude Latitude (scaled by 1e6)
     * @param longitude Longitude (scaled by 1e6)
     * @param referrerAddress Referrer address (optional, can be address(0))
     * @param hasImpactForm Whether enhanced impact form was filled
     * @param impactReportHash IPFS hash of enhanced impact report (can be empty)
     * @return cleanupId The cleanup ID
     */
    function submitCleanup(
        string memory beforePhotoHash,
        string memory afterPhotoHash,
        uint256 latitude,
        uint256 longitude,
        address referrerAddress,
        bool hasImpactForm,
        string memory impactReportHash
    ) external payable nonReentrant returns (uint256) {
        require(bytes(beforePhotoHash).length > 0, "Before photo hash required");
        require(bytes(afterPhotoHash).length > 0, "After photo hash required");
        require(msg.sender != address(0), "Invalid address");
        
        // Check and collect submission fee if enabled
        if (feeEnabled && submissionFee > 0) {
            require(msg.value >= submissionFee, "Insufficient fee");
            // Fee is automatically sent to contract, owner can withdraw
        }
        
        // IMPORTANT: Referral is only valid for the user's FIRST submission
        // If user has already submitted before, ignore referrer (set to address(0))
        address validReferrer = address(0);
        if (!hasSubmittedCleanup[msg.sender] && referrerAddress != address(0) && referrerAddress != msg.sender) {
            // This is user's first submission and they have a valid referrer
            validReferrer = referrerAddress;
        }
        // If user has already submitted, validReferrer remains address(0) (no referral reward)
        
        // Mark user as having submitted (prevents future referral rewards)
        hasSubmittedCleanup[msg.sender] = true;
        
        uint256 cleanupId = cleanupCounter;
        cleanupCounter++;
        
        cleanups[cleanupId] = CleanupSubmission({
            user: msg.sender,
            beforePhotoHash: beforePhotoHash,
            afterPhotoHash: afterPhotoHash,
            timestamp: block.timestamp,
            latitude: latitude,
            longitude: longitude,
            verified: false,
            claimed: false,
            rejected: false,
            level: 0,
            referrer: validReferrer, // Only set if first submission and valid referrer
            hasImpactForm: hasImpactForm,
            impactReportHash: impactReportHash
        });
        
        // Set referrer if provided (only works with old RewardDistributor, not bDCURewardDistributor)
        // Note: bDCURewardDistributor doesn't have setReferrer, referral is handled in claimImpactProduct
        if (referrerAddress != address(0) && referrerAddress != msg.sender) {
            try IRewardDistributor(rewardDistributor).setReferrer(msg.sender, referrerAddress) {} catch {}
        }
        
        emit CleanupSubmitted(cleanupId, msg.sender, block.timestamp);
        
        return cleanupId;
    }
    
    /**
     * @notice Verify cleanup (only verifier)
     * @param cleanupId Cleanup ID
     * @param level Level to assign (1-10)
     * @dev User rewards are distributed when user claims, but verifier gets reward immediately
     */
    function verifyCleanup(uint256 cleanupId, uint8 level) external {
        require(verifiers[msg.sender] || msg.sender == owner(), "Not authorized");
        require(level >= 1 && level <= 10, "Invalid level");
        
        CleanupSubmission storage cleanup = cleanups[cleanupId];
        require(cleanup.user != address(0), "Cleanup does not exist");
        require(!cleanup.verified, "Cleanup already verified");
        require(!cleanup.rejected, "Cleanup was rejected");
        
        cleanup.verified = true;
        cleanup.level = level;
        
        // Distribute verifier reward (1 $bDCU) - verifier gets reward immediately
        // User rewards are distributed when user claims their Impact Product
        try IRewardDistributor(rewardDistributor).distributeVerifierReward(msg.sender, cleanupId) {} catch {}
        
        emit CleanupVerified(cleanupId, cleanup.user, level);
    }
    
    /**
     * @notice Reject cleanup (only verifier)
     * @param cleanupId Cleanup ID
     * @dev Verifier gets reward even for rejections (1 $bDCU)
     */
    function rejectCleanup(uint256 cleanupId) external {
        require(verifiers[msg.sender] || msg.sender == owner(), "Not authorized");
        
        CleanupSubmission storage cleanup = cleanups[cleanupId];
        require(cleanup.user != address(0), "Cleanup does not exist");
        require(!cleanup.verified, "Cleanup already verified");
        require(!cleanup.rejected, "Cleanup already rejected");
        
        cleanup.rejected = true;
        
        // Distribute verifier reward (1 $bDCU) - verifier gets reward for rejections too
        try IRewardDistributor(rewardDistributor).distributeVerifierReward(msg.sender, cleanupId) {} catch {}
        
        emit CleanupRejected(cleanupId, cleanup.user);
    }
    
    /**
     * @notice Claim Impact Product after verification
     * @param cleanupId Cleanup ID
     * @dev All rewards (referral, streak, impact form) are distributed here, not on verification
     */
    function claimImpactProduct(uint256 cleanupId) external payable nonReentrant {
        CleanupSubmission storage cleanup = cleanups[cleanupId];
        require(cleanup.user != address(0), "Cleanup does not exist");
        require(cleanup.user == msg.sender, "Not your cleanup");
        require(cleanup.verified, "Cleanup not verified");
        require(!cleanup.claimed, "Already claimed");
        
        // Check and collect claim fee if enabled
        if (claimFeeEnabled && claimFee > 0) {
            require(msg.value >= claimFee, "Insufficient claim fee");
            // Fee is automatically sent to contract, owner can withdraw
        }
        
        cleanup.claimed = true;
        
        address user = cleanup.user;
        
        // Distribute all rewards when user claims (not on verification)
        // This ensures users only receive rewards after they claim their Impact Product
        // Note: If rewards were already distributed (e.g., from old contract), they will fail silently
        
        // Distribute streak reward if applicable (may fail if already distributed, that's OK)
        try IRewardDistributor(rewardDistributor).distributeStreakReward(user) {} catch {}
        
        // Distribute referral reward if applicable (only once per user)
        // May fail if already claimed, that's OK - user already got the reward
        if (cleanup.referrer != address(0)) {
            try IRewardDistributor(rewardDistributor).distributeReferralReward(cleanup.referrer, user) {} catch {}
        }
        
        // Distribute impact form reward if applicable
        // May fail if already claimed (e.g., from old contract), that's OK
        if (cleanup.hasImpactForm) {
            try IRewardDistributor(rewardDistributor).distributeImpactFormReward(user, cleanupId) {} catch {}
        }
        
        // Claim Impact Product level for the user (this will also distribute 10 DCU level reward)
        // Pass the user address so the NFT is minted/updated for the correct user
        // This must succeed - if it fails, the whole claim fails
        impactProductNFT.claimLevelForUser(user, cleanupId, cleanup.level);
        
        emit ImpactProductClaimed(cleanupId, user, cleanup.level);
    }
    
    /**
     * @notice Get cleanup status
     * @param cleanupId Cleanup ID
     * @return user User address
     * @return verified Whether cleanup is verified
     * @return claimed Whether Impact Product is claimed
     * @return level Level assigned
     */
    function getCleanupStatus(uint256 cleanupId) external view returns (
        address user,
        bool verified,
        bool claimed,
        uint8 level
    ) {
        CleanupSubmission memory cleanup = cleanups[cleanupId];
        return (cleanup.user, cleanup.verified, cleanup.claimed, cleanup.level);
    }
    
    /**
     * @notice Get cleanup details
     * @param cleanupId Cleanup ID
     * @return Cleanup submission details
     */
    function getCleanup(uint256 cleanupId) external view returns (CleanupSubmission memory) {
        return cleanups[cleanupId];
    }
    
    /**
     * @notice Get impact report hash for a cleanup
     * @param cleanupId Cleanup ID
     * @return impact report IPFS hash (empty if not provided)
     */
    function getImpactReportHash(uint256 cleanupId) external view returns (string memory) {
        return cleanups[cleanupId].impactReportHash;
    }
    
    /**
     * @notice Check if cleanup is rejected
     * @param cleanupId Cleanup ID
     * @return Whether cleanup is rejected
     */
    function isRejected(uint256 cleanupId) external view returns (bool) {
        return cleanups[cleanupId].rejected;
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
        impactProductNFT = ImpactProductNFT(_impactProductNFT);
    }
    
    /**
     * @notice Set Reward Distributor address (only owner)
     */
    function setRewardDistributor(address _rewardDistributor) external onlyOwner {
        require(_rewardDistributor != address(0), "Invalid address");
        rewardDistributor = _rewardDistributor;
    }
    
    /**
     * @notice Set submission fee (only owner)
     * @param _fee Fee amount in wei (set to 0 to disable)
     * @param _enabled Whether fee is enabled
     */
    function setSubmissionFee(uint256 _fee, bool _enabled) external onlyOwner {
        submissionFee = _fee;
        feeEnabled = _enabled;
        emit SubmissionFeeUpdated(_fee, _enabled);
    }
    
    /**
     * @notice Set claim fee (only owner)
     * @param _fee Fee amount in wei (set to 0 to disable)
     * @param _enabled Whether fee is enabled
     */
    function setClaimFee(uint256 _fee, bool _enabled) external onlyOwner {
        claimFee = _fee;
        claimFeeEnabled = _enabled;
        emit ClaimFeeUpdated(_fee, _enabled);
    }
    
    /**
     * @notice Get current claim fee
     */
    function getClaimFee() external view returns (uint256 fee, bool enabled) {
        return (claimFee, claimFeeEnabled);
    }
    
    /**
     * @notice Withdraw collected fees (only owner)
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        payable(owner()).transfer(balance);
    }
    
    /**
     * @notice Get current submission fee
     */
    function getSubmissionFee() external view returns (uint256 fee, bool enabled) {
        return (submissionFee, feeEnabled);
    }
    
    /**
     * @notice Get verifier address (for backward compatibility, returns first verifier if any)
     * @dev This is deprecated, use isVerifier() instead
     */
    function verifier() external view returns (address) {
        // This function is kept for backward compatibility but returns address(0)
        // New code should use isVerifier() to check verifier status
        return address(0);
    }
}

