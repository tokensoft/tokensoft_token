pragma solidity 0.6.12;

import "./TokenSoftToken.sol";
import "./capabilities/Blacklistable.sol";
import "./capabilities/RevocableToAddress.sol";

contract TokenSoftTokenV2 is TokenSoftToken, Blacklistable, RevocableToAddress {

  // ERC1404 Error codes and messages
  uint8 public constant FAILURE_BLACKLIST = 3;
  string public constant FAILURE_BLACKLIST_MESSAGE = "Restricted due to blacklist";

  function detectTransferRestriction (address from, address to, uint256 amt)
        public
        override
        view
        returns (uint8)
    {
        // Restrictions are enabled, so verify the whitelist config allows the transfer.
        // Logic defined in Blacklistable parent class
        if(!checkBlacklistAllowed(from, to)) {
            return FAILURE_BLACKLIST;
        }

        return TokenSoftToken.detectTransferRestriction(from, to, amt);
    }

  function messageForTransferRestriction (uint8 restrictionCode)
        public
        override
        view
        returns (string memory)
    {
        if (restrictionCode == FAILURE_BLACKLIST) {
            return FAILURE_BLACKLIST_MESSAGE;
        }
        
        return TokenSoftToken.messageForTransferRestriction(restrictionCode);
    }

    /**
    Overrides the parent class token transfer function to enforce restrictions.
     */
    function transfer (address to, uint256 value)
        public
        override(TokenSoftToken, ERC20)
        notRestricted(msg.sender, to, value)
        returns (bool success)
    {
        return TokenSoftToken.transfer(to, value);
    }

    /**
    Overrides the parent class token transferFrom function to enforce restrictions.
     */
    function transferFrom (address from, address to, uint256 value)
        public
        override(TokenSoftToken, ERC20)
        notRestricted(from, to, value)
        returns (bool success)
    {
        return TokenSoftToken.transferFrom(from, to, value);
    }
}