/* global artifacts contract it assert */
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const TokenSoftToken = artifacts.require('TokenSoftTokenV2')
const Proxy = artifacts.require('Proxy')
const Constants = require('../Constants')

/**
 * Sanity checks for managing the Pauser Role
 */
contract('PauserRole', (accounts) => {
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

  it('should allow an owner to add/remove pausers', async () => {
    // Should start out as false
    let isPauser1 = await tokenInstance.isPauser(accounts[1])
    assert.equal(isPauser1, false, 'Account 1 should not be a pauser by default')

    // Add it and verify
    await tokenInstance.addPauser(accounts[1])
    isPauser1 = await tokenInstance.isPauser(accounts[1])
    assert.equal(isPauser1, true, 'Account 1 should be a pauser')

    // Remove it and verify
    await tokenInstance.removePauser(accounts[1])
    isPauser1 = await tokenInstance.isPauser(accounts[1])
    assert.equal(isPauser1, false, 'Account 1 should not be a pauser')
  })

  it('should not allow a non owner to add/remove pausers', async () => {
    // Prove it can't be added by account 3
    await expectRevert(tokenInstance.addPauser(accounts[4], { from: accounts[3] }), "OwnerRole: caller does not have the Owner role")
    
    // Add it with owner
    await tokenInstance.addPauser(accounts[4])

    // Prove it can't be removed by account 3
    await expectRevert(tokenInstance.removePauser(accounts[4], { from: accounts[3] }), "OwnerRole: caller does not have the Owner role")

    // Remove it with the owner
    tokenInstance.removePauser(accounts[4])
  })

  it('should emit events for adding pausers', async () => {
    const { logs } = await tokenInstance.addPauser(accounts[3], { from: accounts[0] })
    expectEvent.inLogs(logs, 'PauserAdded', { addedPauser: accounts[3], addedBy: accounts[0] })
  })

  it('should emit events for removing pausers', async () => {
    await tokenInstance.addPauser(accounts[3])
    const { logs } = await tokenInstance.removePauser(accounts[3])

    expectEvent.inLogs(logs, 'PauserRemoved', { removedPauser: accounts[3], removedBy: accounts[0] })
  })

  it('owner can add and remove themselves', async () => {    
    // Add it
    await tokenInstance.addPauser(accounts[0])
    let isPauser1 = await tokenInstance.isPauser(accounts[0])
    assert.equal(isPauser1, true, 'Account 0 should be a pauser')

    // Remove it 
    tokenInstance.removePauser(accounts[0])
    isPauser1 = await tokenInstance.isPauser(accounts[0])
    assert.equal(isPauser1, false, 'Account 0 should not be a pauser')
  })
})
