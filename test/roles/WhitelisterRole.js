/* global artifacts contract it assert */
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const TokenSoftToken = artifacts.require('TokenSoftTokenV2')
const Proxy = artifacts.require('Proxy')
const Constants = require('../Constants')

/**
 * Sanity checks for managing the Whitelister Role
 */
contract('WhitelisterRole', (accounts) => {
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

  it('should allow an owner to add/remove whitelisters', async () => {
    // Should start out as false
    let isWhitelister1 = await tokenInstance.isWhitelister(accounts[1])
    assert.equal(isWhitelister1, false, 'Account 1 should not be a whitelister by default')

    // Add it and verify
    await tokenInstance.addWhitelister(accounts[1])
    isWhitelister1 = await tokenInstance.isWhitelister(accounts[1])
    assert.equal(isWhitelister1, true, 'Account 1 should be a whitelister')

    // Remove it and verify
    await tokenInstance.removeWhitelister(accounts[1])
    isWhitelister1 = await tokenInstance.isWhitelister(accounts[1])
    assert.equal(isWhitelister1, false, 'Account 1 should not be a whitelister')
  })

  it('should not allow a non owner to add/remove whitelisters', async () => {
    // Prove it can't be added by account 3
    await expectRevert(tokenInstance.addWhitelister(accounts[4], { from: accounts[3] }), "OwnerRole: caller does not have the Owner role")
    
    // Add it with owner
    await tokenInstance.addWhitelister(accounts[4])

    // Prove it can't be removed by account 3
    await expectRevert(tokenInstance.removeWhitelister(accounts[4], { from: accounts[3] }), "OwnerRole: caller does not have the Owner role")

    // Remove it with the owner
    tokenInstance.removeWhitelister(accounts[4])
  })

  it('should emit events for adding whitelisters', async () => {
    const { logs } = await tokenInstance.addWhitelister(accounts[3], { from: accounts[0] })
    expectEvent.inLogs(logs, 'WhitelisterAdded', { addedWhitelister: accounts[3], addedBy: accounts[0] })
  })

  it('should emit events for removing whitelisters', async () => {
    await tokenInstance.addWhitelister(accounts[3])
    const { logs } = await tokenInstance.removeWhitelister(accounts[3])

    expectEvent.inLogs(logs, 'WhitelisterRemoved', { removedWhitelister: accounts[3], removedBy: accounts[0] })
  })

  it('owner can add and remove themselves', async () => {    
    // Add it
    await tokenInstance.addWhitelister(accounts[0])
    let isWhitelister1 = await tokenInstance.isWhitelister(accounts[0])
    assert.equal(isWhitelister1, true, 'Account 0 should be a whitelister')

    // Remove it 
    tokenInstance.removeWhitelister(accounts[0])
    isWhitelister1 = await tokenInstance.isWhitelister(accounts[0])
    assert.equal(isWhitelister1, false, 'Account 0 should not be a whitelister')
  })  
})
