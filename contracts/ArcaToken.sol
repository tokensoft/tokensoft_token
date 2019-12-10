pragma solidity 0.5.12;

import "./capabilities/Proxiable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Detailed.sol";
import "./ERC1404.sol";
import "./roles/OwnerRole.sol";
import "./roles/AdminRole.sol";
import "./capabilities/Whitelistable.sol";
import "./capabilities/Mintable.sol";
import "./capabilities/Revocable.sol";
import "./capabilities/Pausable.sol";

contract ArcaToken is Proxiable, ERC20Detailed, ERC1404, OwnerRole, AdminRole, Whitelistable, Mintable, Revocable, Pausable {

    // Token Details
    string constant TOKEN_NAME = "ARCA";
    string constant TOKEN_SYMBOL = "ARCA";
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
    Public function to update the address of the code contract, retricted to owner
     */
    function updateCodeAddress (address newAddress) public onlyOwner {
        Proxiable._updateCodeAddress(newAddress);
    }

    /**
    This function detects whether a transfer should be restricted and not allowed.
    If the function returns SUCCESS_CODE (0) then it should be allowed.
     */
    function detectTransferRestriction (address from, address to, uint256)
        public
        view
        returns (uint8)
    {
        // Check the paused status of the contract
        if (Pausable.paused()) {
            return FAILURE_PAUSED;
        }

        // Confirm that that destination address is either an Owner, Admin, or whitelisted
        if(!isValidAddress(to)) {
            return FAILURE_NON_WHITELIST;
        }

        // If an owner or an admin is transferring, then ignore reistrictions
        if(isOwner(from) || isAdmin(from)) {
            return SUCCESS_CODE;
        }

        // Restrictions are enabled, so verify the whitelist config allows the transfer.
        // Logic defined in Whitelistable parent class
        if(!checkWhitelistAllowed(from, to)) {
            return FAILURE_NON_WHITELIST;
        }

        // If no restrictions were triggered return success
        return SUCCESS_CODE;
    }

    /**
    This function allows a wallet or other client to get a human readable string to show
    a user if a transfer was restricted.  It should return enough information for the user
    to know why it failed.
     */
    function messageForTransferRestriction (uint8 restrictionCode)
        public
        view
        returns (string memory)
    {
        if (restrictionCode == SUCCESS_CODE) {
            return SUCCESS_MESSAGE;
        }

        if (restrictionCode == FAILURE_NON_WHITELIST) {
            return FAILURE_NON_WHITELIST_MESSAGE;
        }

        if (restrictionCode == FAILURE_PAUSED) {
            return FAILURE_PAUSED_MESSAGE;
        }

        // An unknown error code was passed in.
        return UNKNOWN_ERROR;
    }

    /**
    Evaluates whether a transfer should be allowed or not.
     */
    modifier notRestricted (address from, address to, uint256 value) {
        uint8 restrictionCode = detectTransferRestriction(from, to, value);
        require(restrictionCode == SUCCESS_CODE, messageForTransferRestriction(restrictionCode));
        _;
    }

    /**
    Validate that address is one of Owner, Admin, or Whitelisted
     */
    function isValidAddress(address _address) public view returns (bool) {
         return isOwner(_address) || isAdmin(_address) || addressWhitelists[_address] != 0;
    }

    /**
     * @dev Called by an Owner to pause, triggers stopped state.
     */
    function pause() public onlyOwner whenNotPaused {
        Pausable._pause();
    }

    /**
     * @dev Called by an Owner to unpause, returns to normal state.
     */
    function unpause() public onlyOwner whenPaused {
        Pausable._unpause();
    }

    /**
    Allow Owners to mint tokens to valid addresses
    */
    function mint(address account, uint256 amount) public onlyOwner returns (bool) {
        require(isValidAddress(account), "Can only mint to a valid address");
        return Mintable._mint(msg.sender, account, amount);
    }


    /**
    Allow Admins to revoke tokens from any address
     */
    function revoke(address from, uint256 amount) public onlyAdmin returns (bool) {
        return Revocable._revoke(from, amount);
    }

    /**
    Public function that allows admins to remove an address from a whitelist
     */
    function addToWhitelist(address addressToAdd, uint8 whitelist) public onlyAdmin {
        Whitelistable._addToWhitelist(addressToAdd, whitelist);
    }

    /**
    Public function that allows admins to remove an address from a whitelist
     */
    function removeFromWhitelist(address addressToRemove) public onlyAdmin {
        Whitelistable._removeFromWhitelist(addressToRemove);
    }

    /**
    Public function that allows admins to update outbound whitelists
     */
    function updateOutboundWhitelistEnabled(uint8 sourceWhitelist, uint8 destinationWhitelist, bool newEnabledValue) public onlyAdmin {
        Whitelistable._updateOutboundWhitelistEnabled(sourceWhitelist, destinationWhitelist, newEnabledValue);
    }

    /**
    Overrides the parent class token transfer function to enforce restrictions.
     */
    function transfer (address to, uint256 value)
        public
        notRestricted(msg.sender, to, value)
        returns (bool success)
    {
        success = ERC20.transfer(to, value);
    }

    /**
    Overrides the parent class token transferFrom function to enforce restrictions.
     */
    function transferFrom (address from, address to, uint256 value)
        public
        notRestricted(from, to, value)
        returns (bool success)
    {
        success = ERC20.transferFrom(from, to, value);
    }
}
