/* global artifacts contract it assert */
const TokenSoftToken = artifacts.require('TokenSoftTokenV2')
const Proxy = artifacts.require('Proxy')

const SUCCESS_CODE = 0
const FAILURE_NON_WHITELIST = 1
const FAILURE_PAUSED = 2
const SUCCESS_MESSAGE = 'SUCCESS'
const FAILURE_NON_WHITELIST_MESSAGE = 'The transfer was restricted due to white list configuration.'
const FAILURE_PAUSED_MESSAGE = "The transfer was restricted due to the contract being paused."
const UNKNOWN_ERROR = 'Unknown Error Code'

const Constants = require('./Constants')

contract('1404 Restrictions', (accounts) => {
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

  it('should fail with non whitelisted accounts', async () => {

    // Set account 1 as an admin
    await tokenInstance.addWhitelister(accounts[1])

    // Both not on white list - should fail
    let failureCode = await tokenInstance.detectTransferRestriction.call(accounts[5], accounts[6], 100)
    let failureMessage = await tokenInstance.messageForTransferRestriction(failureCode)
    assert.equal(failureCode, FAILURE_NON_WHITELIST, 'Both Non-whitelisted should get failure code')
    assert.equal(failureMessage, FAILURE_NON_WHITELIST_MESSAGE, 'Failure message should be valid for restriction')

    // Only one added to white list 20 - should fail
    await tokenInstance.addToWhitelist(accounts[5], 20, { from: accounts[1] })
    failureCode = await tokenInstance.detectTransferRestriction.call(accounts[5], accounts[6], 100)
    failureMessage = await tokenInstance.messageForTransferRestriction(failureCode)
    assert.equal(failureCode, FAILURE_NON_WHITELIST, 'One Non-whitelisted should get failure code')
    assert.equal(failureMessage, FAILURE_NON_WHITELIST_MESSAGE, 'Failure message should be valid for restriction')

    // Second added to white list 20 - should still fail
    await tokenInstance.addToWhitelist(accounts[6], 20, { from: accounts[1] })
    failureCode = await tokenInstance.detectTransferRestriction.call(accounts[5], accounts[6], 100)
    failureMessage = await tokenInstance.messageForTransferRestriction(failureCode)
    assert.equal(failureCode, FAILURE_NON_WHITELIST, 'Both in different whitelist should get failure code')
    assert.equal(failureMessage, FAILURE_NON_WHITELIST_MESSAGE, 'Failure message should be valid for restriction')

    // Now allow whitelist 20 to send to itself
    await tokenInstance.updateOutboundWhitelistEnabled(20, 20, true, { from: accounts[1] })

    // Should now succeed
    failureCode = await tokenInstance.detectTransferRestriction.call(accounts[5], accounts[6], 100)
    failureMessage = await tokenInstance.messageForTransferRestriction(failureCode)
    assert.equal(failureCode, SUCCESS_CODE, 'Both in same whitelist should pass')
    assert.equal(failureMessage, SUCCESS_MESSAGE, 'Should be success')

    // Second moved to whitelist 30 - should fail
    await tokenInstance.addToWhitelist(accounts[6], 30, { from: accounts[1] })
    failureCode = await tokenInstance.detectTransferRestriction.call(accounts[5], accounts[6], 100)
    failureMessage = await tokenInstance.messageForTransferRestriction(failureCode)
    assert.equal(failureCode, FAILURE_NON_WHITELIST, 'Both in different whitelist should get failure code')
    assert.equal(failureMessage, FAILURE_NON_WHITELIST_MESSAGE, 'Failure message should be valid for restriction')

    // Allow whitelist 20 to send to 30
    await tokenInstance.updateOutboundWhitelistEnabled(20, 30, true, { from: accounts[1] })

    // Should now succeed
    failureCode = await tokenInstance.detectTransferRestriction.call(accounts[5], accounts[6], 100)
    failureMessage = await tokenInstance.messageForTransferRestriction(failureCode)
    assert.equal(failureCode, SUCCESS_CODE, 'Both in same whitelist should pass')
    assert.equal(failureMessage, SUCCESS_MESSAGE, 'Should be success')

    // Reversing directions should fail
    failureCode = await tokenInstance.detectTransferRestriction.call(accounts[6], accounts[5], 100)
    failureMessage = await tokenInstance.messageForTransferRestriction(failureCode)
    assert.equal(failureCode, FAILURE_NON_WHITELIST, 'Both in different whitelist should get failure code')
    assert.equal(failureMessage, FAILURE_NON_WHITELIST_MESSAGE, 'Failure message should be valid for restriction')

    // Disable 20 sending to 30
    await tokenInstance.updateOutboundWhitelistEnabled(20, 30, false, { from: accounts[1] })

    // Should fail again
    failureCode = await tokenInstance.detectTransferRestriction.call(accounts[5], accounts[6], 100)
    failureMessage = await tokenInstance.messageForTransferRestriction(failureCode)
    assert.equal(failureCode, FAILURE_NON_WHITELIST, 'Both in different whitelist should get failure code')
    assert.equal(failureMessage, FAILURE_NON_WHITELIST_MESSAGE, 'Failure message should be valid for restriction')

    // Move second address back to whitelist 20 - should pass
    await tokenInstance.addToWhitelist(accounts[6], 20, { from: accounts[1] })
    failureCode = await tokenInstance.detectTransferRestriction.call(accounts[5], accounts[6], 100)
    failureMessage = await tokenInstance.messageForTransferRestriction(failureCode)
    assert.equal(failureCode, SUCCESS_CODE, 'Both in same whitelist should pass')
    assert.equal(failureMessage, SUCCESS_MESSAGE, 'Should be success')

    // First removed from whitelist
    await tokenInstance.removeFromWhitelist(accounts[5], { from: accounts[1] })
    failureCode = await tokenInstance.detectTransferRestriction.call(accounts[5], accounts[6], 100)
    failureMessage = await tokenInstance.messageForTransferRestriction(failureCode)
    assert.equal(failureCode, FAILURE_NON_WHITELIST, 'Both in different whitelist should get failure code')
    assert.equal(failureMessage, FAILURE_NON_WHITELIST_MESSAGE, 'Failure message should be valid for restriction')
  })

  it('Should fail when paused', async () => {
    // add account as pauser
    await tokenInstance.addPauser(accounts[0])

    // pause the contract
    await tokenInstance.pause()
   
    const failureCode = await tokenInstance.detectTransferRestriction.call(accounts[7], accounts[8], 100)
    const failureMessage = await tokenInstance.messageForTransferRestriction(failureCode)
    assert.equal(failureCode, FAILURE_PAUSED, 'Contract paused should get failure code')
    assert.equal(failureMessage, FAILURE_PAUSED_MESSAGE, 'Failure message should be valid for restriction')
  })

  it('should allow whitelists to be removed', async () => {

    // Set account 1 as an admin
    await tokenInstance.addWhitelister(accounts[1])

    // Both not on white list
    const failureCode = await tokenInstance.detectTransferRestriction.call(accounts[7], accounts[8], 100)
    const failureMessage = await tokenInstance.messageForTransferRestriction(failureCode)
    assert.equal(failureCode, FAILURE_NON_WHITELIST, 'Both Non-whitelisted should get failure code')
    assert.equal(failureMessage, FAILURE_NON_WHITELIST_MESSAGE, 'Failure message should be valid for restriction')
  })

  it('should handle unknown error codes', async () => {

    const failureMessage = await tokenInstance.messageForTransferRestriction(200)
    assert.equal(failureMessage, UNKNOWN_ERROR, 'Should be unknown error code for restriction')
  })
})
