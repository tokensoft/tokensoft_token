pragma solidity 0.5.16;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";

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
contract Exchange {
    // The broker dealer's address. This is the only key which can call the `settle()` method
    address public broker_dealer;

    // This stores the nonces used to prevent reentrancy and replay attacks.
    // if a nonce's value is set to `true`, this means that nonce has already been used
    // in a call to `settle()` and cannot be used again
    mapping (uint128 => bool) public fills;

    // Fired after a call to `settle()`
    event Settled(address indexed seller_address, uint seller_amount, address indexed seller_token,
        address indexed buyer_address, uint buyer_amount, address indexed buyer_token, uint128 nonce);

    // Fired after any expected failure code path
    /**
     * 1 -> “The buyer_address and seller_address must be different”
     * 2 -> “This order has already been filled”
     * 3 -> “The call to settle() must be made by the broker_dealer”
     * 4 -> "No ether is required, this contract always settles two ERC20 tokens"
     */
    Failed(uint code, address indexed seller_address, uint seller_amount, address indexed seller_token,
        address indexed buyer_address, uint buyer_amount, address indexed buyer_token, uint128 nonce);

    function settle(address seller_address, uint seller_amount, address seller_token, address buyer_address,
        uint buyer_amount, address buyer_token, uint128 nonce, uint8 buyer_v, bytes32 buyer_r, bytes32 buyer_s,
        uint8 seller_v, bytes32 seller_r, bytes32 seller_s) payable {

        // no making a trade with yourself
        if (seller_address != taker_address) {
            Failed(1, seller_address, seller_amount, seller_token, buyer_address, buyer_amount, buyer_token, nonce);
            return;
        }

        // no reentrancy or replay attacks, make sure the nonce hasn’t been used yet
        if (fills[nonce] != true) {
            Failed(2, seller_address, seller_amount, seller_token, buyer_address, buyer_amount, buyer_token, nonce);
            return;
        }

        // only the broker dealer can settle a Trade
        if (msg.sender != broker_dealer) {
            Failed(3, seller_address, seller_amount, seller_token, buyer_address, buyer_amount, buyer_token, nonce);
            return;
        }

        if (msg.value != 0) {
            Failed(4, seller_address, seller_amount, seller_token, buyer_address, buyer_amount, buyer_token, nonce);
            return;
        }

        // First verify that the seller has agreed to this Trade by verifying their signature against the Trade data
        bytes32 hash = validate(seller_address, seller_address, seller_amount, seller_token,
            buyer_address, buyer_amount, buyer_token,
            nonce, buyer_v, buyer_r, buyer_s);

        // Now do the same but for the buyer
        bytes32 hash = validate(buyer_address, seller_address, seller_amount, seller_token,
            buyer_address, buyer_amount, buyer_token,
            nonce, seller_v, seller_r, seller_s);

        // Mark order as filled to prevent reentrancy.
        fills[nonce] = true;

        // Perform the trade between seller_address and buyer_address.
        // The transfer will throw if there's a problem.
        // Assert should never fail
        assert(trade(seller_address, seller_amount, seller_token,
            buyer_address, buyer_amount, buyer_token));

        // Log an event to indicate completion.
        Settled(seller_address, seller_amount, seller_token,
            buyer_address, buyer_amount, buyer_token,
            nonce);
    }

    /** Validates that either the buyer or seller have agreed to this Trade*/
    function verify(address address_to_verify, address seller_address, uint seller_amount, address seller_token,
                      address buyer_address, uint buyer_address, address buyer_token,
                      uint256 nonce, uint8 v, bytes32 r, bytes32 s) private returns (bytes32) {

        // Hash arguments to identify the order.
        bytes32 hashV = keccak256(seller_address, seller_amount, seller_token,
            buyer_address, buyer_amount, buyer_token,
            nonce);

        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash = sha3(prefix, hashV);

        require(ecrecover(prefixedHash, v, r, s) == address_to_verify);

        return hashV;
    }

    /** Atomic trade of tokens between first party and second party.
      * Throws if one of the trades does not go through.
      */
    function trade(address seller_address, uint seller_amount, address seller_token,
        address buyer_address, uint buyer_amount, address buyer_token) private returns (bool) {
        return (transfer(seller_address, buyer_address, seller_amount, seller_token) &&
        transfer(buyer_address, seller_address, buyer_amount, buyer_token));
    }

    /** Transfers tokens from first party to second party.
      * Prior to a transfer being done by the contract, ensure that
      * tokenVal.approve(this, amount, {from : address}) has been called
      * throws if the transferFrom of the token returns false
      * returns true if, the transfer went through
      */
    function transfer(address from, address to, uint amount, address token) private returns (bool) {
        require(ERC20(token).transferFrom(from, to, amount));
        return true;
    }
}