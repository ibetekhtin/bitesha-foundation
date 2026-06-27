const { expect } = require("chai");
const { ethers } = require("hardhat");
const { mine, time } = require("@nomicfoundation/hardhat-network-helpers");

const VOTING_DELAY  = 86400;   // blocks
const VOTING_PERIOD = 604800;  // blocks
const TIMELOCK_DELAY = 2 * 24 * 3600; // 2 days seconds

// Proposal states in OZ Governor
const State = {
  Pending: 0, Active: 1, Canceled: 2, Defeated: 3,
  Succeeded: 4, Queued: 5, Expired: 6, Executed: 7,
};

describe("Governance lifecycle (propose → vote → queue → execute)", () => {
  let btsh, timelock, gov, treasury;
  let deployer, voter1, voter2, recipient;

  // Allocation the DAO will approve: under the 1M threshold so GOVERNOR_ROLE suffices
  const GRANT = ethers.parseEther("500000");

  beforeEach(async () => {
    [deployer, voter1, voter2, recipient] = await ethers.getSigners();

    const BTSH     = await ethers.getContractFactory("BTSH");
    const Timelock = await ethers.getContractFactory("BITESHATimelock");
    const Gov      = await ethers.getContractFactory("BITESHAGovernance");
    const Treasury = await ethers.getContractFactory("BITESHATreasury");

    btsh     = await BTSH.deploy(deployer.address);
    timelock = await Timelock.deploy([], [], deployer.address);
    gov      = await Gov.deploy(await btsh.getAddress(), await timelock.getAddress());
    treasury = await Treasury.deploy(await btsh.getAddress(), deployer.address);

    // Mint full supply to deployer, fund treasury, give voters weight
    await btsh.mintInitial(deployer.address, ethers.parseEther("1000000000"));
    await btsh.transfer(await treasury.getAddress(), ethers.parseEther("100000000"));
    await btsh.transfer(voter1.address, ethers.parseEther("200000000"));
    await btsh.transfer(voter2.address, ethers.parseEther("200000000"));
    await btsh.connect(voter1).delegate(voter1.address);
    await btsh.connect(voter2).delegate(voter2.address);
    await mine(1);

    // Wire timelock: governor is the sole proposer, anyone can execute
    const PROPOSER = await timelock.PROPOSER_ROLE();
    const EXECUTOR = await timelock.EXECUTOR_ROLE();
    const ADMIN    = await timelock.DEFAULT_ADMIN_ROLE();
    await timelock.grantRole(PROPOSER, await gov.getAddress());
    await timelock.grantRole(EXECUTOR, ethers.ZeroAddress);
    await timelock.revokeRole(ADMIN, deployer.address);

    // Treasury: timelock holds GOVERNOR_ROLE so the DAO can allocate
    const GOVERNOR_ROLE = await treasury.GOVERNOR_ROLE();
    const TIMELOCK_ROLE = await treasury.TIMELOCK_ROLE();
    const ADMIN_ROLE    = await treasury.DEFAULT_ADMIN_ROLE();
    await treasury.grantRole(GOVERNOR_ROLE, await timelock.getAddress());
    await treasury.grantRole(TIMELOCK_ROLE, await timelock.getAddress());
    await treasury.transferAdmin(await timelock.getAddress());
    await treasury.renounceRole(ADMIN_ROLE, deployer.address);
  });

  function encodeAllocation() {
    const iface = treasury.interface;
    return iface.encodeFunctionData("allocateBTSH", [
      recipient.address, GRANT, "DAO-approved grant",
    ]);
  }

  it("executes a treasury allocation through the full DAO pipeline", async () => {
    const calldata    = encodeAllocation();
    const targets     = [await treasury.getAddress()];
    const values      = [0];
    const calldatas   = [calldata];
    const description  = "RFC-0010: grant 500k BTSH to ecosystem fund";
    const descHash    = ethers.id(description);

    // 1. Propose
    const tx = await gov.connect(voter1).propose(targets, values, calldatas, description);
    const receipt = await tx.wait();
    const id = receipt.logs[0].args[0];
    expect(await gov.state(id)).to.equal(State.Pending);

    // 2. Activate + vote
    await mine(VOTING_DELAY + 1);
    expect(await gov.state(id)).to.equal(State.Active);
    await gov.connect(voter1).castVote(id, 1);
    await gov.connect(voter2).castVote(id, 1);

    // 3. Voting ends → Succeeded
    await mine(VOTING_PERIOD + 1);
    expect(await gov.state(id)).to.equal(State.Succeeded);

    // 4. Queue (exercises _queueOperations)
    await gov.queue(targets, values, calldatas, descHash);
    expect(await gov.state(id)).to.equal(State.Queued);

    // 5. Wait timelock delay then execute (exercises _executeOperations)
    await time.increase(TIMELOCK_DELAY + 1);
    const before = await btsh.balanceOf(recipient.address);
    await gov.execute(targets, values, calldatas, descHash);
    const after = await btsh.balanceOf(recipient.address);

    expect(await gov.state(id)).to.equal(State.Executed);
    expect(after - before).to.equal(GRANT);
  });

  it("a defeated proposal cannot be queued", async () => {
    const calldata  = encodeAllocation();
    const targets   = [await treasury.getAddress()];
    const values    = [0];
    const calldatas = [calldata];
    const description = "RFC-0011: rejected grant";
    const descHash  = ethers.id(description);

    const tx = await gov.connect(voter1).propose(targets, values, calldatas, description);
    const id = (await tx.wait()).logs[0].args[0];

    await mine(VOTING_DELAY + 1);
    // Both vote AGAINST
    await gov.connect(voter1).castVote(id, 0);
    await gov.connect(voter2).castVote(id, 0);
    await mine(VOTING_PERIOD + 1);

    expect(await gov.state(id)).to.equal(State.Defeated);
    await expect(gov.queue(targets, values, calldatas, descHash)).to.be.reverted;
  });

  it("proposer can cancel a pending proposal (exercises _cancel)", async () => {
    const calldata  = encodeAllocation();
    const targets   = [await treasury.getAddress()];
    const values    = [0];
    const calldatas = [calldata];
    const description = "RFC-0012: to be cancelled";

    const tx = await gov.connect(voter1).propose(targets, values, calldatas, description);
    const id = (await tx.wait()).logs[0].args[0];

    // OZ Governor: proposer can cancel while Pending
    await gov.connect(voter1).cancel(targets, values, calldatas, ethers.id(description));
    expect(await gov.state(id)).to.equal(State.Canceled);
  });

  it("quorum is 4% of supply and proposalNeedsQueuing is true with a timelock", async () => {
    // proposalNeedsQueuing() override path
    const calldata  = encodeAllocation();
    const targets   = [await treasury.getAddress()];
    const values    = [0];
    const calldatas = [calldata];
    const description = "RFC-0013: queue check";

    const tx = await gov.connect(voter1).propose(targets, values, calldatas, description);
    const id = (await tx.wait()).logs[0].args[0];
    expect(await gov.proposalNeedsQueuing(id)).to.equal(true);

    // Mine past the snapshot block so quorum() can read past total supply
    await mine(VOTING_DELAY + 1);

    // quorum at the proposal snapshot = 4% of 1B = 40M
    const snapshot = await gov.proposalSnapshot(id);
    expect(await gov.quorum(snapshot)).to.equal(ethers.parseEther("40000000"));
  });

  it("a proposal failing quorum is Defeated even if all votes are For", async () => {
    // Give a third small holder just under quorum and have only them vote
    const [, , , , smallHolder] = await ethers.getSigners();
    await btsh.transfer(smallHolder.address, ethers.parseEther("1000000")); // 0.1% < 4%
    await btsh.connect(smallHolder).delegate(smallHolder.address);
    await mine(1);

    const targets   = [await treasury.getAddress()];
    const values    = [0];
    const calldatas = [encodeAllocation()];
    const description = "RFC-0014: under quorum";

    const tx = await gov.connect(smallHolder).propose(targets, values, calldatas, description)
      .catch(() => null);
    // smallHolder has 1M > 100k threshold, so propose succeeds
    const receipt = await tx.wait();
    const id = receipt.logs[0].args[0];

    await mine(VOTING_DELAY + 1);
    await gov.connect(smallHolder).castVote(id, 1); // For, but only 1M < 40M quorum
    await mine(VOTING_PERIOD + 1);

    expect(await gov.state(id)).to.equal(State.Defeated);
  });
});
