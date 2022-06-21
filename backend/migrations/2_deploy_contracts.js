const ProofOfHumanity = artifacts.require("ProofOfHumanity");
const FreeSpeech = artifacts.require("FreeSpeech");

module.exports = async function(deployer, network, accounts) {
  await deployer.deploy(ProofOfHumanity);
  const pohInstance = await ProofOfHumanity.deployed();
  await pohInstance.addRegistration(accounts[1]);
  await pohInstance.addRegistration(accounts[7]);
  await pohInstance.addRegistration(accounts[8]);
  await deployer.deploy(FreeSpeech, ProofOfHumanity.address);
};