import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";
import { deployBeaconWithImpl, deployProxy } from "./utils";
import { PaymentEscrowFactory } from "../typechain-types";

const DAY = 24 * 60 * 60;

async function deployFactoryFixture() {
  // Contracts are deployed using the first signer/account by default
  const [deployer, admin, otherAccount, partyA, partyB] = await hre.ethers.getSigners();

  const paymentEscrowFactory = await deployProxy<PaymentEscrowFactory>("PaymentEscrowFactory", [admin.address], admin.address, '__PaymentEscrowFactory_init');
  const { beacon: escrowV1Beacon } = await deployBeaconWithImpl("PaymentEscrowV1", admin.address);

  await paymentEscrowFactory.connect(admin).setEscrowBeacon(1, escrowV1Beacon.getAddress());

  return { paymentEscrowFactory, escrowV1Beacon, deployer, admin, otherAccount, partyA, partyB };
}

describe("PaymentEscrowFactory", function () {
  describe("Initialization", function () {
    it("should beacon v1 be set", async function () {
      const { paymentEscrowFactory, escrowV1Beacon } = await deployFactoryFixture();

      expect(await paymentEscrowFactory.escrowBeacons(1)).to.equal(escrowV1Beacon);
    });

    it("should allow toset another beacon", async function () {
      const { paymentEscrowFactory, escrowV1Beacon, admin, otherAccount } = await deployFactoryFixture();

      const tx = await paymentEscrowFactory.connect(admin).setEscrowBeacon(2, otherAccount.address);

      await expect(tx).to.emit(paymentEscrowFactory, "EscrowBeaconSet")
        .withArgs(2, otherAccount.address);

      expect(await paymentEscrowFactory.escrowBeacons(2)).to.equal(otherAccount.address);
      expect(await paymentEscrowFactory.escrowBeacons(1)).to.equal(escrowV1Beacon);
    });

    it("should not allow to set beacons for non-admins", async function () {
      const { paymentEscrowFactory, deployer, admin } = await deployFactoryFixture();

      await expect(paymentEscrowFactory.connect(deployer).setEscrowBeacon(2, admin.address))
        .to.be.revertedWithCustomError(paymentEscrowFactory, "OwnableUnauthorizedAccount")
        .withArgs(deployer.address);
    });
  });

  describe("Payment escrow", function () {
    it("should allow to create escrow to anyone", async function () {
      const { paymentEscrowFactory, partyA, partyB } = await deployFactoryFixture();

      const tx = await paymentEscrowFactory.connect(partyA).createEscrow(1, partyB.address, 3 * DAY, 3 * DAY, 30 * DAY);

      await expect(tx).to.emit(paymentEscrowFactory, "EscrowCreated")
        .withArgs(anyValue, 1, partyA.address, partyB.address, 3 * DAY, 3 * DAY, 30 * DAY);
    });

    it("should revert to create escrow when version beacon is unset", async function () {
      const { paymentEscrowFactory, partyA, partyB } = await deployFactoryFixture();

      await expect(paymentEscrowFactory.connect(partyA).createEscrow(2, partyB.address, 3 * DAY, 3 * DAY, 30 * DAY))
        .to.be.revertedWithCustomError(paymentEscrowFactory, "NoBeaconFoundError")
        .withArgs(2);
    });
  });
});
