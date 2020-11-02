/* global artifacts contract it assert */
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const TokenSoftToken = artifacts.require('TokenSoftTokenV2')
const TokenSoftTokenEscrow = artifacts.require('TokenSoftTokenEscrow')
const TokenSoftTokenEscrowNotProxiable = artifacts.require('TokenSoftTokenEscrowNotProxiable')
const Proxy = artifacts.require('Proxy')
const Constants = require('../Constants')

/**
 * Sanity check for transferring ownership.  Most logic is fully tested in OpenZeppelin lib.
 */
contract('Upgradeable', (accounts) => {
  // set up account roles
  const ownerAccount = accounts[0]
  const adminAccount = accounts[1]
  const whitelistedAccount = accounts[2]
  let tokenInstance, tokenEscrowInstance, tokenDeploy, tokenEscrowDeploy, tokenEscrowNotProxiableDeploy, proxyInstance

  beforeEach(async () => {
    tokenDeploy = await TokenSoftToken.new()
    tokenEscrowDeploy = await TokenSoftTokenEscrow.new()
    tokenEscrowNotProxiableDeploy = await TokenSoftTokenEscrowNotProxiable.new()
    proxyInstance = await Proxy.new(tokenDeploy.address)
    tokenInstance = await TokenSoftToken.at(proxyInstance.address)
    tokenEscrowInstance = await TokenSoftTokenEscrow.at(proxyInstance.address)
    await tokenInstance.initialize(
      accounts[0],
      Constants.name,
      Constants.symbol,
      Constants.decimals,
      Constants.supply,
      true);
  })

  it('Can upgrade to proxiable contract', async () => {
    // update the code address to the escrow logic
    await tokenInstance.updateCodeAddress(tokenEscrowDeploy.address)
    const logicAddress = await tokenEscrowInstance.getLogicAddress()
    assert.equal(logicAddress, tokenEscrowDeploy.address, 'Logic contract address should be changed after update')
  })

  it('Cannot upgrade to non proxiable contract', async () => {
    // update the code address to the escrow logic
    await expectRevert.unspecified(tokenInstance.updateCodeAddress(tokenEscrowNotProxiableDeploy.address))
  })

  it('Upgrading contract fires event', async () => {
    // update the code address to the escrow logic
    const { logs } = await tokenInstance.updateCodeAddress(tokenEscrowDeploy.address)
    expectEvent.inLogs(logs, 'CodeAddressUpdated', {
      newAddress: tokenEscrowDeploy.address
    })
  })

  it('Contract cannot be upgraded by non owner', async () => {
    // update the code address to the escrow logic
    await expectRevert(
      tokenInstance.updateCodeAddress(tokenEscrowDeploy.address, {from: accounts[1]}),
      "OwnerRole: caller does not have the Owner role"
    )
  })

  it('Transfer rules can be upgraded', async () => {
    // set up the amounts to test
    const transferAmount = 100

    // add account2 to admin role
    await tokenInstance.addWhitelister(adminAccount, { from: ownerAccount })
    await tokenInstance.addToWhitelist(whitelistedAccount, 1, { from: adminAccount })

    // transfer tokens from owner account to revokee accounts
    await tokenInstance.transfer(whitelistedAccount, transferAmount, { from: ownerAccount })

    // get the balance after transfer
    const whitelistedBalance = await tokenInstance.balanceOf(whitelistedAccount)
    
    // update the code address to the escrow logic
    await tokenInstance.updateCodeAddress(tokenEscrowDeploy.address)

    // Add admin as escrower
    await tokenEscrowInstance.addEscrower(adminAccount)

    // transfer tokens from owner account to revokee accounts
    await tokenEscrowInstance.transfer(whitelistedAccount, transferAmount, { from: ownerAccount })

    const whitelistedBalanceAfterUpdateAndTransfer = await tokenEscrowInstance.balanceOf(whitelistedAccount)
    assert.equal(whitelistedBalanceAfterUpdateAndTransfer.toString(), whitelistedBalance.toString(), 'User balance should be the same after update and transfer')

    await tokenEscrowInstance.approveTransferProposal(0, {from: adminAccount})
    const whitelistedBalanceAfterUpdateAndTransferApproval = await tokenEscrowInstance.balanceOf(whitelistedAccount)
    assert.notEqual(whitelistedBalanceAfterUpdateAndTransfer.toString(), whitelistedBalanceAfterUpdateAndTransferApproval.toString(), 'User balance should be updated after update and transfer approval')
  })

  it('Balance are maintained after upgrade', async () => {
    // set up the amounts to test
    const transferAmount = 100

    // add account2 to admin role
    await tokenInstance.addWhitelister(adminAccount, { from: ownerAccount })
    await tokenInstance.addToWhitelist(whitelistedAccount, 1, { from: adminAccount })

    // transfer tokens from owner account to revokee accounts
    await tokenInstance.transfer(whitelistedAccount, transferAmount, { from: ownerAccount })

    // get the balance after transfer
    const whitelistedBalance = await tokenInstance.balanceOf(whitelistedAccount)
    assert.equal(whitelistedBalance, transferAmount, 'User balance should intially be equal to the transfer amount')
    
    // update the code address to the escrow logic
    await tokenInstance.updateCodeAddress(tokenEscrowDeploy.address)
    tokenEscrowInstance = await TokenSoftTokenEscrow.at(proxyInstance.address) 

    const whitelistedBalanceAfterUpdate = await tokenEscrowInstance.balanceOf(whitelistedAccount)
    // confirm balances are unchanged
    assert.equal(whitelistedBalance.toString(), whitelistedBalanceAfterUpdate.toString(), 'User balance should be the same after update')

  })

})