/* global artifacts contract it assert */
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const TokenSoftToken = artifacts.require('TokenSoftTokenV2')
const Proxy = artifacts.require('Proxy')
const Constants = require('../Constants')

/**
 * Sanity checks for managing the Minter Role
 */
contract('MinterRole', (accounts) => {
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

  it('should allow an owner to add/remove minters', async () => {
    // Should start out as false
    let isMinter1 = await tokenInstance.isMinter(accounts[1])
    assert.equal(isMinter1, false, 'Account 1 should not be a minter by default')

    // Add it and verify
    await tokenInstance.addMinter(accounts[1])
    isMinter1 = await tokenInstance.isMinter(accounts[1])
    assert.equal(isMinter1, true, 'Account 1 should be a minter')

    // Remove it and verify
    await tokenInstance.removeMinter(accounts[1])
    isMinter1 = await tokenInstance.isMinter(accounts[1])
    assert.equal(isMinter1, false, 'Account 1 should not be a minter')
  })

  it('should not allow a non owner to add/remove minters', async () => {
    // Prove it can't be added by account 3
    await expectRevert(tokenInstance.addMinter(accounts[4], { from: accounts[3] }), "OwnerRole: caller does not have the Owner role")
    
    // Add it with owner
    await tokenInstance.addMinter(accounts[4])

    // Prove it can't be removed by account 3
    await expectRevert(tokenInstance.removeMinter(accounts[4], { from: accounts[3] }), "OwnerRole: caller does not have the Owner role")

    // Remove it with the owner
    tokenInstance.removeMinter(accounts[4])
  })

  it('should emit events for adding minters', async () => {
    const { logs } = await tokenInstance.addMinter(accounts[3], { from: accounts[0] })
    expectEvent.inLogs(logs, 'MinterAdded', { addedMinter: accounts[3], addedBy: accounts[0] })
  })

  it('should emit events for removing minters', async () => {
    await tokenInstance.addMinter(accounts[3])
    const { logs } = await tokenInstance.removeMinter(accounts[3])

    expectEvent.inLogs(logs, 'MinterRemoved', { removedMinter: accounts[3], removedBy: accounts[0] })
  })

  it('owner can add and remove themselves', async () => {    
    // Add it
    await tokenInstance.addMinter(accounts[0])
    let isMinter1 = await tokenInstance.isMinter(accounts[0])
    assert.equal(isMinter1, true, 'Account 0 should be a minter')

    // Remove it 
    tokenInstance.removeMinter(accounts[0])
    isMinter1 = await tokenInstance.isMinter(accounts[0])
    assert.equal(isMinter1, false, 'Account 0 should not be a minter')
  })
})
