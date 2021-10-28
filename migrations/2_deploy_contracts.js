/* global artifacts */
const TokenSoftToken = artifacts.require('TokenSoftTokenV3')
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function (deployer) {
  await deployer.deploy(TokenSoftToken)
  const instance = await deployProxy(TokenSoftToken, ['0x5302D2bC80477304c0512c31aD847ae62094000d', "Wrapped Kadena", "wKDA",12,0], { deployer });
  console.log('Deployed', instance.address);
};