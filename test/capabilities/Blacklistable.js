/* global artifacts contract it assert */
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const TokenSoftTokenV2 = artifacts.require('TokenSoftTokenV2')
const Proxy = artifacts.require('Proxy')
const Constants = require('../Constants')

const NO_WHITELIST = 0

contract('Blacklistable', (accounts) => {
  let tokenInstance, tokenDeploy, proxyInstance

  beforeEach(async () => {
    tokenDeploy = await TokenSoftTokenV2.new()
    proxyInstance = await Proxy.new(tokenDeploy.address)
    tokenInstance = await TokenSoftTokenV2.at(proxyInstance.address)
    await tokenInstance.initialize(
      accounts[0],
      Constants.name,
      Constants.symbol,
      Constants.decimals,
      Constants.supply,
      false);

    // Enable the blacklist
    await tokenInstance.setBlacklistEnabled(true)
  })

  it('should allow adding and removing an address on a blacklist', async () => {
    // First allow acct 1 be an administrator
    await tokenInstance.addBlacklister(accounts[1], { from: accounts[0] })

    // Check acct 2 b should not be blacklisted by default
    const existingBlacklist = await tokenInstance.addressBlacklists.call(accounts[2])
    assert.equal(existingBlacklist, false, 'Addresses should have no blacklist to start off with')

    // Add the acct 2 to blacklist - using account 1
    await tokenInstance.addToBlacklist(accounts[2], { from: accounts[1] })

    // Validate it got updated
    let updatedBlacklist = await tokenInstance.addressBlacklists.call(accounts[2])
    assert.equal(updatedBlacklist, true, 'Addresses should have updated blacklist')

    // Remove the address from list
    await tokenInstance.removeFromBlacklist(accounts[2], { from: accounts[1] })

    // Validate it got updated
    updatedBlacklist = await tokenInstance.addressBlacklists.call(accounts[2])
    assert.equal(updatedBlacklist, false, 'Addresses should have been removed from list')
  })

  it('should only allow admins adding or removing on blacklists', async () => {
    // Non admin should fail adding to blacklist
    await expectRevert(
      tokenInstance.addToBlacklist(accounts[2], { from: accounts[4] }),
      "BlacklisterRole missing")

    // Now allow acct 4 be an administrator
    await tokenInstance.addBlacklister(accounts[4], { from: accounts[0] })

    // Adding as admin should work
    await tokenInstance.addToBlacklist(accounts[2], { from: accounts[4] })

    // Removing as non-admin should fail
    await expectRevert(
      tokenInstance.removeFromBlacklist(accounts[2], { from: accounts[8] }),
      "BlacklisterRole missing")

    // Removing as admin should work
    await tokenInstance.removeFromBlacklist(accounts[2], { from: accounts[4] })

    // Now remove acct 4 from the admin list
    await tokenInstance.removeBlacklister(accounts[4], { from: accounts[0] })

    // It should fail again now that acct 4 is non-admin
    await expectRevert(
      tokenInstance.addToBlacklist(accounts[2], { from: accounts[4] }),
      "BlacklisterRole missing")
  })

  it('should validate if addresses are not on a blacklist', async () => {
    // First allow acct 1 be an administrator
    await tokenInstance.addBlacklister(accounts[1], { from: accounts[0] })

    // Two addresses not on any blacklist
    let isValid = await tokenInstance.checkBlacklistAllowed.call(accounts[6], accounts[7])
    assert.equal(isValid, true, 'Two non blacklisted addresses should be valid')

    // Add address 6
    await tokenInstance.addToBlacklist(accounts[6], { from: accounts[1] })

    // Only first address on blacklist should fail
    isValid = await tokenInstance.checkBlacklistAllowed.call(accounts[6], accounts[7])
    assert.equal(isValid, false, 'First non blacklisted addresses should not be valid')

    // Remove again
    await tokenInstance.removeFromBlacklist(accounts[6], { from: accounts[1] })

    // Both should pass again
    isValid = await tokenInstance.checkBlacklistAllowed.call(accounts[6], accounts[7])
    assert.equal(isValid, true, 'Two non blacklisted addresses should be valid')

    // Add address 7
    await tokenInstance.addToBlacklist(accounts[7], { from: accounts[1] })

    // Only second address on blacklist should fail
    isValid = await tokenInstance.checkBlacklistAllowed.call(accounts[6], accounts[7])
    assert.equal(isValid, false, 'Second non blacklisted addresses should not be valid')

    // Remove second addr
    await tokenInstance.removeFromBlacklist(accounts[7], { from: accounts[1] })

    // Both should pass again
    isValid = await tokenInstance.checkBlacklistAllowed.call(accounts[6], accounts[7])
    assert.equal(isValid, true, 'Two non blacklisted addresses should be valid')

    // Add both 6 and 7
    await tokenInstance.addToBlacklist(accounts[6], { from: accounts[1] })
    await tokenInstance.addToBlacklist(accounts[7], { from: accounts[1] })

    // Should be invalid
    isValid = await tokenInstance.checkBlacklistAllowed.call(accounts[6], accounts[7])
    assert.equal(isValid, false, 'Both on same blacklist should be invalid')
  })

  it('should trigger events', async () => {
    // First allow acct 1 to be an administrator
    await tokenInstance.addBlacklister(accounts[1], { from: accounts[0] })

    // Check for initial add
    let ret = await tokenInstance.addToBlacklist(accounts[3], { from: accounts[1] })
    expectEvent.inLogs(ret.logs, 'AddressAddedToBlacklist', { addedAddress: accounts[3], addedBy: accounts[1] })

    // Removing from list should trigger removal event
    ret = await tokenInstance.removeFromBlacklist(accounts[3], { from: accounts[1] })
    expectEvent.inLogs(ret.logs, 'AddressRemovedFromBlacklist', { removedAddress: accounts[3], removedBy: accounts[1] })

    // Check disable event
    ret = await tokenInstance.setBlacklistEnabled(false)
    expectEvent.inLogs(ret.logs, 'BlacklistEnabledUpdated', { updatedBy: accounts[0], enabled: false })

    // Check enable event
    ret = await tokenInstance.setBlacklistEnabled(true)
    expectEvent.inLogs(ret.logs, 'BlacklistEnabledUpdated', { updatedBy: accounts[0], enabled: true })
  })


  it('should not allow adding or removing address 0x0', async () => {
    // First allow acct 0 be an administrator
    await tokenInstance.addBlacklister(accounts[0], { from: accounts[0] })

    await expectRevert(
      tokenInstance.addToBlacklist(
        "0x0000000000000000000000000000000000000000",
        { from: accounts[0] }
      ), 
      "Cannot add 0x0"
    )

    await expectRevert(
      tokenInstance.removeFromBlacklist(
        "0x0000000000000000000000000000000000000000",
        { from: accounts[0] }
      ), 
      "Cannot remove 0x0"
    )
  })

  it('should allow disabling and re-enabling the blacklist logic', async () => {
    // First allow acct 1 be blacklister
    await tokenInstance.addBlacklister(accounts[1], { from: accounts[0] })

    // Send some tokens to account 2
    await tokenInstance.transfer(accounts[2], 1000)

    // Verify accounts can transfer
    await tokenInstance.transfer(accounts[3], 100, { from: accounts[2] })

    // Add account 2 to the black list
    await tokenInstance.addToBlacklist(accounts[2], { from: accounts[1] })

    // Verify transfer fails
    await expectRevert(
      tokenInstance.transfer(accounts[3], 100, { from: accounts[2] }), 
      "Restricted due to blacklist"
    )
    
    // Turn it off
    await tokenInstance.setBlacklistEnabled(false)

    // Validate it works
    await tokenInstance.transfer(accounts[3], 100, { from: accounts[2] })

    // Turn it on
    await tokenInstance.setBlacklistEnabled(true)

    // Verify accounts can't transfer
    await expectRevert(
      tokenInstance.transfer(accounts[3], 100, { from: accounts[2] }), 
      "Restricted due to blacklist"
    )
  })

  it('should not allow non-owner disabling the blacklist logic', async () => {
    await expectRevert(
      tokenInstance.setBlacklistEnabled(false, { from: accounts[2] }), 
        "OwnerRole: caller does not have the Owner role"
    )
  })

  it('should not allow removing an address that is not blacklisted or adding already blacklisted', async () => {
    // First allow acct 1 be blacklister
    await tokenInstance.addBlacklister(accounts[1], { from: accounts[0] })

    await expectRevert(
      tokenInstance.removeFromBlacklist(accounts[2], {from: accounts[1]}), 
      "Not on list"
    )

    // Blacklist acct 3
    await tokenInstance.addToBlacklist(accounts[3], {from: accounts[1]})
    // Second time should fail
    await expectRevert(
      tokenInstance.addToBlacklist(accounts[3], {from: accounts[1]}),
      "Already on list"
    )
      
  })
})
