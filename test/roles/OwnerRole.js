/* global artifacts contract it assert */
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const TokenSoftToken = artifacts.require('TokenSoftTokenV2')
const Proxy = artifacts.require('Proxy')
const Constants = require('../Constants')

/**
 * Sanity check for transferring ownership.  Most logic is fully tested in OpenZeppelin lib.
 */
contract('OwnerRole', (accounts) => {
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

  it('should allow an owner to add/remove owners', async () => {
    // Should start out as false
    let isOwner1 = await tokenInstance.isOwner(accounts[1])
    assert.equal(isOwner1, false, 'Account 1 should not be an owner by default')

    // Should have been updated
    await tokenInstance.addOwner(accounts[1], { from: accounts[0] })
    isOwner1 = await tokenInstance.isOwner(accounts[1])
    assert.equal(isOwner1, true, 'Account 1 should be an owner')

    await tokenInstance.removeOwner(accounts[1], { from: accounts[0] })
    isOwner1 = await tokenInstance.isOwner(accounts[1])
    assert.equal(isOwner1, false, 'Account 1 should not be an owner')
  })

  it('should allow an owner to remove itself', async () => {
    await tokenInstance.removeOwner(accounts[0], { from: accounts[0] })
  })

  it('should not allow a non owner to add/remove owners', async () => {
    // Prove it can't be added by account 3
    await expectRevert(tokenInstance.addOwner(accounts[4], { from: accounts[3] }), "OwnerRole: caller does not have the Owner role")

    // Verify a 0x0 address can't be added
    await expectRevert(tokenInstance.addOwner("0x0000000000000000000000000000000000000000"), "Invalid 0x0 address")
    
    // Add it with owner
    await tokenInstance.addOwner(accounts[4])

    // Prove it can't be removed by account 3
    await expectRevert(tokenInstance.removeOwner(accounts[4], { from: accounts[3] }), "OwnerRole: caller does not have the Owner role")

    // Remove it with the owner
    tokenInstance.removeOwner(accounts[4])
  })

  it('should emit events for adding owners', async () => {
    const { logs } = await tokenInstance.addOwner(accounts[3], { from: accounts[0] })
    expectEvent.inLogs(logs, 'OwnerAdded', { addedOwner: accounts[3], addedBy: accounts[0] })
  })

  it('should emit events for removing owners', async () => {
    await tokenInstance.addOwner(accounts[3], { from: accounts[0] })
    const { logs } = await tokenInstance.removeOwner(accounts[3], { from: accounts[0] })

    expectEvent.inLogs(logs, 'OwnerRemoved', { removedOwner: accounts[3], removedBy: accounts[0] })
  })
})
