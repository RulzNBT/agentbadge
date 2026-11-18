// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

/// @notice Minimal interface of the Agent ID contract (BNB Chain mainnet:
/// 0x60b9262456de011f7d15a54cdd8c48baaa8b022f, "SPACE ID Agent ID", symbol "AI").
/// Only the two functions this badge needs are declared.
interface IAgentID {
    function balanceOf(address account) external view returns (uint256);
    function handleOf(address account) external view returns (string memory);
}

/// @title Agent ID Badge
/// @notice A free, soulbound ERC-721 badge for holders of an Agent ID.
/// @dev One badge per Agent ID holder, token IDs start at 1. The badge is
/// non-transferable and non-approvable. There is NO owner: no Ownable, no
/// admin functions, no pause, and no receive/fallback — this contract can
/// never receive or hold BNB. Minting is free (price 0); the minter only
/// pays gas. No returns, rewards, or future value are promised.
contract AgentBadge is ERC721 {
    using Strings for uint256;

    // ------------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------------

    /// @notice Caller holds no Agent ID.
    error NotAgentIDHolder();
    /// @notice Caller already minted a badge.
    error AlreadyMinted();
    /// @notice The mint cap has been reached.
    error CapReached();
    /// @notice The Agent ID contract returned an empty handle.
    error NoHandle();
    /// @notice Badges are soulbound: transfers are not allowed.
    error SoulboundTransfer();
    /// @notice Badges are soulbound: approvals are not allowed.
    error ApprovalNotAllowed();
    /// @notice The Agent ID contract address is the zero address.
    error InvalidAgentID();

    // ------------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------------

    event BadgeMinted(address indexed holder, uint256 indexed tokenId, string handle);

    // ------------------------------------------------------------------------
    // Immutable state
    // ------------------------------------------------------------------------

    /// @notice Address of the Agent ID contract.
    address public immutable agentID;
    /// @notice Maximum number of badges that can ever be minted.
    uint256 public immutable cap;

    // ------------------------------------------------------------------------
    // Mutable state
    // ------------------------------------------------------------------------

    /// @notice Total badges minted so far (also the last token ID minted).
    uint256 public totalMinted;
    /// @notice Whether an address has already minted its one badge.
    mapping(address => bool) public hasMinted;
    /// @notice Agent ID handle recorded for each token ID.
    mapping(uint256 => string) public handleOfToken;

    // ------------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------------

    /// @param agentID_ Address of the Agent ID contract.
    /// @param cap_ Maximum number of badges (mainnet: 10,000).
    constructor(address agentID_, uint256 cap_) ERC721("Agent ID Badge", "AIDB") {
        if (agentID_ == address(0)) revert InvalidAgentID();
        agentID = agentID_;
        cap = cap_;
    }

    // ------------------------------------------------------------------------
    // Minting
    // ------------------------------------------------------------------------

    /// @notice Mint the caller's one free badge.
    /// @dev Requirements, in order:
    ///  1. caller holds at least one Agent ID,
    ///  2. caller has not minted before,
    ///  3. the cap has not been reached,
    ///  4. the Agent ID contract returns a non-empty handle for the caller.
    /// Token IDs are sequential starting at 1.
    function mint() external {
        if (IAgentID(agentID).balanceOf(msg.sender) < 1) revert NotAgentIDHolder();
        if (hasMinted[msg.sender]) revert AlreadyMinted();
        if (totalMinted >= cap) revert CapReached();

        string memory handle = IAgentID(agentID).handleOf(msg.sender);
        if (bytes(handle).length == 0) revert NoHandle();

        uint256 tokenId = ++totalMinted;
        hasMinted[msg.sender] = true;
        handleOfToken[tokenId] = handle;

        emit BadgeMinted(msg.sender, tokenId, handle);

        _safeMint(msg.sender, tokenId);
    }

    // ------------------------------------------------------------------------
    // Soulbound enforcement
    // ------------------------------------------------------------------------

    /// @dev Only minting (from == address(0)) is allowed. Every transfer
    /// (including burns, which do not exist here) reverts.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert SoulboundTransfer();
        return super._update(to, tokenId, auth);
    }

    /// @dev Approvals are meaningless for a soulbound token: always revert.
    function approve(address /* to */, uint256 /* tokenId */) public pure override {
        revert ApprovalNotAllowed();
    }

    /// @dev Approvals are meaningless for a soulbound token: always revert.
    function setApprovalForAll(address /* operator */, bool /* approved */) public pure override {
        revert ApprovalNotAllowed();
    }

    // ------------------------------------------------------------------------
    // Metadata (fully on-chain)
    // ------------------------------------------------------------------------

    /// @notice Fully on-chain JSON metadata (base64 data URI) with an
    /// on-chain SVG image. Reverts for nonexistent tokens.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert IERC721Errors.ERC721NonexistentToken(tokenId);

        string memory handle = handleOfToken[tokenId];
        string memory svg = _buildSVG(handle, tokenId);
        string memory json = string.concat(
            '{"name":"Agent ID Badge #',
            tokenId.toString(),
            '","description":"A free, soulbound badge for Agent ID holders. Free mint, gas only. Soulbound: non-transferable. No returns, rewards, or future value are promised.","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '","attributes":[{"trait_type":"Handle","value":"',
            handle,
            '"},{"trait_type":"Soulbound","value":"Yes"}]}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    /// @dev Dark neutral background (no third-party branding), gold accent.
    function _buildSVG(string memory handle, uint256 tokenId) internal pure returns (string memory) {
        return string.concat(
            "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'>",
            "<rect width='400' height='400' fill='#101216'/>",
            "<rect x='12' y='12' width='376' height='376' fill='none' stroke='#d4af37' stroke-width='3'/>",
            "<rect x='24' y='24' width='352' height='352' fill='none' stroke='#d4af37' stroke-width='1' opacity='0.4'/>",
            "<text x='200' y='72' font-family='sans-serif' font-size='22' font-weight='bold' letter-spacing='4' fill='#d4af37' text-anchor='middle'>AGENT ID BADGE</text>",
            "<text x='200' y='196' font-family='sans-serif' font-size='44' font-weight='bold' fill='#f5f5f5' text-anchor='middle'>",
            handle,
            ".ai</text>",
            "<text x='200' y='248' font-family='sans-serif' font-size='20' fill='#c9c9c9' text-anchor='middle'>Badge #",
            tokenId.toString(),
            "</text>",
            "<text x='200' y='330' font-family='sans-serif' font-size='15' letter-spacing='2' fill='#d4af37' text-anchor='middle'>SOULBOUND &#183; FREE MINT &#183; GAS ONLY</text>",
            "</svg>"
        );
    }
}
