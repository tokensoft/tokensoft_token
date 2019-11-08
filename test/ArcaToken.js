/* global artifacts contract it assert */
const BigNumber = require('bignumber.js')

const ArcaToken = artifacts.require('ArcaToken')

contract('ArcaToken', (accounts) => {
  it('should deploy', async () => {
    const tokenInstance = await ArcaToken.new(accounts[0])
    assert.equal(tokenInstance !== null, true, 'Contract should be deployed')
  })

  it('should have correct details set', async () => {
    const tokenInstance = await ArcaToken.new(accounts[0])

    assert.equal(await tokenInstance.name.call(), 'ARCA', 'Name should be set correctly')
    assert.equal(await tokenInstance.symbol.call(), 'ARCA', 'Symbol should be set correctly')
    assert.equal(await tokenInstance.decimals.call(), 18, 'Decimals should be set correctly')
  })

  it('should mint tokens to owner', async () => {
    const tokenInstance = await ArcaToken.new(accounts[0])

    // Expected amount is decimals of (10^18) time supply of 50 billion
    const expectedSupply = new BigNumber(10).pow(18).multipliedBy(50).multipliedBy(1000000000)
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
    const tokenInstance = await ArcaToken.new(accounts[1])

    // Expected amount is decimals of (10^18) time supply of 50 billion
    const expectedSupply = new BigNumber(10).pow(18).multipliedBy(50).multipliedBy(1000000000)
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
