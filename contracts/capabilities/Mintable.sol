pragma solidity 0.5.12;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "../roles/OwnerRole.sol";

contract Mintable is ERC20, OwnerRole {
  event Mint(address indexed minter, address indexed to, uint256 amount);

  function _mint(address minter, address to, uint256 amount) internal returns (bool) {
      ERC20._mint(to, amount);
      emit Mint(minter, to, amount);
      return true;
  }
}