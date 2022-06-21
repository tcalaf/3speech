// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ProofOfHumanity {
  mapping (address => bool) private registered;

  function isRegistered(address _user) external view returns (bool) {
    return registered[_user];
  }

  function addRegistration(address _user) external {
    registered[_user] = true;
  }
}