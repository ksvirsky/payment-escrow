import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { MockERC20 } from "../typechain-types/contracts/mocks/MockERC20";

const DAY = 24 * 60 * 60;
const paymentDelay = 3 * DAY;
const cancelDelay = 3 * DAY;
const disputeDelay = 30 * DAY;

enum State {
  Pending,
  PaymentConfirmed,
  CancelPaymentPending,
  CancelPaymentConfirmed,
  DisputedByPartyA,
  DisputedByPartyB
}

async function deployEscrowFixture() {
  const [owner, partyA, partyB] = await hre.ethers.getSigners();

  // Deploy a mock ERC20 token for testing
  const MockToken = await hre.ethers.getContractFactory("MockERC20");
  const token = await MockToken.deploy("Mock Token", "MTK") as unknown as MockERC20;
  
  await token.waitForDeployment();

  // Deploy PaymentEscrowV1
  const PaymentEscrowV1 = await hre.ethers.getContractFactory("PaymentEscrowV1");
  const paymentEscrow = await PaymentEscrowV1.deploy();
  await paymentEscrow.waitForDeployment();

  // Initialize the contract
  await paymentEscrow.__PaymentEscrow_init(
    partyA.address,
    partyB.address,
    paymentDelay,
    cancelDelay,
    disputeDelay,
  );

  // Mint some tokens to partyA for testing
  await token.mint(partyA.address, hre.ethers.parseEther("1000"));
  await token.connect(partyA).approve(await paymentEscrow.getAddress(), hre.ethers.parseEther("1000"));

  return { paymentEscrow, token, owner, partyA, partyB };
}

