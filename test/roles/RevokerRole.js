/* global artifacts contract it assert */
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const TokenSoftToken = artifacts.require('TokenSoftTokenV2')
const Proxy = artifacts.require('Proxy')
const Constants = require('../Constants')

/**
 * Sanity checks for managing the Revoker Role
 */
contract('RevokerRole', (accounts) => {
  let tokenInstance, tokenDeploy, proxyInstance

  beforeEach(async () => {
    tokenDeploy = await TokenSoftToken.new()
    proxyInstance = await Proxy.new(tokenDeploy.address)
    tokenInstance = await TokenSoftToken.at(proxyInstance.address)
    await tokenInstance.initialize(
      accounts[0],
      Constants.name,
      Constants.symbol,
      Constants.decimals,
      Constants.supply,
      true);
  })

  it('should allow an owner to add/remove revokers', async () => {
    // Should start out as false
    let isRevoker1 = await tokenInstance.isRevoker(accounts[1])
    assert.equal(isRevoker1, false, 'Account 1 should not be a revoker by default')

    // Add it and verify
    await tokenInstance.addRevoker(accounts[1])
    isRevoker1 = await tokenInstance.isRevoker(accounts[1])
    assert.equal(isRevoker1, true, 'Account 1 should be a revoker')

    // Remove it and verify
    await tokenInstance.removeRevoker(accounts[1])
    isRevoker1 = await tokenInstance.isRevoker(accounts[1])
    assert.equal(isRevoker1, false, 'Account 1 should not be a revoker')
  })

  it('should not allow a non owner to add/remove revokers', async () => {
    // Prove it can't be added by account 3
    await expectRevert(tokenInstance.addRevoker(accounts[4], { from: accounts[3] }), "OwnerRole: caller does not have the Owner role")
    
    // Add it with owner
    await tokenInstance.addRevoker(accounts[4])

    // Prove it can't be removed by account 3
    await expectRevert(tokenInstance.removeRevoker(accounts[4], { from: accounts[3] }), "OwnerRole: caller does not have the Owner role")

    // Remove it with the owner
    tokenInstance.removeRevoker(accounts[4])
  })

  it('should emit events for adding revokers', async () => {
    const { logs } = await tokenInstance.addRevoker(accounts[3], { from: accounts[0] })
    expectEvent.inLogs(logs, 'RevokerAdded', { addedRevoker: accounts[3], addedBy: accounts[0] })
  })

  it('should emit events for removing revokers', async () => {
    await tokenInstance.addRevoker(accounts[3])
    const { logs } = await tokenInstance.removeRevoker(accounts[3])

    expectEvent.inLogs(logs, 'RevokerRemoved', { removedRevoker: accounts[3], removedBy: accounts[0] })
  })

  it('owner can add and remove themselves', async () => {    
    // Add it
    await tokenInstance.addRevoker(accounts[0])
    let isRevoker1 = await tokenInstance.isRevoker(accounts[0])
    assert.equal(isRevoker1, true, 'Account 0 should be a revoker')

    // Remove it 
    tokenInstance.removeRevoker(accounts[0])
    isRevoker1 = await tokenInstance.isRevoker(accounts[0])
    assert.equal(isRevoker1, false, 'Account 0 should not be a revoker')
  })
})
