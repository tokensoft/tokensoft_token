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
     * 4 -> "No ether is required, this contract always settles two ERC20 tokens"
     */
    event Failed(uint code, address seller_address, uint seller_amount, address indexed seller_token,
        address buyer_address, uint buyer_amount, address indexed buyer_token, uint128 nonce);

    function settle(address seller_address, uint seller_amount, address seller_token, address buyer_address,
        uint buyer_amount, address buyer_token, uint128 nonce, uint8 buyer_v, bytes32 buyer_r, bytes32 buyer_s,
        uint8 seller_v, bytes32 seller_r, bytes32 seller_s) external payable {

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

        if (msg.value != 0) {
            emit_failed(4, seller_address, seller_amount, seller_token, buyer_address, buyer_amount, buyer_token, nonce);
            return;
        }

        // First verify that the seller has agreed to this Trade by verifying their signature against the Trade data
        bytes32 hash = verify(seller_address, seller_address, seller_amount, seller_token,
            buyer_address, buyer_amount, buyer_token,
            nonce, buyer_v, buyer_r, buyer_s);

        // Now do the same but for the buyer
        hash = verify(buyer_address, seller_address, seller_amount, seller_token,
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
        emit_settled(seller_address, seller_amount, seller_token, buyer_address, buyer_amount, buyer_token, nonce);
    }

    /** Verifies that either the buyer or seller have agreed to this Trade*/
    function verify(address address_to_verify, address seller_address, uint seller_amount, address seller_token,
                      address buyer_address, uint buyer_amount, address buyer_token,
                      uint256 nonce, uint8 v, bytes32 r, bytes32 s) private pure returns (bytes32) {

        // Hash arguments to identify the order.
        bytes32 hashV = keccak256(abi.encode(seller_address, seller_amount, seller_token,
            buyer_address, buyer_amount, buyer_token,
            nonce));

        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash = keccak256(abi.encode(prefix, hashV));

        require(ecrecover(prefixedHash, v, r, s) == address_to_verify, "signature verification failed");

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
        transfer(buyer_address, seller_address, buyer_amount, buyer_token));

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