/* global artifacts */
const ArcaToken = artifacts.require('ArcaToken')
const ArcaTokenEscrow = artifacts.require('ArcaTokenEscrow')
const Proxy = artifacts.require("Proxy");

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(ArcaToken)
  await deployer.deploy(ArcaTokenEscrow)
  await deployer.deploy(Proxy, ArcaToken.address);
  await ArcaToken.at(Proxy.address)
}