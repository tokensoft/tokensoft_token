/* global artifacts contract it assert */
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const TokenSoftToken = artifacts.require('TokenSoftTokenV2')
const Proxy = artifacts.require('Proxy')
const Constants = require('../Constants')
const BigNumber = require('bignumber.js')

/**
 * Sanity check for transferring ownership.  Most logic is fully tested in OpenZeppelin lib.
 */
contract('Burnable', (accounts) => {
  // set up account roles
  const ownerAccount = accounts[0]
  const adminAccount = accounts[1]
  const whitelistedAccount = accounts[2]
  const nonWhitelistedAccount = accounts[3]
  const burneeAccount = accounts[4]
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

  it('Admin should be able to burn tokens from any account', async () => {
    // set up the amounts to test
    const transferAmount = 100
    const burnAmount = 25
    const afterBurnAmount = transferAmount - burnAmount

    await tokenInstance.addBurner(adminAccount)

    // transfer tokens from owner account to burnee accounts
    await tokenInstance.transfer(burneeAccount, transferAmount, { from: ownerAccount })

    // get the initial balances of the user and admin account and confirm balances
    const initialSupply = await tokenInstance.totalSupply()
    const burneeBalance = await tokenInstance.balanceOf(burneeAccount)
    assert.equal(burneeBalance, transferAmount, 'User balance should intially be equal to the transfer amount')

    // burn tokens from the user
    await tokenInstance.burn(burneeAccount, burnAmount, { from: adminAccount })

    // get the updated balances for admin and user and confirm they are updated
    const postBurnSupply = await tokenInstance.totalSupply()
    const burneeBalanceBurned = await tokenInstance.balanceOf(burneeAccount)
    assert.equal(burneeBalanceBurned, afterBurnAmount, 'User balance should be reduced after tokens are burnd')
    assert.equal(new BigNumber(initialSupply).minus(burnAmount).toFixed(), new BigNumber(postBurnSupply).toFixed(), 'Total supply post mint should be updated with additional minted amount')
  })

  it('Non admins should not be able to burn tokens', async () => {
    // set up the amounts to test
    const transferAmount = 100
    const burnAmount = 25

    // transfer tokens from owner account to burnee account
    await tokenInstance.transfer(burneeAccount, transferAmount, { from: ownerAccount })

    // attempt to burn tokens from owner, whitelisted, and non whitelisted accounts; should all fail
    await expectRevert(tokenInstance.burn(burneeAccount, burnAmount, { from: ownerAccount }), "BurnerRole: caller does not have the Burner role")
    await expectRevert(tokenInstance.burn(burneeAccount, burnAmount, { from: whitelistedAccount }), "BurnerRole: caller does not have the Burner role")
    await expectRevert(tokenInstance.burn(burneeAccount, burnAmount, { from: nonWhitelistedAccount }), "BurnerRole: caller does not have the Burner role")
  })

  it('should emit event when tokens are burnd', async () => {
    await tokenInstance.addBurner(adminAccount)
    
    // set up the amounts to test
    const transferAmount = 100
    const burnAmount = '25'

    // transfer tokens from owner account to burnee accounts
    await tokenInstance.transfer(burneeAccount, transferAmount, { from: ownerAccount })

    // burn tokens from the user
    const { logs } = await tokenInstance.burn(burneeAccount, burnAmount, { from: adminAccount })

    expectEvent.inLogs(logs, 'Burn', { burner: adminAccount, from: burneeAccount, amount: burnAmount })
  })
})
