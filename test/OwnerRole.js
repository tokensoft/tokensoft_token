/* global artifacts contract it assert */
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const TokenSoftToken = artifacts.require('TokenSoftToken')
const Proxy = artifacts.require('Proxy')

/**
 * Sanity check for transferring ownership.  Most logic is fully tested in OpenZeppelin lib.
 */
contract('OwnerRole', (accounts) => {
  let tokenInstance, tokenDeploy, proxyInstance

  beforeEach(async () => {
    tokenDeploy = await TokenSoftToken.new()
    proxyInstance = await Proxy.new(tokenDeploy.address)
    tokenInstance = await TokenSoftToken.at(proxyInstance.address)
    await tokenInstance.initialize(accounts[0]);
  })

  it('should allow an owner to add/remove owners', async () => {
    // Should have been updated
    await tokenInstance.addOwner(accounts[1], { from: accounts[0] })
    let isOwner1 = await tokenInstance.isOwner(accounts[1])
    assert.equal(isOwner1, true, 'Account 1 should be an owner')

    await tokenInstance.removeOwner(accounts[1], { from: accounts[0] })
    isOwner1 = await tokenInstance.isOwner(accounts[1])
    assert.equal(isOwner1, false, 'Account 1 should not be an owner')
  })

  it('should not allow an owner to remove itself', async () => {
    await expectRevert.unspecified(tokenInstance.removeOwner(accounts[0], { from: accounts[0] }))
  })

  it('should not allow a non owner to add/remove owners', async () => {
    const adminAccount = accounts[1]
    const whitelistedAccount = accounts[2]
    const nonWhitelistedAccount = accounts[3]

    await tokenInstance.addAdmin(adminAccount, { from: accounts[0] })
    await tokenInstance.addToWhitelist(whitelistedAccount, 1, { from: accounts[1] })

    await expectRevert.unspecified(tokenInstance.addOwner(accounts[4], { from: adminAccount }))
    await expectRevert.unspecified(tokenInstance.addOwner(accounts[4], { from: whitelistedAccount }))
    await expectRevert.unspecified(tokenInstance.addOwner(accounts[4], { from: nonWhitelistedAccount }))
    await tokenInstance.addOwner(accounts[4], { from: accounts[0] })
    await expectRevert.unspecified(tokenInstance.removeOwner(accounts[4], { from: adminAccount }))
    await expectRevert.unspecified(tokenInstance.removeOwner(accounts[4], { from: whitelistedAccount }))
    await expectRevert.unspecified(tokenInstance.removeOwner(accounts[4], { from: nonWhitelistedAccount }))
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
