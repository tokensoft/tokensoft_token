/* global artifacts contract it assert */
const { shouldFail, expectEvent } = require('openzeppelin-test-helpers')
const ArcaToken = artifacts.require('ArcaToken')
const Proxy = artifacts.require('Proxy')

const NO_WHITELIST = 0

contract('Whitelistable', (accounts) => {
  let tokenInstance, tokenDeploy, proxyInstance

  beforeEach(async () => {
    tokenDeploy = await ArcaToken.new()
    proxyInstance = await Proxy.new(tokenDeploy.address)
    tokenInstance = await ArcaToken.at(proxyInstance.address)
    await tokenInstance.initialize(accounts[0]);
  })

  it('should allow adding and removing an address to a whitelist', async () => {
    // First allow acct 1 be an administrator
    await tokenInstance.addAdmin(accounts[1], { from: accounts[0] })

    // Check acct 2 whitelist should default to NONE
    const existingWhitelist = await tokenInstance.addressWhitelists.call(accounts[2])
    assert.equal(existingWhitelist, NO_WHITELIST, 'Addresses should have no whitelist to start off with')

    // Add the acct 2 to whitelist 10 - using account 1
    await tokenInstance.addToWhitelist(accounts[2], 10, { from: accounts[1] })

    // Validate it got updated
    let updatedWhitelist = await tokenInstance.addressWhitelists.call(accounts[2])
    assert.equal(updatedWhitelist, 10, 'Addresses should have updated whitelist')

    // Update the whitelist for acct 2 to id 20
    await tokenInstance.addToWhitelist(accounts[2], 20, { from: accounts[1] })

    // Validate it got updated
    updatedWhitelist = await tokenInstance.addressWhitelists.call(accounts[2])
    assert.equal(updatedWhitelist, 20, 'Addresses should have updated whitelist after existing was changed')

    // Remove the address from whitelist
    await tokenInstance.removeFromWhitelist(accounts[2], { from: accounts[1] })

    // Validate it got updated
    updatedWhitelist = await tokenInstance.addressWhitelists.call(accounts[2])
    assert.equal(updatedWhitelist, NO_WHITELIST, 'Addresses should have been removed from whitelist')
  })

  it('should only allow admins adding or removing on whitelists', async () => {
    // Non admin should fail adding to white list
    await shouldFail.reverting(tokenInstance.addToWhitelist(accounts[2], 10, { from: accounts[4] }))

    // Now allow acct 4 be an administrator
    await tokenInstance.addAdmin(accounts[4], { from: accounts[0] })

    // Adding as admin should work
    await tokenInstance.addToWhitelist(accounts[2], 10, { from: accounts[4] })

    // Removing as non-admin should fail
    await shouldFail.reverting(tokenInstance.removeFromWhitelist(accounts[2], { from: accounts[8] }))

    // Removing as admin should work
    await tokenInstance.removeFromWhitelist(accounts[2], { from: accounts[4] })

    // Now remove acct 4 from the admin list
    await tokenInstance.removeAdmin(accounts[4], { from: accounts[0] })

    // It should fail again now that acct 4 is non-admin
    await shouldFail.reverting(tokenInstance.addToWhitelist(accounts[2], 10, { from: accounts[4] }))
  })

  it('should validate if addresses are not on a whitelist', async () => {
    // First allow acct 1 be an administrator
    await tokenInstance.addAdmin(accounts[1], { from: accounts[0] })

    // Allow whitelist 10 to send to self
    await tokenInstance.updateOutboundWhitelistEnabled(10, 10, true, { from: accounts[1] })

    // Two addresses not on any white list
    let isValid = await tokenInstance.checkWhitelistAllowed.call(accounts[6], accounts[7])
    assert.equal(isValid, false, 'Two non white listed addresses should not be valid')

    // Add address 6
    await tokenInstance.addToWhitelist(accounts[6], 10, { from: accounts[1] })

    // Only first address on white list should fail
    isValid = await tokenInstance.checkWhitelistAllowed.call(accounts[6], accounts[7])
    assert.equal(isValid, false, 'First non white listed addresses should not be valid')

    // Remove again
    await tokenInstance.removeFromWhitelist(accounts[6], { from: accounts[1] })

    // Both should fail again
    isValid = await tokenInstance.checkWhitelistAllowed.call(accounts[6], accounts[7])
    assert.equal(isValid, false, 'Two non white listed addresses should not be valid')

    // Add address 7
    await tokenInstance.addToWhitelist(accounts[7], 10, { from: accounts[1] })

    // Only second address on white list should fail
    isValid = await tokenInstance.checkWhitelistAllowed.call(accounts[6], accounts[7])
    assert.equal(isValid, false, 'Second non white listed addresses should not be valid')

    // Remove second addr
    await tokenInstance.removeFromWhitelist(accounts[7], { from: accounts[1] })

    // Both should fail again
    isValid = await tokenInstance.checkWhitelistAllowed.call(accounts[6], accounts[7])
    assert.equal(isValid, false, 'Two non white listed addresses should not be valid')

    // Add both 6 and 7
    await tokenInstance.addToWhitelist(accounts[6], 10, { from: accounts[1] })
    await tokenInstance.addToWhitelist(accounts[7], 10, { from: accounts[1] })

    // Should be valid
    isValid = await tokenInstance.checkWhitelistAllowed.call(accounts[6], accounts[7])
    assert.equal(isValid, true, 'Both on same white list should be valid')

    // Update address 6 to a different white list
    await tokenInstance.addToWhitelist(accounts[6], 20, { from: accounts[1] })

    // Should fail
    isValid = await tokenInstance.checkWhitelistAllowed.call(accounts[6], accounts[7])
    assert.equal(isValid, false, 'Two addresses on separate white lists should not be valid')
  })

  it('should trigger events', async () => {
    // First allow acct 1 to be an administrator
    await tokenInstance.addAdmin(accounts[1], { from: accounts[0] })

    // Check for initial add
    let ret = await tokenInstance.addToWhitelist(accounts[3], 20, { from: accounts[1] })
    expectEvent.inLogs(ret.logs, 'AddressAddedToWhitelist', { addedAddress: accounts[3], whitelist: '20', addedBy: accounts[1] })

    // Adding to second whitelist should remove from first and add to second
    ret = await tokenInstance.addToWhitelist(accounts[3], 30, { from: accounts[1] })
    expectEvent.inLogs(ret.logs, 'AddressRemovedFromWhitelist', { removedAddress: accounts[3], whitelist: '20', removedBy: accounts[1] })
    expectEvent.inLogs(ret.logs, 'AddressAddedToWhitelist', { addedAddress: accounts[3], whitelist: '30', addedBy: accounts[1] })

    // Removing from list should just trigger removal
    ret = await tokenInstance.removeFromWhitelist(accounts[3], { from: accounts[1] })
    expectEvent.inLogs(ret.logs, 'AddressRemovedFromWhitelist', { removedAddress: accounts[3], whitelist: '30', removedBy: accounts[1] })
  })

  it('should validate outbound whitelist enabled flag', async () => {
    // Allow acct 1 to be an admin
    await tokenInstance.addAdmin(accounts[1], { from: accounts[0] })

    // Default should be disabled to self
    let existingOutboundEnabled = await tokenInstance.outboundWhitelistsEnabled.call(4, 4)
    assert.equal(existingOutboundEnabled, false, 'Default outbound should be disabled to self')

    // Default should be disabled to other random ID
    existingOutboundEnabled = await tokenInstance.outboundWhitelistsEnabled.call(4, 5)
    assert.equal(existingOutboundEnabled, false, 'Default outbound should be disabled to other')

    // Update so 4 is allowed to send to self
    await tokenInstance.updateOutboundWhitelistEnabled(4, 4, true, { from: accounts[1] })
    existingOutboundEnabled = await tokenInstance.outboundWhitelistsEnabled.call(4, 4)
    assert.equal(existingOutboundEnabled, true, 'Should be enabled')

    // 4 to 5 should still be disabled
    existingOutboundEnabled = await tokenInstance.outboundWhitelistsEnabled.call(4, 5)
    assert.equal(existingOutboundEnabled, false, 'Should be disabled')

    // Allow 4 to 5
    await tokenInstance.updateOutboundWhitelistEnabled(4, 5, true, { from: accounts[1] })
    existingOutboundEnabled = await tokenInstance.outboundWhitelistsEnabled.call(4, 5)
    assert.equal(existingOutboundEnabled, true, 'Should be enabled')

    // Backwards should fail
    existingOutboundEnabled = await tokenInstance.outboundWhitelistsEnabled.call(5, 4)
    assert.equal(existingOutboundEnabled, false, 'Should be disabled')

    // 5 should still not be able to send to self
    existingOutboundEnabled = await tokenInstance.outboundWhitelistsEnabled.call(5, 5)
    assert.equal(existingOutboundEnabled, false, 'Should be disabled')

    // Disable 4 to 5
    await tokenInstance.updateOutboundWhitelistEnabled(4, 5, false, { from: accounts[1] })
    existingOutboundEnabled = await tokenInstance.outboundWhitelistsEnabled.call(4, 5)
    assert.equal(existingOutboundEnabled, false, 'Should be disabled')

    // Disable 4 to self
    await tokenInstance.updateOutboundWhitelistEnabled(4, 4, false, { from: accounts[1] })
    existingOutboundEnabled = await tokenInstance.outboundWhitelistsEnabled.call(4, 4)
    assert.equal(existingOutboundEnabled, false, 'Should be disabled')
  })

  it('should trigger events for whitelist enable/disable', async () => {
    await tokenInstance.addAdmin(accounts[1], { from: accounts[0] })

    // Verify logs for enabling outbound
    let ret = await tokenInstance.updateOutboundWhitelistEnabled(90, 100, true, { from: accounts[1] })
    expectEvent.inLogs(ret.logs, 'OutboundWhitelistUpdated', { updatedBy: accounts[1], sourceWhitelist: '90', destinationWhitelist: '100', from: false, to: true })

    // Verify logs for disabling outbound
    ret = await tokenInstance.updateOutboundWhitelistEnabled(90, 100, false, { from: accounts[1] })
    expectEvent.inLogs(ret.logs, 'OutboundWhitelistUpdated', { updatedBy: accounts[1], sourceWhitelist: '90', destinationWhitelist: '100', from: true, to: false })

    // Verify doing same thihng
    ret = await tokenInstance.updateOutboundWhitelistEnabled(90, 100, false, { from: accounts[1] })
    expectEvent.inLogs(ret.logs, 'OutboundWhitelistUpdated', { updatedBy: accounts[1], sourceWhitelist: '90', destinationWhitelist: '100', from: false, to: false })
  })

  it('should not allow adding an address to invalid whitelist ID (0)', async () => {
    // First allow acct 1 be an administrator
    await tokenInstance.addAdmin(accounts[1], { from: accounts[0] })

    // Adding acct 2 to whitelist 0 should get rejected
    await shouldFail.reverting(tokenInstance.addToWhitelist(accounts[2], NO_WHITELIST, { from: accounts[1] }))
  })
})
