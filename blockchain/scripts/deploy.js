const hre = require("hardhat");

async function main() {
  console.log("Deploying HealthRecords contract...");

  const HealthRecords = await hre.ethers.getContractFactory("HealthRecords");
  const healthRecords = await HealthRecords.deploy();

  await healthRecords.waitForDeployment();

  const address = await healthRecords.getAddress();
  console.log("HealthRecords deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});