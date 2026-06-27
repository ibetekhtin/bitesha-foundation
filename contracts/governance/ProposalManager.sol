// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ProposalManager
 * @notice Off-chain-friendly view layer for DAO proposals.
 *         Stores proposal metadata (title, discussion link) keyed by on-chain proposalId.
 *         Does not affect votes — purely informational.
 */
contract ProposalManager {
    struct Meta {
        string  title;
        string  discussionUrl;
        address author;
        uint256 createdAt;
    }

    mapping(uint256 => Meta) public proposalMeta;

    event MetaRegistered(uint256 indexed proposalId, address indexed author, string title);

    /**
     * @notice Register metadata for an on-chain proposal immediately after creating it.
     * @param proposalId  The ID returned by Governor.propose().
     * @param title       Short human-readable title.
     * @param discussionUrl  Forum/Notion/GitHub link for full discussion.
     */
    function registerMeta(
        uint256 proposalId,
        string calldata title,
        string calldata discussionUrl
    ) external {
        require(bytes(title).length > 0, "ProposalManager: empty title");
        require(proposalMeta[proposalId].createdAt == 0, "ProposalManager: already registered");

        proposalMeta[proposalId] = Meta({
            title:         title,
            discussionUrl: discussionUrl,
            author:        msg.sender,
            createdAt:     block.timestamp
        });

        emit MetaRegistered(proposalId, msg.sender, title);
    }
}
