/* global artifacts contract it assert */
const { shouldFail, expectEvent } = require('openzeppelin-test-helpers')
const ArcaToken = artifacts.require('ArcaToken')
const ArcaTokenEscrow = artifacts.require('ArcaTokenEscrow')
const ArcaTokenEscrowNotProxiable = artifacts.require('ArcaTokenEscrowNotProxiable')
const Proxy = artifacts.require('Proxy')

/**
 * Sanity check for transferring ownership.  Most logic is fully tested in OpenZeppelin lib.
 */
contract('Upgrdeable', (accounts) => {
  // set up account roles
  const ownerAccount = accounts[0]
  const adminAccount = accounts[1]
  const whitelistedAccount = accounts[2]
  let tokenInstance, tokenEscrowInstance, tokenDeploy, tokenEscrowDeploy, tokenEscrowNotProxiableDeploy, proxyInstance

  beforeEach(async () => {
    tokenDeploy = await ArcaToken.new()
    tokenEscrowDeploy = await ArcaTokenEscrow.new()
    tokenEscrowNotProxiableDeploy = await ArcaTokenEscrowNotProxiable.new()
    proxyInstance = await Proxy.new(tokenDeploy.address)
    tokenInstance = await ArcaToken.at(proxyInstance.address)
    tokenEscrowInstance = await ArcaTokenEscrow.at(proxyInstance.address)
    await tokenInstance.initialize(accounts[0]);
  })

  it('Can upgrade to proxiable contract', async () => {
    // update the code address to the escrow logic
    await tokenInstance.updateCodeAddress(tokenEscrowDeploy.address)
  })

  it('Cannot upgrade to non proxiable contract', async () => {
    // update the code address to the escrow logic
    await shouldFail.reverting(tokenInstance.updateCodeAddress(tokenEscrowNotProxiableDeploy.address))
  })

  it('Transfer rules can be upgraded', async () => {
    // set up the amounts to test
    const transferAmount = 100

    // add account2 to admin role
    await tokenInstance.addAdmin(adminAccount, { from: ownerAccount })
    await tokenInstance.addToWhitelist(whitelistedAccount, 1, { from: adminAccount })

    // transfer tokens from owner account to revokee accounts
    await tokenInstance.transfer(whitelistedAccount, transferAmount, { from: ownerAccount })

    // get the balance after transfer
    const whitelistedBalance = await tokenInstance.balanceOf(whitelistedAccount)
    
    // update the code address to the escrow logic
    await tokenInstance.updateCodeAddress(tokenEscrowDeploy.address)

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
    await tokenInstance.addAdmin(adminAccount, { from: ownerAccount })
    await tokenInstance.addToWhitelist(whitelistedAccount, 1, { from: adminAccount })

    // transfer tokens from owner account to revokee accounts
    await tokenInstance.transfer(whitelistedAccount, transferAmount, { from: ownerAccount })

    // get the balance after transfer
    const whitelistedBalance = await tokenInstance.balanceOf(whitelistedAccount)
    assert.equal(whitelistedBalance, transferAmount, 'User balance should intially be equal to the transfer amount')
    
    // update the code address to the escrow logic
    await tokenInstance.updateCodeAddress(tokenEscrowDeploy.address) 

    const whitelistedBalanceAfterUpdate = await tokenEscrowInstance.balanceOf(whitelistedAccount)
    // confirm balances are unchanged
    assert.equal(whitelistedBalance.toString(), whitelistedBalanceAfterUpdate.toString(), 'User balance should be the same after update')

  })

})