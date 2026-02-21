// scripts/deploy.js – Deploy FlashLoanArbitrageV3 to any supported chain
const { ethers } = require('hardhat');
const { CHAINS }  = require('../engine/config');

async function main() {
  const chainName = process.env.CHAIN || 'ethereum';
  const chain     = CHAINS[chainName];
  if (!chain) throw new Error(`Unknown chain: ${chainName}`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying to ${chain.name} with account: ${deployer.address}`);

  const Factory = await ethers.getContractFactory('FlashLoanArbitrageV3');
  const contract = await Factory.deploy(
    chain.aavePoolAddressProvider,
    chain.uniswapV3Router,
    chain.sushiswapRouter
  );

  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`FlashLoanArbitrageV3 deployed to: ${addr}`);
  console.log(`Set ARB_CONTRACT_ADDRESS_${chainName.toUpperCase()}=${addr} in your .env`);
}

main().catch((e) => { console.error(e); process.exit(1); });
