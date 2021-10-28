module.exports = {
  // Uncommenting the defaults below
  // provides for an easier quick-start with Ganache.
  // You can also follow this format for other networks;
  // see <http://truffleframework.com/docs/advanced/configuration>
  // for more details on how to specify configuration options!

  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*",
      gas: 4600000,
      gasPrice: 300e9,
    },
    ropsten: {
      provider: () => new
        HDWalletProvider(
        ),
      gas: 4600000,
      gasPrice: 200e9,
      network_id: "3"
    },
    mainnet: {
      gas: 4600000,
      gasPrice: 200e9,
      network_id: "1"
    },
    test: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*"
    }
  },

  compilers: {
    solc: {
      version: '0.6.12',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  },
  plugins: ["solidity-coverage", "truffle-contract-size"]
}
