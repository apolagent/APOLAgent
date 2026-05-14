// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev ERC-5192 Minimal Soulbound Token interface.
 * https://eips.ethereum.org/EIPS/eip-5192
 */
interface IERC5192 {
    /// @notice Emitted when the locking status changes. Emitted once on mint (locked = true).
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);

    /// @notice Returns true if the token is locked (non-transferable).
    function locked(uint256 tokenId) external view returns (bool);
}

/**
 * @title ApolCertification
 * @notice Soulbound certification token issued by APOL for verified AI agents.
 *         One token per agent wallet. SILVER and GOLD tiers only.
 *         Non-transferable per ERC-5192. Owner (APOL) can revoke (burn) any token.
 */
contract ApolCertification is ERC721, Ownable, IERC5192 {

    // ── Storage ────────────────────────────────────────────────────────────────

    struct TokenData {
        address agentWallet;
        string  agentName;
        string  certificationTier;
        uint256 cognitionScore;
        string  scanUrl;
        uint256 mintTimestamp;
    }

    uint256 private _nextTokenId;

    mapping(uint256 => TokenData) private _tokenData;
    mapping(address => uint256)   public  walletToTokenId;

    // ── Events ─────────────────────────────────────────────────────────────────

    event CertificationMinted(
        uint256 indexed tokenId,
        address indexed agentWallet,
        string  certificationTier,
        uint256 cognitionScore
    );

    event CertificationRevoked(
        uint256 indexed tokenId,
        address indexed agentWallet
    );

    // ── Constructor ────────────────────────────────────────────────────────────

    constructor()
        ERC721("APOL Certification", "APOLCERT")
        Ownable(0x857aca6A8A743C9262d64819D239f509a1Cd0A85)
    {}

    // ── ERC-5192 ───────────────────────────────────────────────────────────────

    /// @inheritdoc IERC5192
    function locked(uint256 tokenId) external view override returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    // ── Soulbound overrides — all transfers revert ─────────────────────────────

    function transferFrom(address, address, uint256) public pure override {
        revert("Soulbound: non-transferable");
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert("Soulbound: non-transferable");
    }

    function approve(address, uint256) public pure override {
        revert("Soulbound: non-transferable");
    }

    function setApprovalForAll(address, bool) public pure override {
        revert("Soulbound: non-transferable");
    }

    // ── Mint ───────────────────────────────────────────────────────────────────

    /**
     * @notice Mint a certification SBT to an agent wallet.
     * @param agentWallet      The agent's wallet address (recipient).
     * @param agentName        Human-readable agent name.
     * @param certificationTier Must be "SILVER" or "GOLD".
     * @param cognitionScore   Score 0–100.
     * @param scanUrl          APOL scan result URL.
     */
    function mint(
        address agentWallet,
        string  calldata agentName,
        string  calldata certificationTier,
        uint256 cognitionScore,
        string  calldata scanUrl
    ) external onlyOwner {
        require(agentWallet != address(0), "ApolCertification: zero address");
        require(walletToTokenId[agentWallet] == 0, "ApolCertification: wallet already certified");
        require(
            _isSilverOrGold(certificationTier),
            "ApolCertification: only SILVER or GOLD tiers allowed"
        );
        require(cognitionScore <= 100, "ApolCertification: score out of range");

        // Token IDs start at 1 so that walletToTokenId[addr] == 0 means "no token".
        _nextTokenId++;
        uint256 tokenId = _nextTokenId;

        _tokenData[tokenId] = TokenData({
            agentWallet:       agentWallet,
            agentName:         agentName,
            certificationTier: certificationTier,
            cognitionScore:    cognitionScore,
            scanUrl:           scanUrl,
            mintTimestamp:     block.timestamp
        });

        walletToTokenId[agentWallet] = tokenId;

        _safeMint(agentWallet, tokenId);

        emit Locked(tokenId);
        emit CertificationMinted(tokenId, agentWallet, certificationTier, cognitionScore);
    }

    // ── Revoke ─────────────────────────────────────────────────────────────────

    /**
     * @notice Revoke (burn) a certification token. Only callable by APOL owner.
     * @param tokenId The token to revoke.
     */
    function revoke(uint256 tokenId) external onlyOwner {
        address agentWallet = _tokenData[tokenId].agentWallet;
        require(agentWallet != address(0), "ApolCertification: token does not exist");

        delete walletToTokenId[agentWallet];
        delete _tokenData[tokenId];

        _burn(tokenId);

        emit CertificationRevoked(tokenId, agentWallet);
    }

    // ── Metadata ───────────────────────────────────────────────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string(abi.encodePacked(
            "https://apolagent.online/api/sbt/metadata/",
            _toString(tokenId)
        ));
    }

    function getTokenData(uint256 tokenId) external view returns (TokenData memory) {
        _requireOwned(tokenId);
        return _tokenData[tokenId];
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return
            interfaceId == type(IERC5192).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    // ── Internal helpers ───────────────────────────────────────────────────────

    function _isSilverOrGold(string calldata tier) internal pure returns (bool) {
        bytes32 h = keccak256(bytes(tier));
        return h == keccak256(bytes("SILVER")) || h == keccak256(bytes("GOLD"));
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
