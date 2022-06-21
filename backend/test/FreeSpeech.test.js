const truffleAssert = require('truffle-assertions');
const { BN, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const FreeSpeech = artifacts.require("FreeSpeech");

contract ("FreeSpeech", ([user1, user2, user3, user4, user5, user6, user7, user8, user9, user10 ]) => {

  let instance;
  let tx;
  const basePriceForUnverifiedUser = web3.utils.toWei("100000000000000000", "wei"); // 0.1 Ether
  const basePriceForVerifiedUser = web3.utils.toWei("10000000000000000", "wei"); // 0.01 Ether
  let postCount;
  const cid = "QmPK1s3pNYLi9ERiq3BDxKa4XosgWwFRQUydHUtz4YgpqB";
  const POST_CREATION_TIMEOUT = 60; // in seconds
  const REPORT_VOTING_TIME = 60; // in seconds
  const REPORT_CHECK_WINNER_TIME = 60; // in seconds
  

  beforeEach(async () => {
    instance = await FreeSpeech.deployed();
  });

  it ("User 1 activates an unverified account", async () => {
    // User can't verify his account
    await truffleAssert.reverts(instance.getVerified({ from: user1 }),"Your address is not verified by the Proof Of Humanity system!");

    // User can't activate an account with an invalid price
    await truffleAssert.reverts(instance.activateAccount({ from: user1, value: basePriceForVerifiedUser}), "Please send a valid amount!");

    // Check user is inactive
    expect(await instance.hasActiveAccount(user1)).to.equal(false);

    // User activates account
    tx = await instance.activateAccount({ from: user1, value: basePriceForUnverifiedUser});
    truffleAssert.eventEmitted(tx, 'AccountActivated', (ev) => {
      return ev._user === user1 && ev._pricePaid == basePriceForUnverifiedUser;
    })

    // Check user is active
    expect(await instance.hasActiveAccount(user1)).to.equal(true);

    // User can't activate an account if is already activated
    await truffleAssert.reverts(instance.activateAccount({ from: user1, value: basePriceForUnverifiedUser}), "Account is already active!");
  })

  it ("User 2 activates a verified account", async () => {
    // Check user is not verified
    expect(await instance.getUserIsVerified(user2)).to.equal(false);

    // User verifies his account
    tx = await instance.getVerified({ from: user2 });
    truffleAssert.eventEmitted(tx, 'AccountVerified', (ev) => {
      return ev._user === user2;
    })

    // Check user is verified
    expect(await instance.getUserIsVerified(user2)).to.equal(true);

    // User can't verify his account again
    await truffleAssert.reverts(instance.getVerified({ from: user2 }),"Your address was already verified!");

    // Check user is inactive
    expect(await instance.hasActiveAccount(user2)).to.equal(false);

    // User activates account
    tx = await instance.activateAccount({ from: user2, value: basePriceForVerifiedUser});
    truffleAssert.eventEmitted(tx, 'AccountActivated', (ev) => {
      return ev._user === user2 && ev._pricePaid == basePriceForVerifiedUser;
    })

    // Check user is active
    expect(await instance.hasActiveAccount(user2)).to.equal(true);
  })

  it ("User 3 activates an unverified account, then deactivates it and send eth to User 4", async () => {
    // User tries to deactivate before activating
    await truffleAssert.reverts(instance.deactivateAccount(user4, { from: user3 }), "Account not active!");

    // User activates account
    tx = await instance.activateAccount({ from: user3, value: basePriceForUnverifiedUser});
    truffleAssert.eventEmitted(tx, 'AccountActivated', (ev) => {
      return ev._user === user3 && ev._pricePaid == basePriceForUnverifiedUser;
    })

    // Check user is active
    expect(await instance.hasActiveAccount(user3)).to.equal(true);

    // Check old User 4 balance
    let oldBalance = await web3.eth.getBalance(user4);

    // User deactivates account
    tx = await instance.deactivateAccount(user4, { from: user3 });
    truffleAssert.eventEmitted(tx, 'AccountDeactivated', (ev) => {
      return ev._user === user3 && ev._beneficiary === user4 && ev._pricePaid == basePriceForUnverifiedUser;
    })

    // Check new User 4 balance
    let newBalance = await web3.eth.getBalance(user4);
    expect(newBalance).to.equal(web3.utils.toBN(basePriceForUnverifiedUser).add(web3.utils.toBN(oldBalance)).toString());

    // Check user is inactive
    expect(await instance.hasActiveAccount(user3)).to.equal(false);
  })

  it ("User 4 tries to post without having an active account", async () => {
    await truffleAssert.reverts(instance.uploadPost(cid, { from: user4 }), "Account not active!");
  })

  it ("User 1 tries to upload an empty post", async () => {
    await truffleAssert.reverts(instance.uploadPost("", { from: user1 }), "Cannot pass an empty hash!");
  })

  it ("User 1 uploads his first post", async () => {
    // Check user1 has no posts
    expect(await instance.getUserPostOwnerLength(user1)).to.be.bignumber.equal(new BN(0))

    // Check there are no posts
    postCount = await instance.getPostsLength();
    expect(postCount.toString()).to.equal('0');

    // User 1 posts
    tx = await instance.uploadPost(cid, { from: user1 });
    truffleAssert.eventEmitted(tx, 'PostCreated', (ev) => {
      return ev._id.toString() === postCount.toString() && ev._ipfsHash === cid && ev._author === user1;
    })

    // Check user1 has a post
    expect(await instance.getUserPostOwnerLength(user1)).to.be.bignumber.equal(new BN(1));

    // Check user1 last post's id
    expect(await instance.getUserLastPostId(user1)).to.be.bignumber.equal(new BN(0));

    // Check there is a post
    postCount = await instance.getPostsLength();
    expect(postCount.toString()).to.equal('1');

    // Check last post's attributes
    expect(await instance.getPostIPFSHash(postCount-1)).to.equal(cid);
    expect(await instance.getPostAuthor(postCount-1)).to.equal(user1);
  })

  it ("User 4 tries to tip an invalid post id", async () => {
    await truffleAssert.reverts(instance.tipPostOwner(1, { from: user4 }), "Invalid post id!");
  })

  it ("User 1 tries to tip himself", async () => {
    await truffleAssert.reverts(instance.tipPostOwner(0, { from: user1 }), "Cannot tip your own post!");
  })

  it ("User 4 tips User 1's post", async () => {
    // Check olt tip amount
    let oldTipAmount = await instance.getPostTipAmount(0);
    expect(oldTipAmount).to.be.a.bignumber.equal('0');

    // Check User 1's old balance
    let oldUser1Balance = await web3.eth.getBalance(user1);

    tx = await instance.tipPostOwner(0, { from: user4, value: web3.utils.toWei('0.01', 'ether') });
    truffleAssert.eventEmitted(tx, 'PostTipped', (ev) => {
      return ev._id.toString() === '0' &&
      ev._tip == web3.utils.toWei('0.01', 'ether') &&
      ev._tipAmount.toString() === web3.utils.toBN(oldTipAmount).add(web3.utils.toBN(web3.utils.toWei('0.01', 'ether'))).toString() &&
      ev._author === user1 && ev._by === user4;
    });

    // Check new tip amount
    expect(await instance.getPostTipAmount(0)).to.be.a.bignumber.equal(web3.utils.toBN(oldTipAmount).add(web3.utils.toBN(web3.utils.toWei('0.01', 'ether'))).toString());

    // Check User 1's new balance
    expect(await web3.eth.getBalance(user1)).to.equal(web3.utils.toBN(web3.utils.toWei('0.01', 'ether')).add(web3.utils.toBN(oldUser1Balance)).toString());
  })

  it ("Inactive User 4 tries to report User 1", async () => {
    await truffleAssert.reverts(instance.report(0, { from: user4 }), "Account not active!");
  })

  it ("User 2 creates a post, then, after the post timeout, becomes innactive and User 3 tries to report his post", async () => {
    // User 2 creates a post
    await instance.uploadPost(cid, { from: user2 });

    // User 2 tries to post immediately after
    await truffleAssert.reverts(instance.uploadPost(cid, { from: user2 }),
    "Last post timeout has not yet ended in order to upload a new post!");

    // User 3 activates account
    await instance.activateAccount({ from: user3, value: basePriceForUnverifiedUser});

    // User 2 tries to deactivate account before POST_CREATION_TIMEOUT ended
    await truffleAssert.reverts(instance.deactivateAccount(user2, { from: user2 }),
    "Last post timeout has not yet ended in order to deactivate your account!");

    // More than 2 minutes passed
    await time.increase(time.duration.seconds(POST_CREATION_TIMEOUT));

    // User 2 posts again
    tx = await instance.uploadPost(cid, { from: user2 });
    truffleAssert.eventEmitted(tx, 'PostCreated', (ev) => {
      return ev._id.toString() === '2' && ev._ipfsHash === cid && ev._author === user2;
    })

    // More than 2 minutes passed
    await time.increase(time.duration.seconds(POST_CREATION_TIMEOUT));

    // User 2 deactivates account
    tx = await instance.deactivateAccount(user2, { from: user2 });
    truffleAssert.eventEmitted(tx, 'AccountDeactivated', (ev) => {
      return ev._user === user2 && ev._beneficiary === user2 && ev._pricePaid == basePriceForVerifiedUser;
    })

    // User 3 tries to report User 2's post, but User 2 is inactive
    await truffleAssert.reverts(instance.report(1, { from: user3 }), "The user you are trying to report is not active!");

    // User 3 tries to tip User 2's post, but User 2 is inactive
    await truffleAssert.reverts(instance.tipPostOwner(1, { from: user3 }), "The user you are trying to tip is not active!");
  })

  it ("Inactive User 4 tips inactive User 2's post", async () => {
    await truffleAssert.reverts(instance.tipPostOwner(1, { from: user4 }), "The user you are trying to tip is not active!");
  })

  it ("User 3 tries to report an invalid post id", async () => {
    await truffleAssert.reverts(instance.report(100, { from: user3 }), "Invalid post id!");
  })

  it ("User 1 tries to report his post", async () => {
    await truffleAssert.reverts(instance.report(0, { from: user1 }), "Cannot report your own post!");
  })

  it ("User 3 reports User1's post", async () => {
    tx = await instance.report(0, { from: user3 });
    truffleAssert.eventEmitted(tx, 'Reported', (ev) => {
      return ev._postId.toString() === '0' && ev._by === user3;
    })

    expect(await instance.getReportUserReporting(0)).to.equal(user3);
    expect(await instance.getReportPostId(0)).to.be.a.bignumber.equal('0');
  })

  it("Inactive User 2 tries to vote", async () => {
    await truffleAssert.reverts(instance.vote(0, true, { from: user2 }), "Account not active!");
  })

  it("Users 2, 5-10 become active and unverified", async () => {
    await instance.activateAccount({ from: user2, value: basePriceForVerifiedUser});
    await instance.activateAccount({ from: user5, value: basePriceForUnverifiedUser});
    await instance.activateAccount({ from: user6, value: basePriceForUnverifiedUser});
    await instance.activateAccount({ from: user7, value: basePriceForUnverifiedUser});
    await instance.activateAccount({ from: user8, value: basePriceForUnverifiedUser});
    await instance.activateAccount({ from: user9, value: basePriceForUnverifiedUser});
    await instance.activateAccount({ from: user10, value: basePriceForUnverifiedUser});
  })
  
  it ("User 5 votes invalid report id", async () => {
    await truffleAssert.reverts(instance.vote(1, true, { from: user5 }), "Invalid report id!");
  })

  it ("User 1 (reported) tries to vote", async () => {
    await truffleAssert.reverts(instance.vote(0, true, { from: user1 }), "Cannot vote since you are reported!");
  })

  it ("User 3 (reporting) tries to vote", async () => {
    await truffleAssert.reverts(instance.vote(0, true, { from: user3 }), "Cannot vote since you are reporting!");
  })

  it ("User 1 (reported) tries to report other post", async () => {
    await truffleAssert.reverts(instance.report(1, { from: user1 }),
    "You are already involved in a current report session!");
  })

  it ("User 3 (reporting) tries to report other post", async () => {
    await truffleAssert.reverts(instance.report(1, { from: user3 }),
    "You are already involved in a current report session!");
  })

  it ("User 2 tries to report User 1's post, while User 1 is already in a current report session", async () => {
    await truffleAssert.reverts(instance.report(0, { from: user2 }),
    "The user you are intending to report is already involved in a current report session!");
  })  

  it ("Users 2,5,6,7 (4) vote up and Users 8,9 vote down (2); User 2 tries to vote again", async () => {
    tx = await instance.vote(0, true, { from: user2 });
    truffleAssert.eventEmitted(tx, 'Voted', (ev) => {
      return ev._reportId.toString() === '0' && ev._user === user2 && ev._upVote === true;
    })
    await instance.vote(0, true,  { from: user5 });
    await instance.vote(0, true,  { from: user6 });
    await instance.vote(0, true,  { from: user7 });
    await instance.vote(0, false, { from: user8 });
    await instance.vote(0, false, { from: user9 });

    // User 2 tries to vote again
    await truffleAssert.reverts(instance.vote(0, false, { from: user2 }), "You already voted!");

    expect(await instance.getReportUpVotes(0)).to.be.bignumber.equal(new BN(4));
    expect(await instance.getReportDownVotes(0)).to.be.bignumber.equal(new BN(2));
  })

  it("User 10 votes after voting time expires", async () => {
    // More than 2 minutes passed
    await time.increase(time.duration.seconds(REPORT_VOTING_TIME));

    await truffleAssert.reverts(instance.vote(0, false, { from: user10 }), "Voting session ended!");
  });

  it("Inactive User 4 tries to get the winner", async () => {
    await truffleAssert.reverts(instance.getReportWinner(0, { from: user4 }), "Account not active!");
  })

  it("User 1 tries to deactivate account while involved in a current report", async () => {
    await truffleAssert.reverts(instance.deactivateAccount(user1, { from: user1 }), "You are currently involved in a report session!");
  })

  it("User 3 tries to deactivate account while involved in a current report", async () => {
    await truffleAssert.reverts(instance.deactivateAccount(user3, { from: user3 }), "You are currently involved in a report session!");
  })

  it("User 9 tries to get the winner of an invalid report id", async () => {
    await truffleAssert.reverts(instance.getReportWinner(1, { from: user9 }), "Invalid report id!");
  })

  it("User 5 gets report winner", async () => {
    expect(await instance.getUserPenaltyCount(user1)).to.be.bignumber.equal(new BN(0));
    expect(await instance.getUserPricePaid(user1)).to.be.bignumber.equal(new BN(basePriceForUnverifiedUser));
    expect(await instance.getPostIsDisabled(0)).to.equal(false);
    let oldBalance = await web3.eth.getBalance(user3);

    tx = await instance.getReportWinner(0, { from: user5 });
    truffleAssert.eventEmitted(tx, 'ReportWinner', (ev) => {
      return ev._reportId.toString() === '0' && ev._winner === user3 &&
      ev._amountWon == basePriceForUnverifiedUser && ev._upVoteCount.toString() === '4' && ev._downVoteCount.toString() === '2';
    })

    expect(await instance.getUserPenaltyCount(user1)).to.be.bignumber.equal(new BN(1));
    expect(await instance.getUserPricePaid(user1)).to.be.bignumber.equal(new BN(0));
    expect(await instance.getPostIsDisabled(0)).to.equal(true);
    let newBalance = await web3.eth.getBalance(user3);
    expect(newBalance).to.equal(web3.utils.toBN(basePriceForUnverifiedUser).add(web3.utils.toBN(oldBalance)).toString());

    // User 5 tries to get report winner again
    await truffleAssert.reverts(instance.getReportWinner(0, { from: user5 }), "Report already finished!");
  })

  it ("User 3 tries to report User 1's post again", async () => {
    await instance.activateAccount({ from: user1, value: basePriceForUnverifiedUser * 2});
    await truffleAssert.reverts(instance.report(0, { from: user3 }), "You can't report a disabled post!");
    await truffleAssert.reverts(instance.tipPostOwner(0, { from: user3 }), "You can't tip a disabled post!");
  })

  it ("Complex test", async () => {
    // User 8 gets verified
    await instance.getVerified({ from: user8 });

    // User 8 tries to verify himself again
    await truffleAssert.reverts(instance.getVerified({ from: user8 }),"Your address was already verified!");

    // User 8 posts
    await instance.uploadPost(cid, { from: user8 });

    // User 8 tries to post immediately after
    await truffleAssert.reverts(instance.uploadPost(cid, { from: user8 }),
    "Last post timeout has not yet ended in order to upload a new post!");
    
    // More than POST_CREATION_TIMEOUT seconds passed
    await time.increase(time.duration.seconds(POST_CREATION_TIMEOUT));

    // User 8 posts
    await instance.uploadPost(cid, { from: user8 });

    // User 8 tries to deactive account before POST_CREATION_TIMEOUT ended
    await truffleAssert.reverts(instance.deactivateAccount(user8, { from: user8 }),
    "Last post timeout has not yet ended in order to deactivate your account!");

    // More than POST_CREATION_TIMEOUT seconds passed
    await time.increase(time.duration.seconds(POST_CREATION_TIMEOUT));

    // User 1 reports User 2
    await instance.report(1, { from: user1 });

    // User 7 reports User 8's post with id 3
    await instance.report(3, { from: user7 });

    // User 8 tries to deactive his account
    await truffleAssert.reverts(instance.deactivateAccount(user8, { from: user8 }), "You are currently involved in a report session!");

    // User 7 tries to deactivate his account
    await truffleAssert.reverts(instance.deactivateAccount(user7, { from: user7 }), "You are currently involved in a report session!");

    // User 7 posts
    await instance.uploadPost(cid, { from: user7 });

    // User 9 tries to report User 7
    await truffleAssert.reverts(instance.report(5, { from: user9 }),
    "The user you are intending to report is already involved in a current report session!");

    // Time passes (5 minutes)
    await time.increase(time.duration.seconds(REPORT_VOTING_TIME + REPORT_CHECK_WINNER_TIME));

    // User 9 tries to get winner
    await truffleAssert.reverts(instance.getReportWinner(2, { from: user9 }), "Winner reveal time ended!");

    // User 9 reports User 7's post with id 5
    await instance.report(5, { from: user9 });

    // User 9 tries to deactive his account
    await truffleAssert.reverts(instance.deactivateAccount(user9, { from: user9 }), "You are currently involved in a report session!");

    // User 7 tries to deactivate his account
    await truffleAssert.reverts(instance.deactivateAccount(user7, { from: user7 }), "You are currently involved in a report session!");

    // User 9 gets verified
    await instance.getVerified({ from: user9 });

    // Users 1,2,3 vote up and Users 5,6,8,10 vote down
    await instance.vote(3, true,  { from: user1 });
    await instance.vote(3, true,  { from: user2 });
    await instance.vote(3, true,  { from: user3 });
    await instance.vote(3, false, { from: user5 });
    await instance.vote(3, false, { from: user6 });
    await instance.vote(3, false, { from: user8 });
    await instance.vote(3, false, { from: user10 });

    // User 7 tries to call getVoteWinner before voting session ended
    await truffleAssert.reverts(instance.getReportWinner(3, { from: user7 }), "Voting session has not ended yet!");

    // User 9 tries to deactive his account
    await truffleAssert.reverts(instance.deactivateAccount(user9, { from: user9 }), "You are currently involved in a report session!");

    // User 7 tries to deactivate his account
    await truffleAssert.reverts(instance.deactivateAccount(user7, { from: user7 }), "You are currently involved in a report session!");

    // More than REPORT_VOTING_TIME seconds passed
    await time.increase(time.duration.seconds(REPORT_VOTING_TIME));

    // User 7 calls getVoteWinner and wins
    await instance.getReportWinner(3, { from: user7 });

    // User 9 needs to pay 2 * basePriceForVerifiedUser
    await instance.activateAccount({ from: user9, value: basePriceForVerifiedUser * 2});

    // User 9 deactives his account
    instance.deactivateAccount(user9, { from: user9 });

    // User 7 deactivates his account
    instance.deactivateAccount(user7, { from: user7 });
  })
});