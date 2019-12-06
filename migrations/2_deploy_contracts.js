/* global artifacts */
const ArcaToken = artifacts.require('ArcaToken')
const ArcaTokenEscrow = artifacts.require('ArcaTokenEscrow')
const Proxy = artifacts.require("Proxy");

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(ArcaToken)
  await deployer.deploy(ArcaTokenEscrow)
  await deployer.deploy(Proxy, ArcaToken.address);
  const tokenInstance = await ArcaToken.at(Proxy.address)
  try {
    const puuid = await tokenInstance.proxiableUUID.call();
    console.log('arca token addr: ', ArcaToken.address, '\nproxy addr: ', Proxy.address, '\ntoken instance: ', tokenInstance.address, '\npuuid: ', Object.keys(puuid))

  } catch (e) {
    console.log('migr err ', e.message)
  }
}