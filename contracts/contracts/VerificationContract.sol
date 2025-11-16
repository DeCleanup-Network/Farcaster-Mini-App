// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ImpactProductNFT.sol";
import "./RewardDistributor.sol";

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
    }
    
    // Cleanup submissions mapping
    mapping(uint256 => CleanupSubmission) public cleanups;
    
    // Cleanup counter
    uint256 public cleanupCounter;
    
    // Verifier allowlist (multiple verifiers can verify)
    mapping(address => bool) public verifiers;
    
    // Impact Product NFT contract
    ImpactProductNFT public impactProductNFT;
    
    // Reward Distributor contract
    RewardDistributor public rewardDistributor;
    
    // Optional submission fee (can be disabled by setting to 0)
    uint256 public submissionFee;
    bool public feeEnabled;
    
    // Events
    event CleanupSubmitted(uint256 indexed cleanupId, address indexed user, uint256 timestamp);
    event CleanupVerified(uint256 indexed cleanupId, address indexed user, uint8 level);
    event CleanupRejected(uint256 indexed cleanupId, address indexed user);
    event ImpactProductClaimed(uint256 indexed cleanupId, address indexed user, uint8 level);
    event SubmissionFeeUpdated(uint256 newFee, bool enabled);
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
        bool _feeEnabled
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
        rewardDistributor = RewardDistributor(_rewardDistributor);
        submissionFee = _submissionFee;
        feeEnabled = _feeEnabled;
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
     * @return cleanupId The cleanup ID
     */
    function submitCleanup(
        string memory beforePhotoHash,
        string memory afterPhotoHash,
        uint256 latitude,
        uint256 longitude,
        address referrerAddress,
        bool hasImpactForm
    ) external payable nonReentrant returns (uint256) {
        require(bytes(beforePhotoHash).length > 0, "Before photo hash required");
        require(bytes(afterPhotoHash).length > 0, "After photo hash required");
        require(msg.sender != address(0), "Invalid address");
        
        // Check and collect submission fee if enabled
        if (feeEnabled && submissionFee > 0) {
            require(msg.value >= submissionFee, "Insufficient fee");
            // Fee is automatically sent to contract, owner can withdraw
        }
        
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
            referrer: referrerAddress,
            hasImpactForm: hasImpactForm
        });
        
        // Set referrer if provided
        if (referrerAddress != address(0) && referrerAddress != msg.sender) {
            rewardDistributor.setReferrer(msg.sender, referrerAddress);
        }
        
        emit CleanupSubmitted(cleanupId, msg.sender, block.timestamp);
        
        return cleanupId;
    }
    
    /**
     * @notice Verify cleanup (only verifier)
     * @param cleanupId Cleanup ID
     * @param level Level to assign (1-10)
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
        
        // Distribute rewards
        address user = cleanup.user;
        
        // Distribute streak reward if applicable
        rewardDistributor.distributeStreakReward(user);
        
        // Distribute referral reward if applicable
        if (cleanup.referrer != address(0)) {
            rewardDistributor.distributeReferralReward(cleanup.referrer, user);
        }
        
        // Distribute impact form reward if applicable
        if (cleanup.hasImpactForm) {
            rewardDistributor.distributeImpactFormReward(user, cleanupId);
        }
        
        emit CleanupVerified(cleanupId, user, level);
    }
    
    /**
     * @notice Reject cleanup (only verifier)
     * @param cleanupId Cleanup ID
     */
    function rejectCleanup(uint256 cleanupId) external {
        require(verifiers[msg.sender] || msg.sender == owner(), "Not authorized");
        
        CleanupSubmission storage cleanup = cleanups[cleanupId];
        require(cleanup.user != address(0), "Cleanup does not exist");
        require(!cleanup.verified, "Cleanup already verified");
        require(!cleanup.rejected, "Cleanup already rejected");
        
        cleanup.rejected = true;
        
        emit CleanupRejected(cleanupId, cleanup.user);
    }
    
    /**
     * @notice Claim Impact Product after verification
     * @param cleanupId Cleanup ID
     */
    function claimImpactProduct(uint256 cleanupId) external nonReentrant {
        CleanupSubmission storage cleanup = cleanups[cleanupId];
        require(cleanup.user != address(0), "Cleanup does not exist");
        require(cleanup.user == msg.sender, "Not your cleanup");
        require(cleanup.verified, "Cleanup not verified");
        require(!cleanup.claimed, "Already claimed");
        
        cleanup.claimed = true;
        
        // Claim Impact Product level for the user (this will also distribute 10 DCU reward)
        // Pass the user address so the NFT is minted/updated for the correct user
        impactProductNFT.claimLevelForUser(cleanup.user, cleanupId, cleanup.level);
        
        emit ImpactProductClaimed(cleanupId, cleanup.user, cleanup.level);
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
        rewardDistributor = RewardDistributor(_rewardDistributor);
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

