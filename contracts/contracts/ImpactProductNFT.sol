// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ImpactProductNFT
 * @notice Dynamic NFT contract for Impact Products with 10 levels
 * @dev Each user can have one Impact Product NFT that evolves through 10 levels
 */
contract ImpactProductNFT is ERC721URIStorage, Ownable, ReentrancyGuard {
    // Maximum level (10)
    uint8 public constant MAX_LEVEL = 10;
    
    // Mapping: tokenId => level (1-10)
    mapping(uint256 => uint8) public tokenLevel;
    
    // Mapping: user address => their tokenId
    mapping(address => uint256) public userTokenId;
    
    // Mapping: user address => current level
    mapping(address => uint8) public userCurrentLevel;
    
    // Base URI for IPFS metadata
    string public baseURI;
    
    // Verifier address (team verifier for MVP)
    address public verifier;
    
    // Verification contract address (authorized to call claimLevel)
    address public verificationContract;
    
    // Reward distributor contract
    address public rewardDistributor;
    
    // Token counter
    uint256 private _tokenCounter;
    
    // Events
    event ImpactProductMinted(address indexed user, uint256 indexed tokenId, uint8 level);
    event LevelUpdated(address indexed user, uint256 indexed tokenId, uint8 newLevel);
    event BaseURIUpdated(string newBaseURI);
    event VerifierUpdated(address indexed newVerifier);
    event VerificationContractUpdated(address indexed newVerificationContract);
    event RewardDistributorUpdated(address indexed newRewardDistributor);
    
    /**
     * @notice Constructor
     * @param _name Token name
     * @param _symbol Token symbol
     * @param _baseURI Base URI for IPFS metadata
     * @param _verifier Initial verifier address
     */
    constructor(
        string memory _name,
        string memory _symbol,
        string memory _baseURI,
        address _verifier
    ) ERC721(_name, _symbol) Ownable(msg.sender) {
        baseURI = _baseURI;
        verifier = _verifier;
        verificationContract = address(0); // Will be set after VerificationContract deployment
        _tokenCounter = 1; // Start from tokenId 1
    }
    
    /**
     * @notice Claim Impact Product level for a user (called by VerificationContract)
     * @param user The user address to claim for
     * @param cleanupId The cleanup ID that was verified
     * @param level The level to claim (1-10)
     * @dev Can only be called by VerificationContract or owner
     */
    function claimLevelForUser(address user, uint256 cleanupId, uint8 level) external nonReentrant {
        require(msg.sender == verificationContract || msg.sender == owner(), "Not authorized");
        require(level >= 1 && level <= MAX_LEVEL, "Invalid level");
        require(user != address(0), "Invalid user address");
        uint256 tokenId = userTokenId[user];
        
        // If user doesn't have an NFT yet, mint one
        if (tokenId == 0) {
            tokenId = _tokenCounter;
            _tokenCounter++;
            _mint(user, tokenId);
            userTokenId[user] = tokenId;
            tokenLevel[tokenId] = level;
            userCurrentLevel[user] = level;
            
            // Set token URI based on level
            // Handle trailing slash in baseURI to avoid double slashes
            string memory uriPrefix = baseURI;
            if (bytes(baseURI).length > 0 && keccak256(bytes(baseURI)) != keccak256(bytes("ipfs://")) && !_endsWith(baseURI, "/")) {
                uriPrefix = string(abi.encodePacked(baseURI, "/"));
            }
            string memory tokenURI = string(abi.encodePacked(uriPrefix, "level", _toString(level), ".json"));
            _setTokenURI(tokenId, tokenURI);
            
            emit ImpactProductMinted(user, tokenId, level);
        } else {
            // User already has NFT, update level
            require(level > userCurrentLevel[user], "Level must be higher than current");
            tokenLevel[tokenId] = level;
            userCurrentLevel[user] = level;
            
            // Update token URI
            // Handle trailing slash in baseURI to avoid double slashes
            string memory uriPrefix = baseURI;
            if (bytes(baseURI).length > 0 && keccak256(bytes(baseURI)) != keccak256(bytes("ipfs://")) && !_endsWith(baseURI, "/")) {
                uriPrefix = string(abi.encodePacked(baseURI, "/"));
            }
            string memory tokenURI = string(abi.encodePacked(uriPrefix, "level", _toString(level), ".json"));
            _setTokenURI(tokenId, tokenURI);
            
            emit LevelUpdated(user, tokenId, level);
        }
        
        // Distribute reward (10 DCU) if reward distributor is set
        if (rewardDistributor != address(0)) {
            IRewardDistributor(rewardDistributor).distributeLevelReward(user);
        }
    }
    
    /**
     * @notice Update user level (only verifier)
     * @param user User address
     * @param level New level (1-10)
     */
    function updateLevel(address user, uint8 level) external {
        require(msg.sender == verifier || msg.sender == owner(), "Not authorized");
        require(level >= 1 && level <= MAX_LEVEL, "Invalid level");
        require(user != address(0), "Invalid address");
        
        uint256 tokenId = userTokenId[user];
        require(tokenId != 0, "User has no Impact Product");
        
        tokenLevel[tokenId] = level;
        userCurrentLevel[user] = level;
        
        // Update token URI
        // Handle trailing slash in baseURI to avoid double slashes
        string memory uriPrefix = baseURI;
        if (bytes(baseURI).length > 0 && keccak256(bytes(baseURI)) != keccak256(bytes("ipfs://")) && !_endsWith(baseURI, "/")) {
            uriPrefix = string(abi.encodePacked(baseURI, "/"));
        }
        string memory tokenURI = string(abi.encodePacked(uriPrefix, "level", _toString(level), ".json"));
        _setTokenURI(tokenId, tokenURI);
        
        emit LevelUpdated(user, tokenId, level);
    }
    
    /**
     * @notice Get user's current level
     * @param user User address
     * @return Current level (0 if no NFT)
     */
    function getUserLevel(address user) external view returns (uint8) {
        return userCurrentLevel[user];
    }
    
    /**
     * @notice Get user's token ID
     * @param user User address
     * @return Token ID (0 if no NFT)
     */
    function getUserTokenId(address user) external view returns (uint256) {
        return userTokenId[user];
    }
    
    /**
     * @notice Get token URI for a specific level
     * @param level Level (1-10)
     * @return IPFS URI for that level
     */
    function getTokenURIForLevel(uint8 level) external view returns (string memory) {
        require(level >= 1 && level <= MAX_LEVEL, "Invalid level");
        // Handle trailing slash in baseURI to avoid double slashes
        string memory uriPrefix = baseURI;
        if (bytes(baseURI).length > 0 && keccak256(bytes(baseURI)) != keccak256(bytes("ipfs://")) && !_endsWith(baseURI, "/")) {
            uriPrefix = string(abi.encodePacked(baseURI, "/"));
        }
        return string(abi.encodePacked(uriPrefix, "level", _toString(level), ".json"));
    }
    
    /**
     * @notice Override tokenURI to use level-based URI
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        uint8 level = tokenLevel[tokenId];
        // Handle trailing slash in baseURI to avoid double slashes
        string memory uriPrefix = baseURI;
        if (bytes(baseURI).length > 0 && keccak256(bytes(baseURI)) != keccak256(bytes("ipfs://")) && !_endsWith(baseURI, "/")) {
            uriPrefix = string(abi.encodePacked(baseURI, "/"));
        }
        return string(abi.encodePacked(uriPrefix, "level", _toString(level), ".json"));
    }
    
    // Admin functions
    
    /**
     * @notice Set base URI (only owner)
     */
    function setBaseURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
        emit BaseURIUpdated(_baseURI);
    }
    
    /**
     * @notice Set verifier address (only owner)
     */
    function setVerifier(address _verifier) external onlyOwner {
        require(_verifier != address(0), "Invalid address");
        verifier = _verifier;
        emit VerifierUpdated(_verifier);
    }
    
    /**
     * @notice Set verification contract address (only owner)
     */
    function setVerificationContract(address _verificationContract) external onlyOwner {
        verificationContract = _verificationContract;
        emit VerificationContractUpdated(_verificationContract);
    }
    
    /**
     * @notice Set reward distributor address (only owner)
     */
    function setRewardDistributor(address _rewardDistributor) external onlyOwner {
        rewardDistributor = _rewardDistributor;
        emit RewardDistributorUpdated(_rewardDistributor);
    }
    
    // Helper functions
    
    /**
     * @notice Convert uint to string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    /**
     * @notice Check if string ends with a suffix
     */
    function _endsWith(string memory str, string memory suffix) internal pure returns (bool) {
        bytes memory strBytes = bytes(str);
        bytes memory suffixBytes = bytes(suffix);
        
        if (suffixBytes.length > strBytes.length) {
            return false;
        }
        
        uint256 start = strBytes.length - suffixBytes.length;
        for (uint256 i = 0; i < suffixBytes.length; i++) {
            if (strBytes[start + i] != suffixBytes[i]) {
                return false;
            }
        }
        return true;
    }
}

/**
 * @notice Interface for Reward Distributor
 */
interface IRewardDistributor {
    function distributeLevelReward(address user) external;
}

