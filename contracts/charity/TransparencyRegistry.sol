// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title TransparencyRegistry
 * @notice Tamper-evident, timestamped anchor for BITESHA's monthly charity reports.
 *
 *         Each month the foundation publishes a report bundle off-chain (IPFS):
 *         on-chain transaction list, receipts, photos, videos. The bundle is
 *         cryptographically signed and its hash + CID are anchored here on-chain.
 *
 *         Anyone can later verify that a given report is the exact one that was
 *         published for that period and that it has not been altered.
 *
 *         Publishing is gated by PUBLISHER_ROLE — intended to be held by a multisig
 *         that includes INDEPENDENT representatives, so no single person controls
 *         what the project reports.
 *
 * What this guarantees:
 *   - A report for a period, once anchored, cannot be silently changed: the hash
 *     is immutable and the block timestamp is on record.
 *   - The full history of reports is publicly enumerable.
 *
 * What it does NOT do:
 *   - It does not store the report itself (that lives on IPFS) — only its fingerprint.
 *   - It does not prove the report's *contents* are truthful, only that the published
 *     artifact matches what was anchored. Truthfulness is established by letting
 *     anyone reconcile the report against on-chain CharityVault events + receipts.
 */
contract TransparencyRegistry is AccessControl {
    bytes32 public constant PUBLISHER_ROLE = keccak256("PUBLISHER_ROLE");

    struct Report {
        uint256 period;        // YYYYMM, e.g. 202607
        bytes32 reportHash;    // keccak256 of the canonical report JSON
        string  ipfsCid;       // IPFS CID of the full signed report bundle
        address publisher;     // who anchored it
        uint256 anchoredAt;    // block timestamp
        bytes   signature;     // signature over reportHash by the foundation key
    }

    // period (YYYYMM) => report
    mapping(uint256 => Report) private _reports;
    uint256[] public periods; // ordered list of published periods

    event ReportAnchored(
        uint256 indexed period,
        bytes32 reportHash,
        string ipfsCid,
        address indexed publisher
    );

    constructor(address admin) {
        require(admin != address(0), "Registry: zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @notice Anchor a monthly report. One report per period; immutable once set.
     * @param period     YYYYMM identifier (e.g. 202607 for July 2026).
     * @param reportHash keccak256 of the canonical report JSON.
     * @param ipfsCid    IPFS CID of the full signed bundle.
     * @param signature  Signature over reportHash by the foundation's reporting key.
     */
    function anchorReport(
        uint256 period,
        bytes32 reportHash,
        string calldata ipfsCid,
        bytes calldata signature
    )
        external
        onlyRole(PUBLISHER_ROLE)
    {
        require(period >= 200001 && period % 100 >= 1 && period % 100 <= 12, "Registry: bad period");
        require(reportHash != bytes32(0), "Registry: zero hash");
        require(bytes(ipfsCid).length > 0, "Registry: empty cid");
        require(_reports[period].anchoredAt == 0, "Registry: period already anchored");

        _reports[period] = Report({
            period:     period,
            reportHash: reportHash,
            ipfsCid:    ipfsCid,
            publisher:  msg.sender,
            anchoredAt: block.timestamp,
            signature:  signature
        });
        periods.push(period);

        emit ReportAnchored(period, reportHash, ipfsCid, msg.sender);
    }

    /**
     * @notice Fetch the anchored report for a period.
     */
    function getReport(uint256 period) external view returns (Report memory) {
        require(_reports[period].anchoredAt != 0, "Registry: no report");
        return _reports[period];
    }

    /**
     * @notice True if the given hash matches the report anchored for the period.
     *         Lets anyone verify a downloaded report against the on-chain anchor.
     */
    function verify(uint256 period, bytes32 reportHash) external view returns (bool) {
        return _reports[period].anchoredAt != 0 && _reports[period].reportHash == reportHash;
    }

    function reportCount() external view returns (uint256) {
        return periods.length;
    }
}