describe("PaymentEscrowV1", function () {
  describe("Initialization", function () {
    it("should initialize with correct parameters", async function () {
      const { paymentEscrow, partyA, partyB } = await loadFixture(deployEscrowFixture);
      
      expect(await paymentEscrow.partyA()).to.equal(partyA.address);
      expect(await paymentEscrow.partyB()).to.equal(partyB.address);
      expect(await paymentEscrow.paymentDelay()).to.equal(paymentDelay);
      expect(await paymentEscrow.cancelDelay()).to.equal(cancelDelay);
      expect(await paymentEscrow.disputeDelay()).to.equal(disputeDelay);
      expect(await paymentEscrow.state()).to.equal(State.Pending);
    });
  });

  describe("Payment Flow", function () {
    it("should allow partyA to confirm payment", async function () {
      const { paymentEscrow, partyA } = await loadFixture(deployEscrowFixture);
      
      await paymentEscrow.connect(partyA).confirmPayment();
      
      expect(await paymentEscrow.state()).to.equal(State.PaymentConfirmed);
    });

    it("should not allow partyB to confirm payment", async function () {
      const { paymentEscrow, partyB } = await loadFixture(deployEscrowFixture);
      
      await expect(
        paymentEscrow.connect(partyB).confirmPayment()
      ).to.be.revertedWithCustomError(paymentEscrow, "NotAuthorizedError");
    });

    it("should not allow confirming payment twice", async function () {
      const { paymentEscrow, partyA } = await loadFixture(deployEscrowFixture);
      
      await paymentEscrow.connect(partyA).confirmPayment();
      await expect(
        paymentEscrow.connect(partyA).confirmPayment()
      ).to.be.revertedWithCustomError(paymentEscrow, "IncorrectStateError");
    });
  });

  describe("Cancellation Flow", function () {
    it("should allow partyA to cancel payment", async function () {
      const { paymentEscrow, partyA } = await loadFixture(deployEscrowFixture);
      
      await paymentEscrow.connect(partyA).cancelPayment();
      
      expect(await paymentEscrow.state()).to.equal(State.CancelPaymentPending);
    });

    it("should allow partyB to confirm cancellation", async function () {
      const { paymentEscrow, partyA, partyB } = await loadFixture(deployEscrowFixture);
      
      await paymentEscrow.connect(partyA).cancelPayment();
      await paymentEscrow.connect(partyB).confirmCancelPayment();
      
      expect(await paymentEscrow.state()).to.equal(State.CancelPaymentConfirmed);
    });

    it("should not allow partyA to confirm cancellation", async function () {
      const { paymentEscrow, partyA } = await loadFixture(deployEscrowFixture);
      
      await paymentEscrow.connect(partyA).cancelPayment();
      
      await expect(
        paymentEscrow.connect(partyA).confirmCancelPayment()
      ).to.be.revertedWithCustomError(paymentEscrow, "NotAuthorizedError");
    });
  });

  describe("Dispute Flow", function () {
    it("should allow partyB to dispute before cancel delay passes", async function () {
      const { paymentEscrow, partyA, partyB } = await loadFixture(deployEscrowFixture);
      
      await paymentEscrow.connect(partyA).cancelPayment();
      await paymentEscrow.connect(partyB).dispute();
      
      expect(await paymentEscrow.state()).to.equal(State.DisputedByPartyB);
    });

    it("should allow partyA to re-dispute before dispute delay passes", async function () {
      const { paymentEscrow, partyA, partyB } = await loadFixture(deployEscrowFixture);
      
      await paymentEscrow.connect(partyA).cancelPayment();
      await paymentEscrow.connect(partyB).dispute();
      await paymentEscrow.connect(partyA).dispute();
      
      expect(await paymentEscrow.state()).to.equal(State.DisputedByPartyA);
    });

    it("should not allow partyB to dispute after cancel delay passes", async function () {
      const { paymentEscrow, partyA, partyB } = await loadFixture(deployEscrowFixture);
      
      await paymentEscrow.connect(partyA).cancelPayment();
      await time.increase(cancelDelay + 1);
      
      await expect(
        paymentEscrow.connect(partyB).dispute()
      ).to.be.revertedWithCustomError(paymentEscrow, "NotAuthorizedError");
    });

    it("should not allow partyA to re-dispute after dispute delay passes", async function () {
      const { paymentEscrow, partyA, partyB } = await loadFixture(deployEscrowFixture);
      
      await paymentEscrow.connect(partyA).cancelPayment();
      await paymentEscrow.connect(partyB).dispute();
      await time.increase(disputeDelay + 1);
      
      await expect(
        paymentEscrow.connect(partyA).dispute()
      ).to.be.revertedWithCustomError(paymentEscrow, "NotAuthorizedError");
    });

    it("should not allow to dispute during payment delay", async function () {
      const { paymentEscrow, partyB } = await loadFixture(deployEscrowFixture);
      
      await expect(
        paymentEscrow.connect(partyB).dispute()
      ).to.be.revertedWithCustomError(paymentEscrow, "NotAuthorizedError");
    });

    it("should not allow partyB to cancel payment", async function () {
      const { paymentEscrow, partyB } = await loadFixture(deployEscrowFixture);
      
      await expect(
        paymentEscrow.connect(partyB).cancelPayment()
      ).to.be.revertedWithCustomError(paymentEscrow, "NotAuthorizedError");
    });

    it("should allow partyB to re-dispute after partyA dispute", async function () {
      const { paymentEscrow, partyA, partyB } = await loadFixture(deployEscrowFixture);
      
      await paymentEscrow.connect(partyA).cancelPayment();
      await paymentEscrow.connect(partyB).dispute();
      await paymentEscrow.connect(partyA).dispute();
      await paymentEscrow.connect(partyB).dispute();
      
      expect(await paymentEscrow.state()).to.equal(State.DisputedByPartyB);
    });

    it("should not allow partyB to re-dispute after partyA dispute after dispute delay passes", async function () {
      const { paymentEscrow, partyA, partyB } = await loadFixture(deployEscrowFixture);
      
      await paymentEscrow.connect(partyA).cancelPayment();
      await paymentEscrow.connect(partyB).dispute();
      await paymentEscrow.connect(partyA).dispute();
      await time.increase(disputeDelay + 1);
      
      await expect(
        paymentEscrow.connect(partyB).dispute()
      ).to.be.revertedWithCustomError(paymentEscrow, "NotAuthorizedError");
    });
  });

  describe("Withdrawal Flow", function () {
    const amount = hre.ethers.parseEther("100");

    async function withDeposit() {
      const { paymentEscrow, token, partyA, partyB } = await loadFixture(deployEscrowFixture);
      await token.connect(partyA).transfer(await paymentEscrow.getAddress(), amount);
      return { paymentEscrow, token, partyA, partyB };
    }

    it("should allow partyB to withdraw after payment confirmation", async function () {
      const { paymentEscrow, token, partyA, partyB } = await withDeposit();

      await paymentEscrow.connect(partyA).confirmPayment();

      const partyBBalanceBefore = await token.balanceOf(partyB.address);
      await paymentEscrow.connect(partyB).withdraw(await token.getAddress(), amount);
      const partyBBalanceAfter = await token.balanceOf(partyB.address);

      expect(partyBBalanceAfter - partyBBalanceBefore).to.equal(amount);
    });

    it("should allow partyA to withdraw after cancellation confirmation", async function () {
      const { paymentEscrow, token, partyA, partyB } = await withDeposit();

      await paymentEscrow.connect(partyA).cancelPayment();
      await paymentEscrow.connect(partyB).confirmCancelPayment();
      
      const partyABalanceBefore = await token.balanceOf(partyA.address);
      await paymentEscrow.connect(partyA).withdraw(await token.getAddress(), amount);
      const partyABalanceAfter = await token.balanceOf(partyA.address);

      expect(partyABalanceAfter - partyABalanceBefore).to.equal(amount);
    });

    it("should not allow withdrawal for partyB before payment delay", async function () {
      const { paymentEscrow, token, partyB } = await withDeposit();
      await expect(
        paymentEscrow.connect(partyB).withdraw(await token.getAddress(), amount)
      ).to.be.revertedWithCustomError(paymentEscrow, "NotAuthorizedError");
    });

    it("should allow partyB to withdraw after successful dispute", async function () {
      const { paymentEscrow, token, partyA, partyB } = await withDeposit();

      await paymentEscrow.connect(partyA).cancelPayment();
      await paymentEscrow.connect(partyB).dispute();
      await time.increase(disputeDelay + 1);
      
      const partyBBalanceBefore = await token.balanceOf(partyB.address);
      await paymentEscrow.connect(partyB).withdraw(await token.getAddress(), amount);
      const partyBBalanceAfter = await token.balanceOf(partyB.address);

      expect(partyBBalanceAfter - partyBBalanceBefore).to.equal(amount);
    });

    it("should not allow partyA to withdraw after partyB successful dispute", async function () {
      const { paymentEscrow, token, partyA, partyB } = await withDeposit();

      await paymentEscrow.connect(partyA).cancelPayment();
      await paymentEscrow.connect(partyB).dispute();
      await time.increase(disputeDelay + 1);

      await expect(
        paymentEscrow.connect(partyA).withdraw(await token.getAddress(), amount)
      ).to.be.revertedWithCustomError(paymentEscrow, "NotAuthorizedError");
    });

    it("should allow partyA to withdraw after successful re-dispute", async function () {
      const { paymentEscrow, token, partyA, partyB } = await withDeposit();
      
      await paymentEscrow.connect(partyA).cancelPayment();
      await paymentEscrow.connect(partyB).dispute();
      await paymentEscrow.connect(partyA).dispute();
      await time.increase(disputeDelay + 1);

      const partyABalanceBefore = await token.balanceOf(partyA.address);
      await paymentEscrow.connect(partyA).withdraw(await token.getAddress(), amount);
      const partyABalanceAfter = await token.balanceOf(partyA.address);

      expect(partyABalanceAfter - partyABalanceBefore).to.equal(amount);
    });

    it("should not allow partyB to withdraw after successful partyA re-dispute", async function () {
      const { paymentEscrow, token, partyA, partyB } = await withDeposit();
      
      await paymentEscrow.connect(partyA).cancelPayment();
      await paymentEscrow.connect(partyB).dispute();
      await paymentEscrow.connect(partyA).dispute();
      await time.increase(disputeDelay + 1);

      await expect(
        paymentEscrow.connect(partyB).withdraw(await token.getAddress(), amount)
      ).to.be.revertedWithCustomError(paymentEscrow, "NotAuthorizedError");
    });

    it("should allow partyB to withdraw after successful re-dispute", async function () {
      const { paymentEscrow, token, partyA, partyB } = await withDeposit();
      
      await paymentEscrow.connect(partyA).cancelPayment();
      await paymentEscrow.connect(partyB).dispute();
      await paymentEscrow.connect(partyA).dispute();
      await paymentEscrow.connect(partyB).dispute();
      await time.increase(disputeDelay + 1);

      const partyBBalanceBefore = await token.balanceOf(partyB.address);
      await paymentEscrow.connect(partyB).withdraw(await token.getAddress(), amount);
      const partyBBalanceAfter = await token.balanceOf(partyB.address);

      expect(partyBBalanceAfter - partyBBalanceBefore).to.equal(amount);
    });

    it("should not allow partyA to withdraw after successful partyB re-dispute", async function () {
      const { paymentEscrow, token, partyA, partyB } = await withDeposit();
      
      await paymentEscrow.connect(partyA).cancelPayment();
      await paymentEscrow.connect(partyB).dispute();
      await paymentEscrow.connect(partyA).dispute();
      await paymentEscrow.connect(partyB).dispute();
      await time.increase(disputeDelay + 1);

      await expect(
        paymentEscrow.connect(partyA).withdraw(await token.getAddress(), amount)
      ).to.be.revertedWithCustomError(paymentEscrow, "NotAuthorizedError");
    });

    it("should not allow withdrawal to partyA and partyB before cancel delay", async function () {
      const { paymentEscrow, token, partyA, partyB } = await withDeposit();
      
      await paymentEscrow.connect(partyA).cancelPayment();

      await expect(
        paymentEscrow.connect(partyA).withdraw(await token.getAddress(), amount)
      ).to.be.revertedWithCustomError(paymentEscrow, "NotAuthorizedError");

      await expect(
        paymentEscrow.connect(partyB).withdraw(await token.getAddress(), amount)
      ).to.be.revertedWithCustomError(paymentEscrow, "NotAuthorizedError");
    });

    it("should not allow withdrawal to partyA and partyB before dispute delay", async function () {
      const { paymentEscrow, token, partyA, partyB } = await withDeposit();
      
      await paymentEscrow.connect(partyA).cancelPayment();
      await paymentEscrow.connect(partyB).dispute();

      await expect(
        paymentEscrow.connect(partyA).withdraw(await token.getAddress(), amount)
      ).to.be.revertedWithCustomError(paymentEscrow, "NotAuthorizedError");

      await expect(
        paymentEscrow.connect(partyB).withdraw(await token.getAddress(), amount)
      ).to.be.revertedWithCustomError(paymentEscrow, "NotAuthorizedError");
    });

    it("should not allow withdrawal to partyA and partyB before re-dispute delay", async function () {
      const { paymentEscrow, token, partyA, partyB } = await withDeposit();
      
      await paymentEscrow.connect(partyA).cancelPayment();
      await paymentEscrow.connect(partyB).dispute();
      await paymentEscrow.connect(partyA).dispute();

      await expect(
        paymentEscrow.connect(partyA).withdraw(await token.getAddress(), amount)
      ).to.be.revertedWithCustomError(paymentEscrow, "NotAuthorizedError");

      await expect(
        paymentEscrow.connect(partyB).withdraw(await token.getAddress(), amount)
      ).to.be.revertedWithCustomError(paymentEscrow, "NotAuthorizedError");
    });
  });
}); 