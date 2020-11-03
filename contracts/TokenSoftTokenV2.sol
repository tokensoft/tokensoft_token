pragma solidity 0.5.16;

import "./TokenSoftToken.sol";
import "./capabilities/Blacklistable.sol";
import "./capabilities/RevocableToAddress.sol";

contract TokenSoftTokenV2 is TokenSoftToken, Blacklistable, RevocableToAddress {

  // ERC1404 Error codes and messages
  uint8 public constant FAILURE_BLACKLIST = 3;
  string public constant FAILURE_BLACKLIST_MESSAGE = "The transfer was restricted due to blacklist configuration.";

  function detectTransferRestriction (address from, address to, uint256 amt)
        public
        view
        returns (uint8)
    {
        // Restrictions are enabled, so verify the whitelist config allows the transfer.
        // Logic defined in Blacklistable parent class
        if(!checkBlacklistAllowed(from, to)) {
            return FAILURE_BLACKLIST;
        }

        return super.detectTransferRestriction(from, to, amt);
    }

  function messageForTransferRestriction (uint8 restrictionCode)
        public
        view
        returns (string memory)
    {
        if (restrictionCode == FAILURE_BLACKLIST) {
            return FAILURE_BLACKLIST_MESSAGE;
        }
        
        return super.messageForTransferRestriction(restrictionCode);
    }
}