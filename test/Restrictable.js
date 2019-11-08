/* global artifacts contract it assert */
const { shouldFail, expectEvent } = require('openzeppelin-test-helpers')
const ArcaToken = artifacts.require('ArcaToken')

contract('Restrictable', (accounts) => {
  it('should deploy', async () => {
    const tokenInstance = await ArcaToken.new(accounts[0])
    assert.equal(tokenInstance !== null, true, 'Contract should be deployed')
  })

  it('should default to restriction enabled and be changeable', async () => {
    const tokenInstance = await ArcaToken.new(accounts[0])

    // Check initial value
    let isRestricted = await tokenInstance.isRestrictionEnabled.call()
    assert.equal(isRestricted, true, 'Should be restricted by default')

    // Let the owner update
    await tokenInstance.disableRestrictions({ from: accounts[0] })

    // Should now be disabled
    isRestricted = await tokenInstance.isRestrictionEnabled.call()
    assert.equal(isRestricted, false, 'Should be disabled by admin')
  })

  it('should only allow owner to update', async () => {
    const tokenInstance = await ArcaToken.new(accounts[0])

    await shouldFail.reverting(tokenInstance.disableRestrictions({ from: accounts[5] }))
    await shouldFail.reverting(tokenInstance.disableRestrictions({ from: accounts[6] }))
  })

  it('should not block transfers after disabled', async () => {
    const tokenInstance = await ArcaToken.new(accounts[0])

    // disable restrictioans
    await tokenInstance.disableRestrictions({ from: accounts[0] })

    // transfer tokens between non whitelisted accounts; should succeed
    await tokenInstance.transfer(accounts[1], 100, {from: accounts[0]})
    await tokenInstance.transfer(accounts[2], 100, {from: accounts[1]})
  })

  it('should trigger events', async () => {
    const tokenInstance = await ArcaToken.new(accounts[0])

    // Turn it off
    let ret = await tokenInstance.disableRestrictions({ from: accounts[0] })
    expectEvent.inLogs(ret.logs, 'RestrictionsDisabled', { owner: accounts[0] })
  })

  it('should fail to be disabled on the second try', async () => {
    const tokenInstance = await ArcaToken.new(accounts[0])

    // First time should succeed
    await tokenInstance.disableRestrictions({ from: accounts[0] })

    // Second time should fail
    await shouldFail.reverting(tokenInstance.disableRestrictions({ from: accounts[0] }))
  })
})