/* global artifacts contract it assert */
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const TokenSoftToken = artifacts.require('TokenSoftTokenV2')
const Proxy = artifacts.require('Proxy')
const Constants = require('../Constants')

const NO_WHITELIST = 0

contract('Whitelistable', (accounts) => {
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

  it('should allow adding and removing an address to a whitelist', async () => {
    // First allow acct 1 be an administrator
    await tokenInstance.addWhitelister(accounts[1], { from: accounts[0] })

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
    await expectRevert(
      tokenInstance.addToWhitelist(accounts[2], 10, { from: accounts[4] }),
      "WhitelisterRole: caller does not have the Whitelister role")

    // Now allow acct 4 be an administrator
    await tokenInstance.addWhitelister(accounts[4], { from: accounts[0] })

    // Adding as admin should work
    await tokenInstance.addToWhitelist(accounts[2], 10, { from: accounts[4] })

    // Removing as non-admin should fail
    await expectRevert(
      tokenInstance.removeFromWhitelist(accounts[2], { from: accounts[8] }),
      "WhitelisterRole: caller does not have the Whitelister role")

    // Removing as admin should work
    await tokenInstance.removeFromWhitelist(accounts[2], { from: accounts[4] })

    // Now remove acct 4 from the admin list
    await tokenInstance.removeWhitelister(accounts[4], { from: accounts[0] })

    // It should fail again now that acct 4 is non-admin
    await expectRevert(
      tokenInstance.addToWhitelist(accounts[2], 10, { from: accounts[4] }),
      "WhitelisterRole: caller does not have the Whitelister role")
  })

  it('should validate if addresses are not on a whitelist', async () => {
    // First allow acct 1 be an administrator
    await tokenInstance.addWhitelister(accounts[1], { from: accounts[0] })

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
    await tokenInstance.addWhitelister(accounts[1], { from: accounts[0] })

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
    await tokenInstance.addWhitelister(accounts[1], { from: accounts[0] })

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
    await tokenInstance.addWhitelister(accounts[1], { from: accounts[0] })

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
    await tokenInstance.addWhitelister(accounts[1], { from: accounts[0] })

    // Adding acct 2 to whitelist 0 should get rejected
    await expectRevert(
      tokenInstance.addToWhitelist(accounts[2], NO_WHITELIST, { from: accounts[1] }), 
      "Invalid whitelist ID supplied"
    )
  })

  it('should not allow adding or removing address 0x0', async () => {
    // First allow acct 0 be an administrator
    await tokenInstance.addWhitelister(accounts[0], { from: accounts[0] })

    await expectRevert(
      tokenInstance.addToWhitelist(
        "0x0000000000000000000000000000000000000000",
        1,
        { from: accounts[0] }
      ), 
      "Cannot add address 0x0 to a whitelist."
    )

    await expectRevert(
      tokenInstance.removeFromWhitelist(
        "0x0000000000000000000000000000000000000000",
        { from: accounts[0] }
      ), 
      "Cannot remove address 0x0 from a whitelist."
    )
  })

  it('should allow disabling and re-enabling the whitelist logic', async () => {
    // First allow acct 1 be whitelister
    await tokenInstance.addWhitelister(accounts[1], { from: accounts[0] })

    // Send some tokens to account 2
    await tokenInstance.transfer(accounts[2], 1000)

    // Verify accounts can't transfer
    await expectRevert(
      tokenInstance.transfer(accounts[3], 100, { from: accounts[2] }), 
      "The transfer was restricted due to white list configuration."
    )

    // Turn it off - and verify event
    let ret = await tokenInstance.setWhitelistEnabled(false)
    expectEvent.inLogs(ret.logs, 'WhitelistEnabledUpdated', { updatedBy: accounts[0], enabled: false })

    // Validate it works
    await tokenInstance.transfer(accounts[3], 100, { from: accounts[2] })

    // Turn it on - and verify event
    ret = await tokenInstance.setWhitelistEnabled(true)
    expectEvent.inLogs(ret.logs, 'WhitelistEnabledUpdated', { updatedBy: accounts[0], enabled: true })

    // Verify accounts can't transfer
    await expectRevert(
      tokenInstance.transfer(accounts[3], 100, { from: accounts[2] }), 
      "The transfer was restricted due to white list configuration."
    )
  })

  it('should not allow non-owner disabling the whitelist logic', async () => {
    await expectRevert(
      tokenInstance.setWhitelistEnabled(false, { from: accounts[2] }), 
        "OwnerRole: caller does not have the Owner role"
    )
  })

  it('should verify an address is on a valid whitelist when removing', async () => {
    // First allow acct 0 be whitelister
    await tokenInstance.addWhitelister(accounts[0], { from: accounts[0] })
  
    // Try to remove an address that was never added to a whitelist
    await expectRevert(
      tokenInstance.removeFromWhitelist(accounts[1], { from: accounts[0] }), 
      "Address cannot be removed from invalid whitelist."
    )
  })
})
