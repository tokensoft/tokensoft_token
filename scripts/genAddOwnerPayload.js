const abi = require('../build/contracts/TokenSoftToken.json').abi
const Web3 = require('web3')

// Example script for showing how to generate the data payload for adding an address to a whitelist
const run = async () => {
  console.log('Generating data payload to add address to owner')
  const web3 = new Web3()
  const tokenInst = new web3.eth.Contract(
    abi,
    '0x4A64515E5E1d1073e83f30cB97BEd20400b66E10'
  )

  let newOwner = '0x1F01c8d636d2072f1948a42c8307311aF021134D'
  const payload = await tokenInst.methods.addOwner(newOwner).encodeABI()

  console.log(payload)
  console.log('')

}

run()