pragma solidity 0.5.16;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "../roles/OwnerRole.sol";

contract Burnable is ERC20, OwnerRole {
  event Burn(address indexed burner, address indexed account, uint256 amount);

  function _burn(address burner, address account, uint256 amount) internal returns (bool) {
      ERC20._burn(account, amount);
      emit Burn(burner, account, amount);
      return true;
  }
}