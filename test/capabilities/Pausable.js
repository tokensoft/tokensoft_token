/* global artifacts contract it assert */
const { expectRevert, expectEvent } = require('@openzeppelin/test-helpers')
const TokenSoftToken = artifacts.require('TokenSoftTokenV2')
const Proxy = artifacts.require('Proxy')
const Constants = require('../Constants')

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

  it('Owner should be able to pause contract', async () => {
    await tokenInstance.addPauser(ownerAccount)

    // get initial pause state
    const isPaused = await tokenInstance.paused()
    assert.equal(isPaused, false, 'Contract should not be paused initially')

    // pause the contract
    await tokenInstance.pause({ from: ownerAccount })

    const isPausedPostPause = await tokenInstance.paused()
    assert.equal(isPausedPostPause, true, 'Contract should be paused')
  })

  it('Only owner should be able to pause contract', async () => {
    // pause the contract
    await expectRevert(tokenInstance.pause({ from: adminAccount }), "PauserRole: caller does not have the Pauser role")
    await expectRevert(tokenInstance.pause({ from: whitelistedAccount }), "PauserRole: caller does not have the Pauser role")
    await expectRevert(tokenInstance.pause({ from: nonWhitelistedAccount }), "PauserRole: caller does not have the Pauser role")

  })

  it('Paused contract should prevent all transfers', async () => {
    // set up the amounts to test
    const transferAmount = 100

    // add admin and whitelist accounts
    await tokenInstance.addPauser(ownerAccount)
    await tokenInstance.addWhitelister(adminAccount, { from: ownerAccount })
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
    await expectRevert(
      tokenInstance.transfer(whitelistedAccount2, transferAmount/2, { from: whitelistedAccount }),
      "The transfer was restricted due to the contract being paused."
    )
    await expectRevert(
      tokenInstance.transfer(whitelistedAccount, transferAmount, { from: ownerAccount }),
      "The transfer was restricted due to the contract being paused."
    )
    
  })

  it('should emit event when contract is unpaused', async () => {
    await tokenInstance.addPauser(ownerAccount)

    // pause the contract
    const { logs } =  await tokenInstance.pause({ from: ownerAccount })

    expectEvent.inLogs(logs, 'Paused', { account: ownerAccount })
  })

  it('should emit event when contract is unpaused', async () => {
    await tokenInstance.addPauser(ownerAccount)
    
    // pause the contract
    await tokenInstance.pause({ from: ownerAccount })
    // unpause the contract
    const { logs } =  await tokenInstance.unpause({ from: ownerAccount })

    expectEvent.inLogs(logs, 'Unpaused', { account: ownerAccount })
  })

  it('should not allow calls when already in the state', async () => {
    await tokenInstance.addPauser(ownerAccount)

    // pause the contract and should fail second time
    await tokenInstance.pause({ from: ownerAccount })
    await expectRevert(
      tokenInstance.pause({ from: ownerAccount }),
      "Pausable: paused"
    )
    
    // pause the contract and should fail second time
    await tokenInstance.unpause({ from: ownerAccount })
    await expectRevert(
      tokenInstance.unpause({ from: ownerAccount }),
      "Pausable: not paused"
    )
  })
})