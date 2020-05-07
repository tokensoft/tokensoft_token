const BigNumber = require('bignumber.js')

module.exports = {
  name: "Tokensoft Token",
  symbol: "SOFT",
  decimals: 18,
  supply: new BigNumber(10).pow(18).multipliedBy(50).multipliedBy(1000000000),
}