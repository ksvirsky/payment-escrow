import { ethers } from "hardhat";
import hre from "hardhat";

export const now = () => Math.floor(+new Date() / 1000);
export const latestTimestamp = async () => (await ethers.provider.getBlock("latest"))!.timestamp;
export const shiftTimeBy = async (seconds: number) => {
  await hre.network.provider.send("evm_increaseTime", [seconds]);
  return hre.network.provider.send("evm_mine");
};

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export async function deployBeaconWithImpl(implName: string, adminAddress: string) {
  const Impl = await ethers.getContractFactory(implName);
  const Beacon = await ethers.getContractFactory("UpgradeableBeacon");

  const beaconTarget = await Impl.deploy();

  const beacon = await Beacon.deploy(await beaconTarget.getAddress(), adminAddress);

  return { beacon, beaconTarget };
}

export async function deployProxy<T>(implName: string, paramList: any[], adminAddress: string, initName = "initialize") {
  const Impl = await ethers.getContractFactory(implName);
  const Proxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
  const instance = await Impl.deploy();

  const data = instance.interface.encodeFunctionData(initName, paramList);

  const proxy = await Proxy.deploy(await instance.getAddress(), adminAddress, data);
  const contract = await ethers.getContractAt(implName, await proxy.getAddress());

  return contract as T;
}
