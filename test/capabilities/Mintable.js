/* global artifacts contract it assert */
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const TokenSoftToken = artifacts.require('TokenSoftTokenV2')
const Proxy = artifacts.require('Proxy')
const Constants = require('../Constants')
const BigNumber = require('bignumber.js')

/**
 * Sanity check for transferring ownership.  Most logic is fully tested in OpenZeppelin lib.
 */
contract('Mintable', (accounts) => {
  // set up account roles
  const ownerAccount = accounts[0]
  const adminAccount = accounts[1]
  const whitelistedAccount = accounts[2]
  const nonWhitelistedAccount = accounts[3]
  const minteeAccount = accounts[4]
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

  it('Owner should be able to mint tokenst', async () => {
    // Add minter
    await tokenInstance.addMinter(ownerAccount)

    // set up the amounts to test
    const mintAmount = '100'

    // get initial account balance and token supply
    const initialSupply = await tokenInstance.totalSupply()
    const accountBalance = await tokenInstance.balanceOf(whitelistedAccount)
    assert.equal(0, accountBalance, 'Account should have initial balance of 0')

    // mint tokens
    await tokenInstance.mint(whitelistedAccount, mintAmount)

    // confirm account balance and total supply are updated
    const postMintSupply = await tokenInstance.totalSupply()
    const postMintAccountBalance = await tokenInstance.balanceOf(whitelistedAccount)
    assert.equal(mintAmount, postMintAccountBalance, 'Account balance should equal mint amount post mint')
    assert.equal(new BigNumber(initialSupply).plus(mintAmount).toFixed(), new BigNumber(postMintSupply).toFixed(), 'Total supply post mint should be updated with additional minted amount')
  })

  it('Non-MinterRole accounts should not be able to mint tokens to any account', async () => {
    // set up the amounts to test
    const mintAmount = '100'

    // attempt to mint tokens
    await expectRevert(tokenInstance.mint(minteeAccount, mintAmount, { from: adminAccount }), "MinterRole: caller does not have the Minter role")
  })

  it('should emit event when tokens are minted', async () => {
    // Add minter
    await tokenInstance.addMinter(ownerAccount)

    // set up the amounts to test
    const mintAmount = '100'

    // mint tokens to mintee account
    const { logs } = await tokenInstance.mint(minteeAccount, mintAmount, { from: ownerAccount })

    expectEvent.inLogs(logs, 'Mint', { minter: ownerAccount, to: minteeAccount, amount: mintAmount })
  })
})
