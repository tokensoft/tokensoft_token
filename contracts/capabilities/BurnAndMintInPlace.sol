pragma solidity 0.6.12;

import "../@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "../roles/BurnerRole.sol";
import "../roles/MinterRole.sol";

contract BurnAndMintInPlace is ERC20, BurnerRole, MinterRole; {

  event burnAndMintInPlace(address indexed burner, address indexed from, address indexed to, uint256 amount);

  function _burnAndMintInPlace(
    address _from,
    address _to,
    uint256 _amount
  )
    internal
    returns (bool)
  {
    ERC20._burn(from, amount);
    ERC20._mint(to,amount);
    emit burnAndMintInPlace(msg.sender, _from, _to, _amount);
    return true;
  }

  /**
  Allows Burner role to burn and mint 
    */
  function burnAndMintInPlace(address from, address to, uint256 amount) public onlyRevoker returns (bool) {
      return _burnAndMintInPlace(from, to, amount);
  }
}