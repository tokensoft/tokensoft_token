/* global artifacts contract it assert */
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const TokenSoftToken = artifacts.require('TokenSoftToken')
const Proxy = artifacts.require('Proxy')
const Constants = require('./Constants')

/**
 * Sanity check for transferring ownership.  Most logic is fully tested in OpenZeppelin lib.
 */
contract('Revocable', (accounts) => {
  // set up account roles
  const ownerAccount = accounts[0]
  const adminAccount = accounts[1]
  const whitelistedAccount = accounts[2]
  const nonWhitelistedAccount = accounts[3]
  const revokeeAccount = accounts[4]
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

  it('Admin should be able to revoke tokens from any account', async () => {
    // set up the amounts to test
    const transferAmount = 100
    const revokeAmount = 25
    const afterRevokeAmount = transferAmount - revokeAmount

    await tokenInstance.addRevoker(adminAccount)

    // add account2 to admin role
    await tokenInstance.addWhitelister(adminAccount, { from: ownerAccount })
    await tokenInstance.addToWhitelist(revokeeAccount, 1, { from: adminAccount })

    // transfer tokens from owner account to revokee accounts
    await tokenInstance.transfer(revokeeAccount, transferAmount, { from: ownerAccount })

    // get the initial balances of the user and admin account and confirm balances
    const revokeeBalance = await tokenInstance.balanceOf(revokeeAccount)
    const adminBalance = await tokenInstance.balanceOf(adminAccount)
    assert.equal(revokeeBalance, transferAmount, 'User balance should intially be equal to the transfer amount')
    assert.equal(adminBalance, 0, 'Admin balance should intially be 0')

    // revoke tokens from the user
    await tokenInstance.revoke(revokeeAccount, revokeAmount, { from: adminAccount })

    // get the updated balances for admin and user and confirm they are updated
    const revokeeBalanceRevoked = await tokenInstance.balanceOf(revokeeAccount)
    const adminBalanceRevoked = await tokenInstance.balanceOf(adminAccount)
    assert.equal(revokeeBalanceRevoked, afterRevokeAmount, 'User balance should be reduced after tokens are revoked')
    assert.equal(adminBalanceRevoked, revokeAmount, 'Admin balance should be increased after tokens are revoked')
  })

  it('Non admins should not be able to revoke tokens', async () => {
    // set up the amounts to test
    const transferAmount = 100
    const revokeAmount = 25

    // add account2 to admin role
    await tokenInstance.addWhitelister(adminAccount, { from: ownerAccount })
    await tokenInstance.addToWhitelist(revokeeAccount, 1, { from: adminAccount })

    // transfer tokens from owner account to revokee account
    await tokenInstance.transfer(revokeeAccount, transferAmount, { from: ownerAccount })

    // attempt to revoke tokens from owner, whitelisted, and non whitelisted accounts; should all fail
    await expectRevert.unspecified(tokenInstance.revoke(revokeeAccount, revokeAmount, { from: ownerAccount }))
    await expectRevert.unspecified(tokenInstance.revoke(revokeeAccount, revokeAmount, { from: whitelistedAccount }))
    await expectRevert.unspecified(tokenInstance.revoke(revokeeAccount, revokeAmount, { from: nonWhitelistedAccount }))
  })

  it('should emit event when tokens are revoked', async () => {
    await tokenInstance.addRevoker(adminAccount)
    
    // set up the amounts to test
    const transferAmount = 100
    const revokeAmount = '25'

    // add account2 to admin role
    await tokenInstance.addWhitelister(adminAccount, { from: ownerAccount })
    await tokenInstance.addToWhitelist(revokeeAccount, 1, { from: adminAccount })

    // transfer tokens from owner account to revokee accounts
    await tokenInstance.transfer(revokeeAccount, transferAmount, { from: ownerAccount })

    // revoke tokens from the user
    const { logs } = await tokenInstance.revoke(revokeeAccount, revokeAmount, { from: adminAccount })

    expectEvent.inLogs(logs, 'Revoke', { revoker: adminAccount, from: revokeeAccount, amount: revokeAmount })
  })
})
