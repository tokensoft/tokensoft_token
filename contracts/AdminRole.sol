pragma solidity 0.5.8;

import "./OwnerRole.sol";

contract AdminRole is OwnerRole {
    using Roles for Roles.Role;

    event AdminAdded(address indexed addedAdmin, address indexed addedBy);
    event AdminRemoved(address indexed removedAdmin, address indexed removedBy);

    Roles.Role private _admins;

    modifier onlyAdmin() {
        require(isAdmin(msg.sender), "AdminRole: caller does not have the Admin role");
        _;
    }

    function isAdmin(address account) public view returns (bool) {
        return _admins.has(account);
    }

    function addAdmin(address account) public onlyOwner {
        _addAdmin(account);
    }

    function removeAdmin(address account) public onlyOwner {
        _removeAdmin(account);
    }

    function _addAdmin(address account) internal {
        _admins.add(account);
        emit AdminAdded(account, msg.sender);
    }

    function _removeAdmin(address account) internal {
        _admins.remove(account);
        emit AdminRemoved(account, msg.sender);
    }
}