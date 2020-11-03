/* global artifacts contract it assert */
const BigNumber = require('bignumber.js')
const { expectRevert } = require('@openzeppelin/test-helpers')

const TokenSoftToken = artifacts.require('TokenSoftTokenV2')
const Proxy = artifacts.require('Proxy')

const Constants = require('./Constants')

contract('TokenSoftTokenV2', (accounts) => {
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
      true
      );
  })
  it('should deploy', async () => {
    assert.equal(tokenInstance !== null, true, 'Contract should be deployed')
  })

  it('should not allow a 0x0 address in setting proxy', async () => {
    await expectRevert(Proxy.new("0x0000000000000000000000000000000000000000"), "Contract Logic cannot be 0x0")
  })

  it('should have correct details set', async () => {
    assert.equal(await tokenInstance.name.call(), Constants.name, 'Name should be set correctly')
    assert.equal(await tokenInstance.symbol.call(), Constants.symbol, 'Symbol should be set correctly')
    assert.equal(await tokenInstance.decimals.call(), Constants.decimals, 'Decimals should be set correctly')
  })

  it('should mint tokens to owner', async () => {
    // Expected amount is decimals of (10^18) time supply of 50 billion
    const expectedSupply = Constants.supply
    const creatorBalance = new BigNumber(await tokenInstance.balanceOf(accounts[0]))

    // Verify the creator got all the coins
    assert.equal(creatorBalance.toFixed(), expectedSupply.toFixed(), 'Creator should have 50 Billion tokens (including decimals)')

    // Verify some other random accounts for kicks
    const bad1Balance = new BigNumber(await tokenInstance.balanceOf(accounts[1]))
    const bad2Balance = new BigNumber(await tokenInstance.balanceOf(accounts[2]))
    const bad3Balance = new BigNumber(await tokenInstance.balanceOf(accounts[3]))
    assert.equal(bad1Balance.toFixed(), '0', 'Other accounts should have 0 coins')
    assert.equal(bad2Balance.toFixed(), '0', 'Other accounts should have 0 coins')
    assert.equal(bad3Balance.toFixed(), '0', 'Other accounts should have 0 coins')
  })

  it('should mint tokens to different owner', async () => {
    tokenDeploy = await TokenSoftToken.new()
    proxyInstance = await Proxy.new(tokenDeploy.address)
    tokenInstance = await TokenSoftToken.at(proxyInstance.address)
    await tokenInstance.initialize(
      accounts[1],
      Constants.name,
      Constants.symbol,
      Constants.decimals,
      Constants.supply,
      true
    );
    // Expected amount is decimals of (10^18) time supply of 50 billion
    const expectedSupply = Constants.supply
    const creatorBalance = new BigNumber(await tokenInstance.balanceOf(accounts[1]))

    // Verify the creator got all the coins
    assert.equal(creatorBalance.toFixed(), expectedSupply.toFixed(), 'Owner should have 50 Billion tokens (including decimals)')

    // Verify some other random accounts for kicks
    const bad1Balance = new BigNumber(await tokenInstance.balanceOf(accounts[0]))
    const bad2Balance = new BigNumber(await tokenInstance.balanceOf(accounts[2]))
    const bad3Balance = new BigNumber(await tokenInstance.balanceOf(accounts[3]))
    assert.equal(bad1Balance.toFixed(), '0', 'Other accounts should have 0 coins')
    assert.equal(bad2Balance.toFixed(), '0', 'Other accounts should have 0 coins')
    assert.equal(bad3Balance.toFixed(), '0', 'Other accounts should have 0 coins')
  })
})
