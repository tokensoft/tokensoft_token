pragma solidity 0.5.16;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";
import "../roles/OwnerRole.sol";
import "../roles/AdminRole.sol";
import "../capabilities/Mintable.sol";
import "../capabilities/Revocable.sol";
import "./Escrowable.sol";

contract TokenSoftTokenEscrowNotProxiable is ERC20Detailed, OwnerRole, AdminRole, Mintable, Revocable, Escrowable {

    // Token Details
    string constant TOKEN_NAME = "TokenSoft Token";
    string constant TOKEN_SYMBOL = "SOFT";
    uint8 constant TOKEN_DECIMALS = 18;

    // Token supply - 50 Billion Tokens, with 18 decimal precision
    uint256 constant BILLION = 1000000000;
    uint256 constant TOKEN_SUPPLY = 50 * BILLION * (10 ** uint256(TOKEN_DECIMALS));

    // ERC1404 Error codes and messages
    uint8 public constant SUCCESS_CODE = 0;
    uint8 public constant FAILURE_NON_WHITELIST = 1;
    uint8 public constant FAILURE_PAUSED = 2;
    string public constant SUCCESS_MESSAGE = "SUCCESS";
    string public constant FAILURE_NON_WHITELIST_MESSAGE = "The transfer was restricted due to white list configuration.";
    string public constant FAILURE_PAUSED_MESSAGE = "The transfer was restricted due to the contract being paused.";
    string public constant UNKNOWN_ERROR = "Unknown Error Code";

    /**
    Constructor for the token to set readable details and mint all tokens
    to the specified owner.
     */
    function initialize (address owner)
        public
        initializer
    {
        ERC20Detailed.initialize(TOKEN_NAME, TOKEN_SYMBOL, TOKEN_DECIMALS);
        Mintable._mint(msg.sender, owner, TOKEN_SUPPLY);
        _addOwner(owner);
    }

    /**
    Allow Owners to mint tokens to valid addresses
    */
    function mint(address account, uint256 amount) public onlyOwner returns (bool) {
        Mintable._mint(msg.sender, account, amount);
        return true;
    }

    /**
    Restrict rejectTransferProposals to admins only
     */
    function rejectTransferProposal(uint requestId) public onlyAdmin {
      Escrowable._rejectTransferProposal(requestId);
    }

    /**
    Restrict approveTransferProposals to admins only
     */
    function approveTransferProposal(uint requestId) public onlyAdmin {
      Escrowable._approveTransferProposal(requestId);
    }

    /**
    Overrides the parent class token transfer function to enforce restrictions.
     */
    function transfer (address to, uint256 value)
        public
        returns (bool success)
    {
        success = Escrowable._createTransferProposal(to, value);
    }

    /**
    Overrides the parent class token transferFrom function to enforce restrictions.
    Note that the approved amount of tokens the sender can transfer does not get reimbursed if the
    Transfer proposal is rejcted or canceled.
     */
    function transferFrom (address from, address to, uint256 value)
        public
        returns (bool success)
    {
        success = Escrowable._createTransferFromProposal(from, to, value);
    }
}
