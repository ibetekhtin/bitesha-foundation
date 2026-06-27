const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("BITESHAGovernance", () => {
  let btsh, timelock, gov, proposalManager;
  let owner, voter1, voter2, other;

  beforeEach(async () => {
    [owner, voter1, voter2, other] = await ethers.getSigners();

    // Deploy BTSH (ERC20Votes)
    const BTSH = await ethers.getContractFactory("BTSH");
    btsh = await BTSH.deploy(owner.address);
    await btsh.mintInitial(owner.address, ethers.parseEther("1000000000"));

    // Distribute and delegate
    await btsh.transfer(voter1.address, ethers.parseEther("200000000"));
    await btsh.transfer(voter2.address, ethers.parseEther("200000000"));
    await btsh.connect(voter1).delegate(voter1.address);
    await btsh.connect(voter2).delegate(voter2.address);
    await mine(1);

    // Deploy Timelock
    const Timelock = await ethers.getContractFactory("BITESHATimelock");
    timelock = await Timelock.deploy([], [], owner.address);

    // Deploy Governance
    const Gov = await ethers.getContractFactory("BITESHAGovernance");
    gov = await Gov.deploy(await btsh.getAddress(), await timelock.getAddress());

    // Grant Governor proposer / executor roles on timelock
    const PROPOSER = await timelock.PROPOSER_ROLE();
    const EXECUTOR = await timelock.EXECUTOR_ROLE();
    const ADMIN    = await timelock.DEFAULT_ADMIN_ROLE();
    await timelock.grantRole(PROPOSER, await gov.getAddress());
    await timelock.grantRole(EXECUTOR, ethers.ZeroAddress); // anyone can execute after delay
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

  it("owner with no tokens cannot propose", async () => {
    // owner has 600M left, still above threshold — transfer away first
    await btsh.transfer(other.address, await btsh.balanceOf(owner.address));
    await btsh.connect(owner).delegate(owner.address);
    await mine(1);

    await expect(
      gov.propose(
        [other.address],
        [0],
        ["0x"],
        "Test proposal"
      )
    ).to.be.reverted;
  });

  it("voter with enough tokens can propose and vote", async () => {
    // voter1 has 200M, well above threshold
    await btsh.connect(voter1).delegate(voter1.address);
    await mine(2);

    const tx = await gov.connect(voter1).propose(
      [other.address], [0], ["0x"], "Test proposal"
    );
    const receipt = await tx.wait();
    const id = receipt.logs[0].args[0];

    // Advance past voting delay
    await time.increase(1 days + 1);
    await mine(1);

    await gov.connect(voter1).castVote(id, 1); // For
    await gov.connect(voter2).castVote(id, 1); // For

    // Advance past voting period
    await time.increase(7 * 24 * 3600 + 1);
    await mine(1);

    expect(await gov.state(id)).to.equal(4); // Succeeded
  });
});
