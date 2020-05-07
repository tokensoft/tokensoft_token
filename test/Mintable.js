/* global artifacts contract it assert */
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const TokenSoftToken = artifacts.require('TokenSoftToken')
const Proxy = artifacts.require('Proxy')
const Constants = require('./Constants')

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

  it('Owner should be able to mint tokens to any account', async () => {
    // Add minter
    await tokenInstance.addMinter(accounts[0])

    // set up the amounts to test
    const mintAmount = '100'

    // assign roles
    await tokenInstance.addWhitelister(adminAccount, { from: ownerAccount })
    await tokenInstance.addToWhitelist(whitelistedAccount, 1, { from: adminAccount })

    // get initial account balance and token supply
    const initialSupply = await tokenInstance.totalSupply()
    const accountBalance = await tokenInstance.balanceOf(whitelistedAccount)
    assert.equal(0, accountBalance, 'Account should have initial balance of 0')
    assert.notEqual(0, initialSupply, 'Initial supply should be great than 0')

    // mint tokens to the nonwhitelisted account
    await tokenInstance.mint(whitelistedAccount, mintAmount, { from: accounts[0] })

    // confirm account balance and total supply are updated
    const postMintSupply = await tokenInstance.totalSupply()
    const postMintAccountBalance = await tokenInstance.balanceOf(whitelistedAccount)
    assert.equal(mintAmount, postMintAccountBalance, 'Account balance should equal mint amount post mint')
    assert.notEqual(initialSupply, postMintSupply, 'Total supply post mint should be different than initial supply')
  })

  it('Owners should not be able to mint tokens to non whitelisted accounts', async () => {

    // set up the amounts to test
    const mintAmount = '100'

    // attempt to mint tokens to non whitelisted accounts should fail
    await expectRevert.unspecified(tokenInstance.mint(minteeAccount, mintAmount, { from: ownerAccount }))

  })

  it('Non owners should not be able to mint tokens to any account', async () => {
    assert.equal(tokenInstance !== null, true, 'Contract should be deployed')

    // set up the amounts to test
    const mintAmount = '100'

    await tokenInstance.addWhitelister(adminAccount, { from: ownerAccount })
    await tokenInstance.addToWhitelist(whitelistedAccount, 1, { from: adminAccount })

    // attempt to mint tokens from admin, whitelisted, and non whitelisted accounts; should all fail
    await expectRevert.unspecified(tokenInstance.mint(minteeAccount, mintAmount, { from: adminAccount }))
    await expectRevert.unspecified(tokenInstance.mint(minteeAccount, mintAmount, { from: whitelistedAccount }))
    await expectRevert.unspecified(tokenInstance.mint(minteeAccount, mintAmount, { from: nonWhitelistedAccount }))
  })

  it('should emit event when tokens are minted', async () => {
    // Add minter
    await tokenInstance.addMinter(ownerAccount)

    // set up the amounts to test
    const mintAmount = '100'

    // assign roles
    await tokenInstance.addWhitelister(adminAccount, { from: ownerAccount })
    await tokenInstance.addToWhitelist(minteeAccount, 1, { from: adminAccount })

    // mint tokens to mintee account
    const { logs } = await tokenInstance.mint(minteeAccount, mintAmount, { from: ownerAccount })

    expectEvent.inLogs(logs, 'Mint', { minter: ownerAccount, to: minteeAccount, amount: mintAmount })
  })
})
