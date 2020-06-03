pragma solidity 0.5.16;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";

/** @title Tokensoft Delivery vs. Payment Contract. Allows Buyer and Seller ERC20 tokens to be atomically
  * swapped when OK'ed by a Broker Dealer. This atomic swapping is called Delivery vs. Payment in traditional
  * finance.
  *
  * Buyers and Sellers create Orders off-chain, and a Breaker Dealer matches those orders off-chain
  * to create a Trade. The Broker Dealer then gathers the necessary legal signatures and digital
  * signatures from the Buyer and Seller. Finally, the Broker dealer calls the `settle` method
  * with the required Buyer and Seller signatures, which settles the Trade by performing an atomic
  * swap.
  *
  * Assumes sellers and buyers have approved this contract to access their balances.
  */
contract DvPSettlement {
    // The broker dealer's address. This is the only key which can call the `settle()` method
    address public broker_dealer;

    // This stores the nonces used to prevent reentrancy and replay attacks.
    // if a nonce's value is set to `true`, this means that nonce has already been used
    // in a call to `settle()` and cannot be used again
    mapping (uint128 => bool) public fills;

    // Fired after a call to `settle()`
    event Settled(address seller_address, uint seller_amount, address indexed seller_token,
        address buyer_address, uint buyer_amount, address indexed buyer_token, uint128 nonce);

    // Fired after any expected failure code path
    /**
     * 1 -> “The seller_address and buyer_address must be different”
     * 2 -> “This order has already been filled”
     * 3 -> “The call to settle() must be made by the broker_dealer”
     */
    event Failed(uint code, address seller_address, uint seller_amount, address indexed seller_token,
        address buyer_address, uint buyer_amount, address indexed buyer_token, uint128 nonce);

    /** Settle an off-chain Trade between a Buyer and Seller, approved by the broker_dealer
     *
     * Buyer and Seller create buy and sell Orders offchain. The Broker Dealer reviews the Orders, matches
     * a pair of them to create a Trade, generates a nonce (to prevent re-entrancy and replay attacks),
     * and then gets a cryptographic signature from each of the Buyer and Seller in which they commit to the
     * terms of the Trade. The Broker Dealer does a final review of the Trade and finally calls `settle()`
     * with the appropriate arguments.
     *
     * This call assumes that `seller_address` and `buyer_address` are holders of an ERC20 token, and that
     * prior to the call to `settle()` they have each called `ERC20.approve()` for the at least the amounts
     * they want settled in the Trade. Failure to do so will cause the call to `settle()` to fail.
     */
    function settle(address seller_address, uint seller_amount, address seller_token, address buyer_address,
        uint buyer_amount, address buyer_token, uint128 nonce, uint8 buyer_v, bytes32 buyer_r, bytes32 buyer_s,
        uint8 seller_v, bytes32 seller_r, bytes32 seller_s) external {

        // no making a trade with yourself
        if (seller_address == buyer_address) {
            emit_failed(1, seller_address, seller_amount, seller_token, buyer_address, buyer_amount, buyer_token, nonce);
            return;
        }

        // no reentrancy or replay attacks, make sure the nonce hasn’t been used yet
        if (fills[nonce] != true) {
            emit_failed(2, seller_address, seller_amount, seller_token, buyer_address, buyer_amount, buyer_token, nonce);
            return;
        }

        // only the broker dealer can settle a Trade
        if (msg.sender != broker_dealer) {
            emit_failed(3, seller_address, seller_amount, seller_token, buyer_address, buyer_amount, buyer_token, nonce);
            return;
        }

        // First verify that the Seller has agreed to this Trade by verifying their signature against the Order data
        verify(seller_address, seller_amount, seller_token, buyer_amount, buyer_token,
            nonce, seller_v, seller_r, seller_s);

        // Now do the same but for the Buyer
        verify(buyer_address, buyer_amount, buyer_token, seller_amount, seller_token,
            nonce, buyer_v, buyer_r, buyer_s);

        // Mark order as filled to prevent reentrancy.
        fills[nonce] = true;

        // Perform the trade between seller_address and buyer_address.
        // The transfer will throw if there's a problem.
        // Assert should never fail
        assert(trade(seller_address, seller_amount, seller_token,
            buyer_address, buyer_amount, buyer_token));

        // Log an event to indicate completion.
        emit_settled(seller_address, seller_amount, seller_token, buyer_address, buyer_amount, buyer_token, nonce);
    }

    /** Verifies that an investor has agreed to this Trade
     *
     * The Investor (either a Buyer or Seller) agrees to a trade by using their `investor_address`
     * private key to generate a signature for the following payload payload:
     * `bytes32 payload = keccak256(abi.encode(investor_address, investor_amount, investor_token,
            other_amount, other_token, nonce))`
     *
     * For example, An investor will commit to the statement "I agree to buy 10 REP for 20 OMG using my address
     * "0x7141fa6801ae65a8d127152a9d8fa4e6b1eeab97bc16a2c87bda936b6039787c" with nonce 42". In this example
     * the function argument values are:
     *
     * investor_address: "0x7141fa6801ae65a8d127152a9d8fa4e6b1eeab97bc16a2c87bda936b6039787c"
     * investor_amount: 10
     * investor_token: REP
     * other_amount: 20
     * other_token: OMG
     * nonce: 42
     *
     * and v, r, s is return value of `web3.eth.sign(investor_address, payload);
    */
    function verify(address investor_address, uint investor_amount, address investor_token,
                    uint other_amount, address other_token, uint256 nonce, uint8 v,
                    bytes32 r, bytes32 s) private pure returns (bytes32) {

        // Hash arguments to identify the order.
        bytes32 hashV = keccak256(abi.encode(investor_address, investor_amount, investor_token,
            other_amount, other_token, nonce));

        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash = keccak256(abi.encode(prefix, hashV));

        require(ecrecover(prefixedHash, v, r, s) == investor_address, "signature verification failed");

        return hashV;
    }

    /** Atomic trade of tokens between first party and second party.
      * Throws if one of the trades does not go through.
      */
    function trade(address seller_address, uint seller_amount, address seller_token,
        address buyer_address, uint buyer_amount, address buyer_token) private returns (bool) {
        // send tokens from buyer to seller, reverting if anything goes wrong
        transfer(seller_address, buyer_address, seller_amount, seller_token);

        // send tokens from seller to buyer, reverting if anything goes wrong
        transfer(buyer_address, seller_address, buyer_amount, buyer_token);

        return true;
    }

    /** Transfers tokens from first party to second party.
      * Prior to a transfer being done by the contract, ensure that
      * tokenVal.approve(this, amount, {from : address}) has been called
      * throws if the transferFrom of the token returns false
      */
    function transfer(address from, address to, uint amount, address token) private {
        require(ERC20(token).transferFrom(from, to, amount), "transfer failed");
    }

    /**
     * Fire a Failed event with the appropriate failure code.
     *
     * We use this simple function to get around the unfortunate fact that if we called it inline, the compiler
     * would complain about a "Stack Too Deep Error". See the following blog post for details:
     * https://blog.aventus.io/stack-too-deep-error-in-solidity-5b8861891bae
     */
    function emit_failed(uint8 code, address seller_address, uint seller_amount, address seller_token, address buyer_address,
        uint buyer_amount, address buyer_token, uint128 nonce) private {
        emit Failed(code, seller_address, seller_amount, seller_token, buyer_address, buyer_amount, buyer_token, nonce);
    }

    /**
     * Fire a Settled event
     *
     * We use this simple function to get around the unfortunate fact that if we called it inline, the compiler
     * would complain about a "Stack Too Deep Error". See the following blog post for details:
     * https://blog.aventus.io/stack-too-deep-error-in-solidity-5b8861891bae
     */
    function emit_settled(address seller_address, uint seller_amount, address seller_token,
        address buyer_address, uint buyer_amount, address buyer_token, uint128 nonce) private {
        emit Settled(seller_address, seller_amount, seller_token,
            buyer_address, buyer_amount, buyer_token,
            nonce);
    }
}