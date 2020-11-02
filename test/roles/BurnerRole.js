/* global artifacts contract it assert */
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const TokenSoftToken = artifacts.require('TokenSoftTokenV2')
const Proxy = artifacts.require('Proxy')
const Constants = require('../Constants')

/**
 * Sanity checks for managing the Burner Role
 */
contract('BurnerRole', (accounts) => {
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

  it('should allow an owner to add/remove burners', async () => {
    // Should start out as false
    let isBurner1 = await tokenInstance.isBurner(accounts[1])
    assert.equal(isBurner1, false, 'Account 1 should not be a burner by default')

    // Add it and verify
    await tokenInstance.addBurner(accounts[1])
    isBurner1 = await tokenInstance.isBurner(accounts[1])
    assert.equal(isBurner1, true, 'Account 1 should be a burner')

    // Remove it and verify
    await tokenInstance.removeBurner(accounts[1])
    isBurner1 = await tokenInstance.isBurner(accounts[1])
    assert.equal(isBurner1, false, 'Account 1 should not be a burner')
  })

  it('should not allow a non owner to add/remove burners', async () => {
    // Prove it can't be added by account 3
    await expectRevert(tokenInstance.addBurner(accounts[4], { from: accounts[3] }), "OwnerRole: caller does not have the Owner role")
    
    // Add it with owner
    await tokenInstance.addBurner(accounts[4])

    // Prove it can't be removed by account 3
    await expectRevert(tokenInstance.removeBurner(accounts[4], { from: accounts[3] }), "OwnerRole: caller does not have the Owner role")

    // Remove it with the owner
    tokenInstance.removeBurner(accounts[4])
  })

  it('should emit events for adding burners', async () => {
    const { logs } = await tokenInstance.addBurner(accounts[3], { from: accounts[0] })
    expectEvent.inLogs(logs, 'BurnerAdded', { addedBurner: accounts[3], addedBy: accounts[0] })
  })

  it('should emit events for removing burners', async () => {
    await tokenInstance.addBurner(accounts[3])
    const { logs } = await tokenInstance.removeBurner(accounts[3])

    expectEvent.inLogs(logs, 'BurnerRemoved', { removedBurner: accounts[3], removedBy: accounts[0] })
  })

  it('owner can add and remove themselves', async () => {    
    // Add it
    await tokenInstance.addBurner(accounts[0])
    let isBurner1 = await tokenInstance.isBurner(accounts[0])
    assert.equal(isBurner1, true, 'Account 0 should be a burner')

    // Remove it 
    tokenInstance.removeBurner(accounts[0])
    isBurner1 = await tokenInstance.isBurner(accounts[0])
    assert.equal(isBurner1, false, 'Account 0 should not be a burner')
  })
})
