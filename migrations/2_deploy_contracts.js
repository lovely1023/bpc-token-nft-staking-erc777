const {singletons } = require('@openzeppelin/test-helpers');
require('@openzeppelin/test-helpers/configure')({ provider: web3.currentProvider, environment: 'truffle' });

const BPC = artifacts.require('BPC');
const IterableMapping = artifacts.require('IterableMapping');
const ExternalFuncs = artifacts.require('ExternalFuncs');
const BPCLottery = artifacts.require('BPCLottery')
const BPCStaking = artifacts.require('BPCStaking');

module.exports = async (deployer, network, accounts) => {

  if (network === 'development') {
    // In a test environment an ERC777 token requires deploying an ERC1820 registry
    await singletons.ERC1820Registry(accounts[0]);
  }

  await deployer.deploy(IterableMapping);
  await IterableMapping.deployed();
  await deployer.deploy(ExternalFuncs);
  await ExternalFuncs.deployed();

  deployer.link(IterableMapping, BPCStaking);
  deployer.link(ExternalFuncs, BPCStaking);
  deployer.link(ExternalFuncs, BPCLottery);

  const deployer_address = accounts[1];
  const admin_address = accounts[4];
  const company_address_1 = accounts[2];
  const company_address_2 = accounts[3];

  await deployer.deploy(
      BPCStaking,
      "BPCStaking",
      "BPCS",
      "25",
      '150000000000000000000000000',
      company_address_1,
      {from:deployer_address});
  const staking = await BPCStaking.deployed();

  await deployer.deploy(
      BPCLottery,
      "BPCLottery",
      "BPCL",
      "0",
      company_address_2,
      {from:deployer_address});
  const lottery = await BPCLottery.deployed();

  await deployer.deploy(
      BPC,
      "BigPictureToken",
      "BPC",
      [staking.address, lottery.address],
      "6639068860000000000000000000",
      "3319534430000000000000000000",
      "0", "0",
      admin_address,
      company_address_2,
      {from:deployer_address});
  const bpc = await BPC.deployed();

  if (deployer_address != admin_address) {
    await staking.transferOwnership(admin_address, {from: deployer_address});
    await lottery.transferOwnership(admin_address, {from: deployer_address});
  }

  await staking.setERC777(bpc.address, {from: admin_address});
  await lottery.setERC777(bpc.address, {from: admin_address});
  console.log('BPC Token was set successfully for both Staking and Lottery');
}
