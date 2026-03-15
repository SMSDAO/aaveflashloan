// scripts/deploy.js – Deploy FlashLoanArbitrageV3 to any supported chain
const { ethers, network } = require('hardhat');
const { CHAINS }  = require('../engine/config');

async function main() {
  // Derive chain name from the hardhat --network flag (falls back to CHAIN env var).
  const chainName = CHAINS[network.name] ? network.name : (process.env.CHAIN || 'ethereum');
  const chain     = CHAINS[chainName];
  if (!chain) throw new Error(`Unknown chain: ${chainName}. Valid: ${Object.keys(CHAINS).join(', ')}`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying to ${chain.name} with account: ${deployer.address}`);

  const nativeSymbol = chain.nativeSymbol || 'native';
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} ${nativeSymbol}`);

  const Factory = await ethers.getContractFactory('FlashLoanArbitrageV3');
  const contract = await Factory.deploy(
    chain.aavePoolAddressProvider,
    chain.uniswapV3Router,
    chain.sushiswapRouter
  );

  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`FlashLoanArbitrageV3 deployed to: ${addr}`);
  console.log(`\nAdd to your .env:`);
  console.log(`ARB_CONTRACT_ADDRESS_${chainName.toUpperCase()}=${addr}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
