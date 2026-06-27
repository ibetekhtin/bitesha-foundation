const { expect } = require("chai");
const { ethers } = require("hardhat");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

// OZ v5 Governor uses block.number as clock by default.
// GovernorSettings(1 days, 7 days, ...) = 86400 blocks delay, 604800 blocks period.
const VOTING_DELAY  = 86400;   // blocks
const VOTING_PERIOD = 604800;  // blocks

describe("BITESHAGovernance", () => {
  let btsh, timelock, gov, proposalManager;
  let owner, voter1, voter2, other;

  beforeEach(async () => {
    [owner, voter1, voter2, other] = await ethers.getSigners();

    // Deploy BTSH (now includes ERC20Votes)
    const BTSH = await ethers.getContractFactory("BTSH");
    btsh = await BTSH.deploy(owner.address);
    await btsh.mintInitial(owner.address, ethers.parseEther("1000000000"));

    // Distribute tokens and self-delegate to activate voting weight
    await btsh.transfer(voter1.address, ethers.parseEther("200000000"));
    await btsh.transfer(voter2.address, ethers.parseEther("200000000"));
    await btsh.connect(voter1).delegate(voter1.address);
    await btsh.connect(voter2).delegate(voter2.address);
    await mine(1); // checkpoint

    // Deploy Timelock
    const Timelock = await ethers.getContractFactory("BITESHATimelock");
    timelock = await Timelock.deploy([], [], owner.address);

    // Deploy Governance
    const Gov = await ethers.getContractFactory("BITESHAGovernance");
    gov = await Gov.deploy(await btsh.getAddress(), await timelock.getAddress());

    // Wire up Timelock roles
    const PROPOSER = await timelock.PROPOSER_ROLE();
    const EXECUTOR = await timelock.EXECUTOR_ROLE();
    const ADMIN    = await timelock.DEFAULT_ADMIN_ROLE();
    await timelock.grantRole(PROPOSER, await gov.getAddress());
    await timelock.grantRole(EXECUTOR, ethers.ZeroAddress);
    await timelock.revokeRole(ADMIN, owner.address);

    // Deploy ProposalManager
    const PM = await ethers.getContractFactory("ProposalManager");
    proposalManager = await PM.deploy();
  });

  it("reports correct name", async () => {
    expect(await gov.name()).to.equal("BITESHA DAO");
  });

  it("proposal threshold is 100k BTSH", async () => {
    expect(await gov.proposalThreshold()).to.equal(ethers.parseEther("100000"));
  });

  it("undelegated holder cannot propose", async () => {
    // Transfer tokens to other without delegating — no voting power
    await btsh.transfer(other.address, ethers.parseEther("200000000"));
    await mine(1);
    await expect(
      gov.connect(other).propose([other.address], [0], ["0x"], "Test")
    ).to.be.reverted;
  });

  it("voter with enough tokens can propose and vote", async () => {
    // voter1 has 200M, already delegated in beforeEach
    const tx = await gov.connect(voter1).propose(
      [other.address], [0], ["0x"], "Test proposal"
    );
    const receipt = await tx.wait();
    const id = receipt.logs[0].args[0];

    // Advance past voting delay (block-based: 86400 blocks)
    await mine(VOTING_DELAY + 1);

    // State must be Active (1) before voting
    expect(await gov.state(id)).to.equal(1);

    await gov.connect(voter1).castVote(id, 1); // For
    await gov.connect(voter2).castVote(id, 1); // For

    // Advance past voting period
    await mine(VOTING_PERIOD + 1);

    // ProposalState.Succeeded == 4
    expect(await gov.state(id)).to.equal(4);
  });

  it("registers proposal metadata via ProposalManager", async () => {
    const tx = await gov.connect(voter1).propose(
      [other.address], [0], ["0x"], "RFC-0002 proposal"
    );
    const receipt = await tx.wait();
    const id = receipt.logs[0].args[0];

    // voter1 registers metadata — author must be voter1
    await proposalManager.connect(voter1).registerMeta(
      id, "RFC-0002", "https://forum.bitesha.io/rfc-0002"
    );
    const meta = await proposalManager.proposalMeta(id);
    expect(meta.title).to.equal("RFC-0002");
    expect(meta.author).to.equal(voter1.address);
  });

  it("cannot register metadata twice for the same proposal", async () => {
    const tx = await gov.connect(voter1).propose(
      [other.address], [0], ["0x"], "Dup test"
    );
    const receipt = await tx.wait();
    const id = receipt.logs[0].args[0];

    await proposalManager.connect(voter1).registerMeta(id, "First", "https://a.com");
    await expect(
      proposalManager.connect(voter1).registerMeta(id, "Second", "https://b.com")
    ).to.be.revertedWith("ProposalManager: already registered");
  });
});
