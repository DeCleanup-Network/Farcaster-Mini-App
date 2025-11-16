// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RecyclablesReward
 * @notice Handle recyclables submissions and cRECY token rewards
 * @dev Manages 5000 cRECY token reserve, distributes 10 cRECY per submission
 */
contract RecyclablesReward is Ownable, ReentrancyGuard {
    // cRECY Token address (Celo)
    address public constant CRECY_TOKEN = 0x34C11A932853Ae24E845Ad4B633E3cEf91afE583;
    
    // Reserve amount: 5000 cRECY tokens
    uint256 public constant RESERVE_AMOUNT = 5_000 * 10**18;
    
    // Reward per submission: 10 cRECY
    uint256 public constant REWARD_AMOUNT = 10 * 10**18;
    
    // Distributed amount
    uint256 public distributedAmount;
    
    // Verifier allowlist (multiple verifiers can verify)
    mapping(address => bool) public verifiers;
    
    // Recyclables submissions
    struct RecyclablesSubmission {
        address user;
        string photoHash; // IPFS hash of recyclables photo
        string receiptHash; // IPFS hash of receipt (optional)
        uint256 timestamp;
        bool verified;
        bool rewarded;
    }
    
    mapping(uint256 => RecyclablesSubmission) public submissions;
    uint256 public submissionCounter;
    
    // User tracking
    mapping(address => uint256) public userRecyclablesCount;
    
    // Events
    event RecyclablesSubmitted(uint256 indexed submissionId, address indexed user, uint256 timestamp);
    event RecyclablesVerified(uint256 indexed submissionId, address indexed user);
    event RewardDistributed(uint256 indexed submissionId, address indexed user, uint256 amount);
    event ReserveFinished();
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);
    
    /**
     * @notice Constructor
     * @param _initialVerifiers Array of initial verifier addresses
     */
    constructor(address[] memory _initialVerifiers) Ownable(msg.sender) {
        // Add initial verifiers to allowlist
        for (uint256 i = 0; i < _initialVerifiers.length; i++) {
            require(_initialVerifiers[i] != address(0), "Invalid verifier address");
            verifiers[_initialVerifiers[i]] = true;
            emit VerifierAdded(_initialVerifiers[i]);
        }
        submissionCounter = 1; // Start from submissionId 1
    }
    
    /**
     * @notice Fund the reserve with cRECY tokens (only owner)
     * @dev Owner must approve this contract to spend cRECY tokens, then call this function
     * @param amount Amount to fund (should be at least 5000 cRECY)
     */
    function fundReserve(uint256 amount) external onlyOwner {
        require(amount >= RESERVE_AMOUNT, "Amount must be at least 5000 cRECY");
        require(distributedAmount == 0, "Reserve already funded");
        
        // Transfer cRECY tokens from owner to contract
        require(IERC20(CRECY_TOKEN).transferFrom(msg.sender, address(this), amount), "Transfer failed");
    }
    
    /**
     * @notice Submit recyclables proof
     * @param photoHash IPFS hash of recyclables photo
     * @param receiptHash IPFS hash of receipt (optional, can be empty)
     * @return submissionId The submission ID
     */
    function submitRecyclables(
        string memory photoHash,
        string memory receiptHash
    ) external nonReentrant returns (uint256) {
        require(bytes(photoHash).length > 0, "Photo hash required");
        require(msg.sender != address(0), "Invalid address");
        require(checkReserveAvailable(), "Reserve finished");
        
        uint256 submissionId = submissionCounter;
        submissionCounter++;
        
        submissions[submissionId] = RecyclablesSubmission({
            user: msg.sender,
            photoHash: photoHash,
            receiptHash: receiptHash,
            timestamp: block.timestamp,
            verified: false,
            rewarded: false
        });
        
        emit RecyclablesSubmitted(submissionId, msg.sender, block.timestamp);
        
        return submissionId;
    }
    
    /**
     * @notice Verify recyclables submission (only verifier)
     * @param submissionId Submission ID
     */
    function verifySubmission(uint256 submissionId) external {
        require(verifiers[msg.sender] || msg.sender == owner(), "Not authorized");
        
        RecyclablesSubmission storage submission = submissions[submissionId];
        require(submission.user != address(0), "Submission does not exist");
        require(!submission.verified, "Already verified");
        require(checkReserveAvailable(), "Reserve finished");
        
        submission.verified = true;
        
        emit RecyclablesVerified(submissionId, submission.user);
    }
    
    /**
     * @notice Distribute reward (only verifier or owner)
     * @param submissionId Submission ID
     */
    function distributeReward(uint256 submissionId) external nonReentrant {
        require(verifiers[msg.sender] || msg.sender == owner(), "Not authorized");
        
        RecyclablesSubmission storage submission = submissions[submissionId];
        require(submission.user != address(0), "Submission does not exist");
        require(submission.verified, "Not verified");
        require(!submission.rewarded, "Already rewarded");
        require(checkReserveAvailable(), "Reserve finished");
        
        // Check if we have enough in reserve
        require(distributedAmount + REWARD_AMOUNT <= RESERVE_AMOUNT, "Insufficient reserve");
        
        // Check if contract has enough cRECY balance
        require(IERC20(CRECY_TOKEN).balanceOf(address(this)) >= REWARD_AMOUNT, "Insufficient contract balance");
        
        // Mark as rewarded
        submission.rewarded = true;
        
        // Update distributed amount
        distributedAmount += REWARD_AMOUNT;
        
        // Update user count
        userRecyclablesCount[submission.user]++;
        
        // Transfer cRECY tokens to user
        require(IERC20(CRECY_TOKEN).transfer(submission.user, REWARD_AMOUNT), "Transfer failed");
        
        emit RewardDistributed(submissionId, submission.user, REWARD_AMOUNT);
        
        // Check if reserve is finished
        if (distributedAmount >= RESERVE_AMOUNT) {
            emit ReserveFinished();
        }
    }
    
    /**
     * @notice Check if reserve is available
     * @return True if reserve is available
     */
    function checkReserveAvailable() public view returns (bool) {
        return distributedAmount < RESERVE_AMOUNT;
    }
    
    /**
     * @notice Get remaining reserve amount
     * @return Remaining amount in cRECY tokens
     */
    function getRemainingReserve() external view returns (uint256) {
        if (distributedAmount >= RESERVE_AMOUNT) {
            return 0;
        }
        return RESERVE_AMOUNT - distributedAmount;
    }
    
    /**
     * @notice Get submission details
     * @param submissionId Submission ID
     * @return Submission details
     */
    function getSubmission(uint256 submissionId) external view returns (RecyclablesSubmission memory) {
        return submissions[submissionId];
    }
    
    /**
     * @notice Get user's recyclables count
     * @param user User address
     * @return Count of recyclables submissions
     */
    function getUserRecyclablesCount(address user) external view returns (uint256) {
        return userRecyclablesCount[user];
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
     * @notice Withdraw remaining cRECY tokens (only owner, after reserve is finished)
     * @param amount Amount to withdraw
     */
    function withdrawRemainingTokens(uint256 amount) external onlyOwner {
        require(distributedAmount >= RESERVE_AMOUNT, "Reserve not finished");
        IERC20(CRECY_TOKEN).transfer(owner(), amount);
    }
    
    /**
     * @notice Emergency withdraw (only owner)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        IERC20(CRECY_TOKEN).transfer(owner(), amount);
    }
}

