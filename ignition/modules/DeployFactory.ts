import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { deployBeaconWithImpl, deployProxyContract } from "./utils";

// This module deploys the PaymentEscrowFactory contract and sets the beacon for PaymentEscrowV1.
export default buildModule("DeployFactory", (m) => {
  const adminAddress = m.getParameter("adminAddress");
  const { beacon: escrowV1Beacon } = deployBeaconWithImpl(m, "PaymentEscrowV1", adminAddress);

  const { contract: paymentEscrowFactory } = deployProxyContract(
    m,
    "PaymentEscrowFactory",
    "__PaymentEscrowFactory_init",
    adminAddress,
    [ m.getAccount(0) ],
  );

  const pef = m.contractAt("PaymentEscrowFactory", paymentEscrowFactory, {id: "PaymentEscrowFactoryProxy"});

  m.call(pef, "setEscrowBeacon", [1, escrowV1Beacon], {id: "setEscrowV1Beacon"});
  m.call(pef, "transferOwnership", [adminAddress], {id: "transferOwnership"});

  return { paymentEscrowFactory, escrowV1Beacon };
});
