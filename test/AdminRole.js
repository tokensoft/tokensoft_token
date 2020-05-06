/* global artifacts contract it assert */
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const TokenSoftToken = artifacts.require('TokenSoftToken')
const Proxy = artifacts.require('Proxy')

contract('AdminRole', (accounts) => {
  let tokenInstance, tokenDeploy, proxyInstance

  beforeEach(async () => {
    tokenDeploy = await TokenSoftToken.new()
    proxyInstance = await Proxy.new(tokenDeploy.address)
    tokenInstance = await TokenSoftToken.at(proxyInstance.address)
    await tokenInstance.initialize(accounts[0]);
  })

  it('should allow adding and removing for owner', async () => {

    // Validate acct 1 is not an admin by default
    let isAdmin = await tokenInstance.isAdmin(accounts[1])
    assert.equal(isAdmin, false, 'Account should not be admin by default')

    // Adding an admin to the list should be successful for the owner (address[0])
    await tokenInstance.addAdmin(accounts[1], { from: accounts[0] })
    isAdmin = await tokenInstance.isAdmin.call(accounts[1])
    assert.equal(isAdmin, true, 'Owner should be able to add admin')

    // Removing the admin should be successful for the owner (address[0])
    await tokenInstance.removeAdmin(accounts[1], { from: accounts[0] })
    isAdmin = await tokenInstance.isAdmin.call(accounts[1])
    assert.equal(isAdmin, false, 'Owner should be able to remove admin')
  })

  it('should preventing adding and removing for non-owner', async () => {

    // Validate acct 2 is not an admin by default
    const isAdmin = await tokenInstance.isAdmin(accounts[2])
    assert.equal(isAdmin, false, 'Account should not be admin by default')

    // Adding an address to the list should fail for non-owner (address[1])
    await expectRevert.unspecified(tokenInstance.addAdmin(accounts[2], { from: accounts[1] }))

    // Adding the address to admin list should not impact this - only owner can add other admins
    await tokenInstance.addAdmin(accounts[1], { from: accounts[0] })
    await expectRevert.unspecified(tokenInstance.addAdmin(accounts[2], { from: accounts[1] }))

    // Verify a non-owner can't remove an admin (including itself)
    await expectRevert.unspecified(tokenInstance.removeAdmin(accounts[1], { from: accounts[1] }))
    await expectRevert.unspecified(tokenInstance.removeAdmin(accounts[1], { from: accounts[2] }))
  })

  it('should emit events for adding admins', async () => {

    const { logs } = await tokenInstance.addAdmin(accounts[3], { from: accounts[0] })
    expectEvent.inLogs(logs, 'AdminAdded', { addedAdmin: accounts[3], addedBy: accounts[0] })
  })

  it('should emit events for removing admins', async () => {

    await tokenInstance.addAdmin(accounts[3], { from: accounts[0] })
    const { logs } = await tokenInstance.removeAdmin(accounts[3], { from: accounts[0] })

    expectEvent.inLogs(logs, 'AdminRemoved', { removedAdmin: accounts[3], removedBy: accounts[0] })
  })

  it('should preventing adding an admin when already an admin', async () => {

    // The first add should succeed
    await tokenInstance.addAdmin(accounts[1], { from: accounts[0] })

    // The second add should fail
    await expectRevert.unspecified(tokenInstance.addAdmin(accounts[1], { from: accounts[0] }))
  })

  it('should preventing removing an admin when it is not an admin', async () => {

    // Add an accct to the admin list
    await tokenInstance.addAdmin(accounts[1], { from: accounts[0] })

    // The first removal should succeed.
    await tokenInstance.removeAdmin(accounts[1], { from: accounts[0] })

    // The second removal should fail
    await expectRevert.unspecified(tokenInstance.removeAdmin(accounts[1], { from: accounts[0] }))
  })
})
