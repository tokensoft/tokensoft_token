/* global artifacts contract it assert */
const { expectRevert } = require('@openzeppelin/test-helpers')
const TokenSoftToken = artifacts.require('TokenSoftTokenV2')
const Proxy = artifacts.require('Proxy')
const Constants = require('./Constants')

const invalidWhitelistMsg = "The transfer was restricted due to white list configuration." 

contract('Transfers', (accounts) => {
  const ownerAccount = accounts[0]
  const adminAccount = accounts[1]
  const whitelistedAccount = accounts[2]
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

  it('All users should be blocked from sending to non whitelisted non role-assigned accounts', async () => {
    await tokenInstance.addWhitelister(adminAccount, { from: ownerAccount })
    await tokenInstance.addToWhitelist(whitelistedAccount, 1, { from: adminAccount })

    // Sending to non whitelisted account should fail regardless of sender (except owner)
    await tokenInstance.transfer(accounts[7], 100, { from: ownerAccount })
    await expectRevert(tokenInstance.transfer(accounts[7], 100, { from: adminAccount }), invalidWhitelistMsg)
    await expectRevert(tokenInstance.transfer(accounts[7], 100, { from: whitelistedAccount }), invalidWhitelistMsg)
  })

  it('Initial transfers should fail but succeed after white listing', async () => {
    // Set account 1 as an admin
    await tokenInstance.addWhitelister(adminAccount, { from: ownerAccount })

    // Whitelist and send some initial tokens to account 5
    await tokenInstance.addToWhitelist(accounts[5], 20, { from: adminAccount })
    await tokenInstance.transfer(accounts[5], 10000, { from: ownerAccount })

    // Try to send to account 2
    await expectRevert(tokenInstance.transfer(accounts[2], 100, { from: accounts[5] }), invalidWhitelistMsg)

    // Approve a transfer from account 5 and then try to spend it from account 2
    await tokenInstance.approve(accounts[2], 100, { from: accounts[5] })
    await expectRevert(tokenInstance.transferFrom(accounts[5], accounts[2], 100, { from: accounts[2] }), invalidWhitelistMsg)

    // Try to send to account 2 should still fail
    await expectRevert(tokenInstance.transfer(accounts[2], 100, { from: accounts[5] }), invalidWhitelistMsg)
    await expectRevert(tokenInstance.transferFrom(accounts[5], accounts[2], 100, { from: accounts[2] }), invalidWhitelistMsg)

    // Move address 2 to whitelist
    await tokenInstance.addToWhitelist(accounts[2], 20, { from: accounts[1] })

    // Try to send to account 2 should still fail
    await expectRevert(tokenInstance.transfer(accounts[2], 100, { from: accounts[5] }), invalidWhitelistMsg)
    await expectRevert(tokenInstance.transferFrom(accounts[5], accounts[2], 100, { from: accounts[2] }), invalidWhitelistMsg)

    // Now allow whitelist 20 to send to itself
    await tokenInstance.updateOutboundWhitelistEnabled(20, 20, true, { from: accounts[1] })

    // Should succeed
    await tokenInstance.transfer(accounts[2], 100, { from: accounts[5] })
    await tokenInstance.transferFrom(accounts[5], accounts[2], 100, { from: accounts[2] })

    // Now account 2 should have 200 tokens
    const balance = await tokenInstance.balanceOf.call(accounts[2])
    assert.equal(balance, '200', 'Transfers should have been sent')

    // Remove account 2 from the white list
    await tokenInstance.removeFromWhitelist(accounts[2], { from: accounts[1] })

    // Should fail trying to send back to account 5 from 2
    await expectRevert(tokenInstance.transfer(accounts[5], 100, { from: accounts[2] }), invalidWhitelistMsg)

    // Should fail with approved transfer from going back to account 5 from 2 using approval
    await tokenInstance.approve(accounts[5], 100, { from: accounts[2] })
    await expectRevert(tokenInstance.transferFrom(accounts[2], accounts[5], 100, { from: accounts[5] }), invalidWhitelistMsg)
  })
})
