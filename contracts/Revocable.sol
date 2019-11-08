pragma solidity 0.5.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./AdminRole.sol";

contract Revocable is ERC20, AdminRole {

  event Revoke(address indexed revoker, address indexed from, uint256 amount);

  function revoke(
    address _from,
    uint256 _amount
  )
    public
    onlyAdmin
    returns (bool)
  {
    ERC20._transfer(_from, msg.sender, _amount);
    emit Revoke(msg.sender, _from, _amount);
    return true;
  }
}