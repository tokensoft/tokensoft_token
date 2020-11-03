/* global artifacts */
const TokenSoftToken = artifacts.require('TokenSoftTokenV2')
const TokenSoftTokenEscrow = artifacts.require('TokenSoftTokenEscrow')
const Proxy = artifacts.require("Proxy");

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(TokenSoftToken)
  await deployer.deploy(TokenSoftTokenEscrow)
  await deployer.deploy(Proxy, TokenSoftToken.address);
  await TokenSoftToken.at(Proxy.address)
}