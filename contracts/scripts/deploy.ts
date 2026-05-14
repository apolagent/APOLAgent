import * as hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const network = hre.network.name;
  console.log(`Deploying ApolCertification to ${network}...`);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");

  const factory = await hre.ethers.getContractFactory("ApolCertification");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("ApolCertification deployed to:", address);

  const deployed = {
    address,
    network,
    deployedAt: new Date().toISOString(),
  };

  const outPath = path.join(__dirname, "..", "deployed.json");
  fs.writeFileSync(outPath, JSON.stringify(deployed, null, 2));
  console.log("Deployment info saved to deployed.json");

  if (network === "hardhat" || network === "localhost") {
    console.log("Skipping Basescan verification on local network.");
    return;
  }

  console.log("Waiting 15s for Basescan to index the deployment...");
  await new Promise(resolve => setTimeout(resolve, 15_000));

  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments: [],
    });
    console.log("Contract verified on Basescan.");
  } catch (e: any) {
    if (e?.message?.toLowerCase().includes("already verified")) {
      console.log("Contract already verified.");
    } else {
      console.error("Verification failed:", e.message);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
