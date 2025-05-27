import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const privateKey = process.env.DEPLOYER_KEY?.trim() || "0x0";

const config: HardhatUserConfig = {
  networks: {
    amoy: {
      url: "https://rpc-amoy.polygon.technology/",
      chainId: 80002,
      gasPrice: 10000000,
      blockGasLimit: 3000000,
      gas: 3000000,
      accounts: [privateKey],
    },
  },

  solidity: "0.8.30",
};

export default config;
