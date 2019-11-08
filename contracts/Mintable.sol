pragma solidity 0.5.8;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./OwnerRole.sol";

contract Mintable is ERC20, OwnerRole {
  event Mint(address indexed minter, address indexed to, uint256 amount);

  function mint(address minter, address to, uint256 amount) internal returns (bool) {
      _mint(to, amount);
      emit Mint(minter, to, amount);
      return true;
  }
}