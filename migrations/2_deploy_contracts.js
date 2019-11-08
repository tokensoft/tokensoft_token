/* global artifacts */
const ArcaToken = artifacts.require('ArcaToken')

module.exports = function (deployer, network, accounts) {
  deployer.deploy(ArcaToken, accounts[0])
}
