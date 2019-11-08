/* global web3, artifacts */
var SukuToken = artifacts.require('./SukuToken.sol')

// Example script for showing how to generate the data payload for adding an address to a whitelist
module.exports = async function (callback) {
  console.log('Generating data payload to add address to whitelist')
  const tokenInst = new web3.eth.Contract(
    SukuToken.abi,
    '0x0000000000000000000000000000000000000000'
  )
  let payload
  try {
    let addressToBeWhitelisted = '0x0000000000000000000000000000000000000000'
    let whitelistId = 1
    payload = await tokenInst.methods.addToWhitelist(addressToBeWhitelisted, whitelistId).encodeABI()
  } catch (ex) {
    console.log(ex)
  }
  console.log(payload)
  console.log('')
  callback()
}
