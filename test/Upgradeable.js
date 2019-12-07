/* global artifacts contract it assert */
const { shouldFail, expectEvent } = require('openzeppelin-test-helpers')
const ArcaToken = artifacts.require('ArcaToken')
const ArcaTokenEscrow = artifacts.require('ArcaTokenEscrow')
const Proxy = artifacts.require('Proxy')

/**
 * Sanity check for transferring ownership.  Most logic is fully tested in OpenZeppelin lib.
 */
contract('Upgrdeable', (accounts) => {
  // set up account roles
  const ownerAccount = accounts[0]
  const adminAccount = accounts[1]
  const whitelistedAccount = accounts[2]
  const nonWhitelistedAccount = accounts[3]
  const revokeeAccount = accounts[4]
  let tokenInstance, tokenEscrowInstance, tokenDeploy, tokenEscrowDeploy, proxyInstance

  beforeEach(async () => {
    tokenDeploy = await ArcaToken.new()
    tokenEscrowDeploy = await ArcaTokenEscrow.new()
    proxyInstance = await Proxy.new(tokenDeploy.address)
    tokenInstance = await ArcaToken.at(proxyInstance.address)
    tokenEscrowInstance = await ArcaTokenEscrow.at(proxyInstance.address)
    await tokenInstance.initialize(accounts[0]);
  })

  it('Transfers should be subject to 1404 rules', async () => {
    // set up the amounts to test
    const transferAmount = 100
    const revokeAmount = 25
    const afterRevokeAmount = transferAmount - revokeAmount

    // add account2 to admin role
    await tokenInstance.addAdmin(adminAccount, { from: ownerAccount })
    await tokenInstance.addToWhitelist(whitelistedAccount, 1, { from: adminAccount })

    // transfer tokens from owner account to revokee accounts
    await tokenInstance.transfer(whitelistedAccount, transferAmount, { from: ownerAccount })

    // get the balance after transfer
    const whitelistedBalance = await tokenInstance.balanceOf(whitelistedAccount)
    assert.equal(whitelistedBalance, transferAmount, 'User balance should intially be equal to the transfer amount')
    
    await tokenInstance.updateCodeAddress(tokenEscrowDeploy.address) 

    const whitelistedBalanceAfterUpdate = await tokenEscrowInstance.balanceOf(whitelistedAccount)
    // confirm balances are unchanged
    console.log('before balance ', whitelistedBalance.toString(), ' after balance ', whitelistedBalanceAfterUpdate.toString())
    assert.equal(whitelistedBalance.toString(), whitelistedBalanceAfterUpdate.toString(), 'User balance should be the same after update')

    // transfer tokens from owner account to revokee accounts
    await tokenEscrowInstance.transfer(whitelistedAccount, transferAmount, { from: ownerAccount })

    const whitelistedBalanceAfterUpdateAndTransfer = await tokenEscrowInstance.balanceOf(whitelistedAccount)
    assert.equal(whitelistedBalanceAfterUpdateAndTransfer.toString(), whitelistedBalanceAfterUpdate.toString(), 'User balance should be the same after update and transfer')

    await tokenEscrowInstance.approveTransferProposal(0, {from: adminAccount})
    const whitelistedBalanceAfterUpdateAndTransferApproval = await tokenEscrowInstance.balanceOf(whitelistedAccount)
    assert.notEqual(whitelistedBalanceAfterUpdateAndTransfer.toString(), whitelistedBalanceAfterUpdateAndTransferApproval.toString(), 'User balance should be updated after update and transfer approval')

  })

})