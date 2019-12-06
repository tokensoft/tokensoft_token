/* global artifacts contract it assert */
const ArcaToken = artifacts.require('ArcaToken')
const Proxy = artifacts.require('Proxy')

const SUCCESS_CODE = 0
const FAILURE_NON_WHITELIST = 1
const SUCCESS_MESSAGE = 'SUCCESS'
const FAILURE_NON_WHITELIST_MESSAGE = 'The transfer was restricted due to white list configuration.'
const UNKNOWN_ERROR = 'Unknown Error Code'

contract('1404 Restrictions', (accounts) => {
  let tokenInstance, tokenDeploy, proxyInstance, ProxyToken
  beforeEach(async () => {
    tokenDeploy = await ArcaToken.new()
    proxyInstance = await Proxy.new(tokenDeploy.address)
    tokenInstance = await ArcaToken.at(proxyInstance.address)//new web3.eth.Contract(ArcaToken.abi, proxyInstance.address)

    await tokenInstance.initialize(accounts[0], {from: accounts[0]});

  })

  it('should deploy', async () => {

    assert.equal(tokenInstance !== null, true, 'Contract should be deployed')
  })

  it('should fail with non whitelisted accounts', async () => {

    // Set account 1 as an admin
    await tokenInstance.addAdmin(accounts[1])

    // Both not on white list - should fail
    let failureCode = await tokenInstance.detectTransferRestriction.call(accounts[5], accounts[6], 100)
    console.log('failure code is ', failureCode)
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

  it('should allow whitelists to be removed', async () => {

    // Set account 1 as an admin
    await tokenInstance.addAdmin(accounts[1])

    // Both not on white list
    const failureCode = await tokenInstance.detectTransferRestriction.call(accounts[7], accounts[8], 100)
    const failureMessage = await tokenInstance.messageForTransferRestriction(failureCode)
    assert.equal(failureCode, FAILURE_NON_WHITELIST, 'Both Non-whitelisted should get failure code')
    assert.equal(failureMessage, FAILURE_NON_WHITELIST_MESSAGE, 'Failure message should be valid for restriction')
  })

  it('should handle unknown error codes', async () => {

    const failureMessage = await tokenInstance.messageForTransferRestriction(1001)
    assert.equal(failureMessage, UNKNOWN_ERROR, 'Should be unknown error code for restriction')
  })
})
