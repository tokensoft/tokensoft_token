/* global artifacts contract it assert */
const { shouldFail, expectEvent } = require('openzeppelin-test-helpers')
const ArcaToken = artifacts.require('ArcaToken')

/**
 * Sanity check for transferring ownership.  Most logic is fully tested in OpenZeppelin lib.
 */
contract('Pauseable', (accounts) => {
  // set up account roles
  const ownerAccount = accounts[0]
  const adminAccount = accounts[1]
  const whitelistedAccount = accounts[2]
  const whitelistedAccount2 = accounts[3]
  const nonWhitelistedAccount = accounts[4]

  it('Owner should be able to pause contract', async () => {
    const tokenInstance = await ArcaToken.new(ownerAccount)
    assert.equal(tokenInstance !== null, true, 'Contract should be deployed')

    // get initial pause state
    const isPaused = await tokenInstance.paused()
    assert.equal(isPaused, false, 'Contract should not be paused initially')

    // pause the contract
    await tokenInstance.pause({ from: ownerAccount })

    const isPausedPostPause = await tokenInstance.paused()
    assert.equal(isPausedPostPause, true, 'Contract should be paused')
  })

  it('Only owner should be able to pause contract', async () => {
    const tokenInstance = await ArcaToken.new(ownerAccount)
    assert.equal(tokenInstance !== null, true, 'Contract should be deployed')

    // add admin and whitelist accounts
    await tokenInstance.addAdmin(adminAccount, { from: ownerAccount })
    await tokenInstance.addToWhitelist(whitelistedAccount, 1, { from: adminAccount })

    // pause the contract
    await shouldFail.reverting(tokenInstance.pause({ from: adminAccount }))
    await shouldFail.reverting(tokenInstance.pause({ from: whitelistedAccount }))
    await shouldFail.reverting(tokenInstance.pause({ from: nonWhitelistedAccount }))

  })

  it('Paused contract should prevent all transfers', async () => {
    const tokenInstance = await ArcaToken.new(ownerAccount)
    assert.equal(tokenInstance !== null, true, 'Contract should be deployed')

    // set up the amounts to test
    const transferAmount = 100

    // add admin and whitelist accounts
    await tokenInstance.addAdmin(adminAccount, { from: ownerAccount })
    await tokenInstance.addToWhitelist(whitelistedAccount, 1, { from: adminAccount })
    await tokenInstance.addToWhitelist(whitelistedAccount2, 1, { from: adminAccount })

    // transfer tokens to whitelisted account
    await tokenInstance.transfer(whitelistedAccount, transferAmount, { from: ownerAccount })
    await tokenInstance.updateOutboundWhitelistEnabled(1, 1, true, { from: adminAccount })

    // transfer tokens between whitelisted accounts, should succeed
    await tokenInstance.transfer(whitelistedAccount2, transferAmount/2, { from: whitelistedAccount })

    // pause the contract
    await tokenInstance.pause({ from: ownerAccount })

    // transfers while paused should fail
    await shouldFail.reverting(tokenInstance.transfer(whitelistedAccount2, transferAmount/2, { from: whitelistedAccount }))
    await shouldFail.reverting(tokenInstance.transfer(whitelistedAccount, transferAmount, { from: ownerAccount }))
    
  })

  it('should emit event when contract is unpaused', async () => {
    const tokenInstance = await ArcaToken.new(ownerAccount)
    assert.equal(tokenInstance !== null, true, 'Contract should be deployed')

    // pause the contract
    const { logs } =  await tokenInstance.pause({ from: ownerAccount })

    expectEvent.inLogs(logs, 'Paused', { account: ownerAccount })
  })

  it('should emit event when contract is unpaused', async () => {
    const tokenInstance = await ArcaToken.new(ownerAccount)
    assert.equal(tokenInstance !== null, true, 'Contract should be deployed')

    // pause the contract
    await tokenInstance.pause({ from: ownerAccount })
    const { logs } =  await tokenInstance.unpause({ from: ownerAccount })

    expectEvent.inLogs(logs, 'Unpaused', { account: ownerAccount })
  })
})