// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./ImpactProductNFT.sol"; // This includes IRewardDistributor interface

/**
 * @title VerificationContract
 * @notice Handle cleanup verification and Impact Product claims
 * @dev Team-only verification for MVP, will add community verification later
 */
contract VerificationContract is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, UUPSUpgradeable {
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
    
    // Fee treasury address (if set, fees go here instead of owner)
    address public feeTreasury;
    
    // Events
    event CleanupSubmitted(uint256 indexed cleanupId, address indexed user, uint256 timestamp);
    event CleanupVerified(uint256 indexed cleanupId, address indexed user, uint8 level);
    event CleanupRejected(uint256 indexed cleanupId, address indexed user);
    event ImpactProductClaimed(uint256 indexed cleanupId, address indexed user, uint8 level);
    event SubmissionFeeUpdated(uint256 newFee, bool enabled);
    event ClaimFeeUpdated(uint256 newFee, bool enabled);
    event FeeTreasuryUpdated(address indexed newTreasury);
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    function initialize(
        address[] memory _initialVerifiers,
        address _impactProductNFT,
        address _rewardDistributor,
        uint256 _submissionFee,
        bool _feeEnabled,
        uint256 _claimFee,
        bool _claimFeeEnabled
    ) public initializer {
        require(_impactProductNFT != address(0), "Invalid Impact Product NFT address");
        require(_rewardDistributor != address(0), "Invalid Reward Distributor address");
        
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();
        
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
        cleanupCounter = 1;
    }
    
    uint256[50] private __gap;
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Submit cleanup
     * @param beforePhotoHash IPFS hash of before photo
     * @param afterPhotoHash IPFS hash of after photo
     * @param latitude Latitude (scaled by 1e6)
     * @param longitude Longitude (scaled by 1e6)
     * @param referrerAddress Referrer address (optional, can be address(0))
     * @param hasImpactForm Whether enhanced impact form was filled (app always passes false; impact report removed from app flow)
     * @param impactReportHash IPFS hash of enhanced impact report (app always passes ""; impact report removed from app flow)
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
    ) external payable whenNotPaused nonReentrant returns (uint256) {
        require(bytes(beforePhotoHash).length > 0, "Before photo hash required");
        require(bytes(afterPhotoHash).length > 0, "After photo hash required");
        require(msg.sender != address(0), "Invalid address");
        
        // Check and collect submission fee if enabled
        if (feeEnabled && submissionFee > 0) {
            require(msg.value >= submissionFee, "Insufficient fee");
            // Fees accumulate; owner/treasury withdraw via withdrawFees() to save gas
        }
        
        // IMPORTANT: Referral is only valid for the user's FIRST submission AND if they haven't received a referral reward yet
        // Check both conditions to prevent duplicate referral rewards
        address validReferrer = address(0);
        bool hasReceivedReferral = false;
        // Check if user has received referral reward (try new system first, fallback to old)
        try IPointsRewardDistributor(rewardDistributor).hasReceivedReferralReward(msg.sender) returns (bool result) {
            hasReceivedReferral = result;
        } catch {
            try IRewardDistributor(rewardDistributor).hasReceivedReferralReward(msg.sender) returns (bool result) {
                hasReceivedReferral = result;
            } catch {
                // If check fails, assume false and let awardReferralPoints handle it
            hasReceivedReferral = false;
            }
        }
        
        // Only set referrer if:
        // 1. User hasn't received a referral reward yet
        // 2. Referrer address is valid and not self
        // Note: Rejected cleanups don't prevent referral rewards - only verified cleanups do
        if (!hasReceivedReferral && referrerAddress != address(0) && referrerAddress != msg.sender) {
            validReferrer = referrerAddress;
        }
        
        // Mark user as having submitted (for tracking, but doesn't prevent referral if rejected)
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
    function verifyCleanup(uint256 cleanupId, uint8 level) external whenNotPaused {
        require(verifiers[msg.sender] || msg.sender == owner(), "Not authorized");
        require(level >= 1 && level <= 10, "Invalid level");
        
        CleanupSubmission storage cleanup = cleanups[cleanupId];
        require(cleanup.user != address(0), "Cleanup does not exist");
        require(!cleanup.verified, "Cleanup already verified");
        require(!cleanup.rejected, "Cleanup was rejected");
        
        cleanup.verified = true;
        cleanup.level = level;
        
        // Mark user as having a verified cleanup (prevents future referral rewards)
        // This is set on verification, not submission, so rejected cleanups don't prevent referral rewards
        hasSubmittedCleanup[cleanup.user] = true;
        
        // Distribute verifier reward (1 $bDCU) - verifier gets reward immediately
        // User rewards are distributed when user claims their Impact Product
        // Award verifier points (try new system first, fallback to old)
        try IPointsRewardDistributor(rewardDistributor).awardVerifierPoints(msg.sender, cleanupId) {} catch {
        try IRewardDistributor(rewardDistributor).distributeVerifierReward(msg.sender, cleanupId) {} catch {}
        }
        
        emit CleanupVerified(cleanupId, cleanup.user, level);
    }
    
    /**
     * @notice Reject cleanup (only verifier)
     * @param cleanupId Cleanup ID
     * @dev Verifier gets reward even for rejections (1 $bDCU)
     */
    function rejectCleanup(uint256 cleanupId) external whenNotPaused {
        require(verifiers[msg.sender] || msg.sender == owner(), "Not authorized");
        
        CleanupSubmission storage cleanup = cleanups[cleanupId];
        require(cleanup.user != address(0), "Cleanup does not exist");
        require(!cleanup.verified, "Cleanup already verified");
        require(!cleanup.rejected, "Cleanup already rejected");
        
        cleanup.rejected = true;
        
        // Distribute verifier reward (1 $bDCU) - verifier gets reward for rejections too
        // Award verifier points (try new system first, fallback to old)
        try IPointsRewardDistributor(rewardDistributor).awardVerifierPoints(msg.sender, cleanupId) {} catch {
        try IRewardDistributor(rewardDistributor).distributeVerifierReward(msg.sender, cleanupId) {} catch {}
        }
        
        emit CleanupRejected(cleanupId, cleanup.user);
    }
    
    /**
     * @notice Claim Impact Product after verification
     * @param cleanupId Cleanup ID
     * @dev All rewards (referral, streak, impact form) are distributed here, not on verification
     */
    function claimImpactProduct(uint256 cleanupId) external payable whenNotPaused nonReentrant {
        CleanupSubmission storage cleanup = cleanups[cleanupId];
        require(cleanup.user != address(0), "Cleanup does not exist");
        require(cleanup.user == msg.sender, "Not your cleanup");
        require(cleanup.verified, "Cleanup not verified");
        require(!cleanup.claimed, "Already claimed");
        
        // Check and collect claim fee if enabled
        if (claimFeeEnabled && claimFee > 0) {
            require(msg.value >= claimFee, "Insufficient claim fee");
            // Fees accumulate; owner/treasury withdraw via withdrawFees() to save gas
        }
        
        cleanup.claimed = true;
        
        address user = cleanup.user;
        
        // Single batched reward call (streak + referral + impact form + level) to save gas
        try IPointsRewardDistributor(rewardDistributor).awardClaimRewards(user, cleanup.referrer, cleanupId, cleanup.hasImpactForm) {} catch {
            try IRewardDistributor(rewardDistributor).distributeStreakReward(user) {} catch {}
            if (cleanup.referrer != address(0)) {
                try IRewardDistributor(rewardDistributor).distributeReferralReward(cleanup.referrer, user) {} catch {}
            }
            if (cleanup.hasImpactForm) {
                try IRewardDistributor(rewardDistributor).distributeImpactFormReward(user, cleanupId) {} catch {}
            }
        }
        
        // Claim Impact Product level (mint/update NFT only; level points already in awardClaimRewards)
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
     * @notice Set fee treasury address (only owner)
     * @param _feeTreasury Address where fees should be sent (set to address(0) to send to owner)
     */
    function setFeeTreasury(address _feeTreasury) external onlyOwner {
        feeTreasury = _feeTreasury;
        emit FeeTreasuryUpdated(_feeTreasury);
    }
    
    /**
     * @notice Withdraw collected fees (only owner)
     * Fees go to feeTreasury if set, otherwise to owner
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        address recipient = feeTreasury != address(0) ? feeTreasury : owner();
        (bool ok, ) = payable(recipient).call{value: balance}("");
        require(ok, "Transfer failed");
    }

    /**
     * @notice Withdraw collected fees to a specific address (only owner)
     * Use this to refund a user: send the contract's fee balance to their address in one tx.
     * @param recipient Address to receive the ETH (e.g. the user to refund)
     */
    function withdrawFeesTo(address payable recipient) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        (bool ok, ) = recipient.call{value: balance}("");
        require(ok, "Transfer failed");
    }

    /**
     * @notice Internal function to automatically withdraw fees to treasury if set
     */
    function _withdrawFeesIfNeeded() internal {
        if (feeTreasury != address(0)) {
            uint256 balance = address(this).balance;
            if (balance > 0) {
                (bool ok, ) = payable(feeTreasury).call{value: balance}("");
                require(ok, "Transfer failed");
            }
        }
    }
    
    /**
     * @notice Slash verifier (owner only)
     * Removes verifier status from this contract
     * Use this if a verifier incorrectly rejects good submissions
     * Note: This only removes from VerificationContract verifier list
     * To remove from PointsRewardDistributor, use that contract's removeVerifier function
     * @param verifierAddress Address of verifier to slash
     */
    function slashVerifier(address verifierAddress) external onlyOwner {
        require(verifierAddress != address(0), "Invalid address");
        require(verifiers[verifierAddress], "Not a verifier");
        
        verifiers[verifierAddress] = false;
        emit VerifierRemoved(verifierAddress);
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
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

