export const deployBeaconWithImpl = (m: any, contractName: string, adminAddress: any) => {
  const impl = m.contract(contractName, undefined, {id: `${contractName}Impl`});
  const beacon = m.contract("UpgradeableBeacon", [impl, adminAddress], {id: `${contractName}Beacon`});

  return { impl, beacon };
};

export const upgradeBeaconWithImpl = (m: any, contractName: string, beaconAddress: any) => {
  const impl = m.contract(contractName, undefined, {id: `${contractName}Impl`});
  const beacon = m.contractAt("UpgradeableBeacon", beaconAddress);

  m.call(beacon, "upgradeTo", [impl]);

  return { impl, beacon };
};

export const deployProxyContract = (
  m: any,
  contractName: string,
  initMethodName: string,
  adminAddress: any,
  params: any[],
) => {
  const impl = m.contract(contractName, undefined, {id: `${contractName}Impl`});
  const data = m.encodeFunctionCall(impl, initMethodName, params);

  const contract = m.contract("TransparentUpgradeableProxy", [
    impl,
    adminAddress,
    data,
  ], {id: contractName});

  const proxyAdminAddress = m.readEventArgument(
    contract,
    "AdminChanged",
    "newAdmin",
    {id: `${contractName}NewAdmin`}
  );

  const proxyAdminContract = m.contractAt("ProxyAdmin", proxyAdminAddress, {id: `${contractName}ProxyAdmin`});

  return { contract, proxyAdminContract };
};
