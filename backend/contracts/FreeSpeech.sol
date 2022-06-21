// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IProofOfHumanity {
  function isRegistered(address _user) external view returns (bool);
  function addRegistration(address _user) external;
}

contract FreeSpeech {

  // Contract reference
  IProofOfHumanity proofOfHumanity;

  // Events
  event AccountDeactivated(address indexed _user, address _beneficiary, uint _pricePaid);
  event AccountActivated(address indexed _user, uint _pricePaid);
  event AccountVerified(address indexed _user);
  event PostCreated(uint _id, string _ipfsHash, address payable _author, uint _timestamp);
  event PostTipped(uint _id, uint _tip, uint _tipAmount, address payable _author, address _by);
  event Voted(uint _reportId, address _user, bool _upVote);
  event Reported(uint _postId, address payable _by);
  event ReportWinner(uint _reportId, address payable _winner, address payable _loser, uint _amountWon, uint _upVoteCount, uint _downVoteCount);

  // Constants
  uint public constant basePriceForUnverifiedUser = 0.1 ether;
  uint public constant basePriceForVerifiedUser = 0.01 ether; 
  uint public constant penaltyFactor = 2;
  uint public constant POST_CREATION_TIMEOUT = 1 minutes;
  uint public constant REPORT_VOTING_TIME = 1 minutes;
  uint public constant REPORT_CHECK_WINNER_TIME = 1 minutes;

  // User logic
  struct User {
    bool isVerified;
    uint penaltyCount;
    uint pricePaid;
    uint[] postOwner;
  }
  mapping (address => User) public users;

  // Post logic
  struct Post {
    string ipfsHash;
    uint tipAmount;
    address payable author;
    bool isDisabled;
    uint timestamp;
  }
  Post[] public posts;

  // Report logic
  struct Report {
    address payable userReporting;
    uint postId;
    uint upVotes;
    uint downVotes;
    uint timestamp;
    bool isFinished;
  }
  Report[] public reports;
  // Mapping report index to a mapping that checks if address voted
  mapping(uint => mapping(address => bool)) public voted;

  constructor (address _proofOfHumanity) {
    proofOfHumanity = IProofOfHumanity(_proofOfHumanity);
  }

  /***************************************************************************/
  /*************************** GETTERS & SETTERS *****************************/
  /***************************************************************************/

  function getUserIsVerified(address _user) public view returns (bool) {
    return users[_user].isVerified;
  }

  function setUserIsVerified(address _user, bool _isVerified) private {
    users[_user].isVerified = _isVerified;
  }

  function getUserPenaltyCount(address _user) public view returns (uint) {
    return users[_user].penaltyCount;
  }

  function setUserPenaltyCount(address _user, uint _penaltyCount) private {
    users[_user].penaltyCount = _penaltyCount;
  }

  function getUserPricePaid(address _user) public view returns (uint) {
    return users[_user].pricePaid;
  }

  function setUserPricePaid(address _user, uint _pricePaid) private {
    users[_user].pricePaid = _pricePaid;
  }

  function getUserPostOwnerLength(address _user) public view returns (uint) {
    return users[_user].postOwner.length;
  }

  function getUserPostOwner(address _user) public view returns (uint[] memory) {
    return users[_user].postOwner;
  }

  function addPostOwner(address _user, uint _postId) private {
    users[_user].postOwner.push(_postId);
  }

  function getPostById (uint _id) public view returns (Post memory) {
    return posts[_id];
  }

  function getUserLastPostId(address _user) public view returns (uint) {
    return users[_user].postOwner[getUserPostOwnerLength(_user) - 1];
  }

  function getPostIPFSHash(uint _id) public view returns (string memory) {
    return posts[_id].ipfsHash;
  }

  function getPostTipAmount(uint _id) public view returns (uint) {
    return posts[_id].tipAmount;
  }

  function setPostTipAmount(uint _id, uint _tipAmount) private {
    posts[_id].tipAmount = _tipAmount;
  }

  function getPostAuthor(uint _id) public view returns (address payable) {
    return posts[_id].author;
  }

  function getPostIsDisabled(uint _id) public view returns (bool) {
    return posts[_id].isDisabled;
  }

  function setPostIsDisabled(uint _id, bool _isDisabled) private {
    posts[_id].isDisabled = _isDisabled;
  }

  function getPostTimestamp(uint _id) public view returns (uint) {
    return posts[_id].timestamp;
  }

  function getPostsLength () public view returns (uint) {
    return posts.length;
  }

  function getPosts () public view returns (Post[] memory) {
    Post[] memory _posts = new Post[](getPostsLength());
    for (uint i = 0; i < _posts.length; i++) {
        _posts[i] = getPostById(i);
    }

    return _posts;
  }

  function addPost (Post memory _post) private {
    posts.push(_post);
  }

  function addReport (Report memory _report) private {
    reports.push(_report);
  }

  function userAlreadyVoted (uint _id, address _user) public view returns (bool) {
    return voted[_id][_user];
  }

  function setUserVoted (uint _id, address _user) private {
    voted[_id][_user] = true;
  }

  function getReportById (uint _id) public view returns (Report memory) {
    return reports[_id];
  }

  function getReportUserReporting(uint _id) public view returns (address payable) {
    return reports[_id].userReporting;
  }

  function getReportUserReported(uint _id) public view returns (address payable) {
    return getPostAuthor(getReportPostId(_id));
  }

  function getReportPostId(uint _id) public view returns (uint) {
    return reports[_id].postId;
  }

  function getReportIsFinished(uint _id) public view returns (bool) {
    return reports[_id].isFinished;
  }

  function setReportIsFinished(uint _id, bool _isFinished) private {
    reports[_id].isFinished = _isFinished;
  }

  function getReportUpVotes(uint _id) public view returns (uint) {
    return reports[_id].upVotes;
  }

  function setReportUpVotes(uint _id, uint _upVotes) private {
    reports[_id].upVotes = _upVotes;
  }

  function getReportDownVotes(uint _id) public view returns (uint) {
    return reports[_id].downVotes;
  }

  function setReportDownVotes(uint _id, uint _downVotes) private {
    reports[_id].downVotes = _downVotes;
  }

  function getReportTimestamp(uint _id) public view returns (uint) {
    return reports[_id].timestamp;
  }

  function getReportsLength () public view returns (uint) {
    return reports.length;
  }

  function getCurrentReportsLength () public view returns (uint) {
    uint counter;

    for (uint i = 0; i < getReportsLength(); i++) {
      if (!checkReportWinnerTimeEnded(i) && !getReportIsFinished(i)) {
        counter++;
      }
    }

    return counter;
  }

  function getReports () public view returns (Report[] memory) {
    Report[] memory _reports = new Report[](getReportsLength());
    for (uint i = 0; i < _reports.length; i++) {
        _reports[i] = getReportById(i);
    }

    return _reports;
  }

  function getCurrentReports () public view returns (Report[] memory) {
    Report[] memory _reports = new Report[](getCurrentReportsLength());
    uint k;

    for (uint i = 0; i < getReportsLength(); i++) {
      if (!checkReportWinnerTimeEnded(i) && !getReportIsFinished(i)) {
        _reports[k] = getReportById(i);
        k++;
      }
    }

    return _reports;
  }

  function checkUserIsInvolvedInACurrentReport (address _user) public view returns (bool) {
    Report[] memory _reports = getCurrentReports();
    for (uint i = 0; i < _reports.length; i++) {
      if (getPostAuthor(_reports[i].postId) == _user || _reports[i].userReporting == _user) {
        return true;
      }
    }
    return false;
  }

  /*************************************************************************/
  /*************************** UTILS FUNCTIONS *****************************/
  /*************************************************************************/

  function getAccountActivationPrice (address _user) public view returns (uint) {
    uint _price;

    _price = getUserIsVerified(_user) == true ? basePriceForVerifiedUser : basePriceForUnverifiedUser;

    if (getUserPenaltyCount(_user) > 0) {
      _price *= getUserPenaltyCount(_user) * penaltyFactor;
    }

    return _price;
  }

  function hasActiveAccount (address _user) public view returns (bool) {
    return getUserPricePaid(_user) > 0 ? true : false;
  }

  function checkPostTimeoutEnded (uint _id) public view returns (bool) {
    return block.timestamp < getPostTimestamp(_id) + POST_CREATION_TIMEOUT ? false : true;
  }

  function getBlockTimestamp () public view returns (uint) {
    return block.timestamp;
  }

  function getPostTimeoutLeft (uint _id) public view returns (uint) {
    return getPostTimestamp(_id) + POST_CREATION_TIMEOUT -  block.timestamp;
  }

  function checkReportVotingTimeEnded (uint _id) public view returns (bool) {
    return block.timestamp < getReportTimestamp(_id) + REPORT_VOTING_TIME ? false : true;
  }

  function getReportVotingTimeLeft (uint _id) public view returns (uint) {
    return getReportTimestamp(_id) + REPORT_VOTING_TIME -  block.timestamp;
  }

  function checkReportWinnerTimeEnded (uint _id) public view returns (bool) {
    return block.timestamp < getReportTimestamp(_id) + REPORT_VOTING_TIME + REPORT_CHECK_WINNER_TIME ? false : true;
  }

  function getReportWinnerTimeLeft (uint _id) public view returns (uint) {
    return getReportTimestamp(_id) + REPORT_VOTING_TIME + REPORT_CHECK_WINNER_TIME -  block.timestamp;
  }

  function incrementUserPenaltyCount (address _user) private {
    setUserPenaltyCount(_user, getUserPenaltyCount(_user) + 1);
  }

  function incrementReportUpVotes (uint _id) private {
    setReportUpVotes(_id, getReportUpVotes(_id) + 1);
  }

  function incrementReportDownVotes (uint _id) private {
    setReportDownVotes(_id, getReportDownVotes(_id) + 1);
  }

  /*****************************************************************/
  /*************************** MODIFIERS ***************************/
  /*****************************************************************/

  modifier userHasActiveAccount (address _user) {
    require(hasActiveAccount(_user) == true, "Account not active!");
    _;
  }

  modifier userHasNotActiveAccount (address _user) {
    require(hasActiveAccount(_user) == false, "Account is already active!");
    _;
  }

  /**************************************************************************/
  /*************************** EXTERNAL FUNCTIONS ***************************/
  /**************************************************************************/

  function getVerified () external {
    require(getUserIsVerified(msg.sender) == false, "Your address was already verified!");
    require(proofOfHumanity.isRegistered(msg.sender) == true, "Your address is not verified by the Proof Of Humanity system!");
    setUserIsVerified(msg.sender, true);
    emit AccountVerified(msg.sender);
  }

  function activateAccount() external payable userHasNotActiveAccount(msg.sender) {
    require(msg.value == getAccountActivationPrice(msg.sender), "Please send a valid amount!");
    setUserPricePaid(msg.sender, msg.value);
    emit AccountActivated(msg.sender, msg.value);
  }

  function deactivateAccount(address payable _to) external userHasActiveAccount(msg.sender) {
    if (getUserPostOwnerLength(msg.sender) > 0) {
      require(checkPostTimeoutEnded(getUserLastPostId(msg.sender)) == true,
      "Last post timeout has not yet ended in order to deactivate your account!");
    }

    require(checkUserIsInvolvedInACurrentReport(msg.sender) == false, "You are currently involved in a report session!");

    uint _pricePaid = getUserPricePaid(msg.sender);
    setUserPricePaid(msg.sender, 0);
    
    emit AccountDeactivated(msg.sender, _to, _pricePaid);
    _to.transfer(_pricePaid);
  }

  function uploadPost(string memory _postIPFSHash) external userHasActiveAccount(msg.sender) {
    require(bytes(_postIPFSHash).length > 0, "Cannot pass an empty hash!");
    if (getUserPostOwnerLength(msg.sender) > 0) {
      require(checkPostTimeoutEnded(getUserLastPostId(msg.sender)) == true,
      "Last post timeout has not yet ended in order to upload a new post!");
    }

    uint postId = getPostsLength();

    addPost(Post(_postIPFSHash, 0, payable(msg.sender), false, block.timestamp));
    addPostOwner(msg.sender, postId);

    emit PostCreated(postId, _postIPFSHash, payable(msg.sender), block.timestamp);
  }

  function tipPostOwner(uint _postId) external payable {
    require(_postId >= 0 && _postId < getPostsLength(), "Invalid post id!");
    require(getPostIsDisabled(_postId) == false, "You can't tip a disabled post!");
    require(getPostAuthor(_postId) != msg.sender, "Cannot tip your own post!");
    require(hasActiveAccount(getPostAuthor(_postId)) == true, "The user you are trying to tip is not active!");

    setPostTipAmount(_postId, getPostTipAmount(_postId) + msg.value);

    emit PostTipped(_postId, msg.value, getPostTipAmount(_postId), getPostAuthor(_postId), msg.sender);
    getPostAuthor(_postId).transfer(msg.value);
  }

  function report(uint _postId) external userHasActiveAccount(msg.sender) {
    require(_postId >= 0 && _postId < getPostsLength(), "Invalid post id!");
    require(getPostIsDisabled(_postId) == false, "You can't report a disabled post!");
    require(hasActiveAccount(getPostAuthor(_postId)) == true, "The user you are trying to report is not active!");
    require(getPostAuthor(_postId) != msg.sender, "Cannot report your own post!");
    require(checkUserIsInvolvedInACurrentReport(getPostAuthor(_postId)) == false,
    "The user you are intending to report is already involved in a current report session!");
    require(checkUserIsInvolvedInACurrentReport(msg.sender) == false,
    "You are already involved in a current report session!");

    addReport(Report(payable(msg.sender), _postId, 0, 0, block.timestamp, false));

    emit Reported(_postId, payable(msg.sender));
  }

  function vote(uint _reportId, bool _up) external userHasActiveAccount(msg.sender) {
    require(_reportId >= 0 && _reportId < getReportsLength(), "Invalid report id!");
    require(checkReportVotingTimeEnded(_reportId) == false, "Voting session ended!");
    require(getReportUserReported(_reportId) != msg.sender, "Cannot vote since you are reported!");
    require(getReportUserReporting(_reportId) != msg.sender, "Cannot vote since you are reporting!");
    require(userAlreadyVoted(_reportId, msg.sender) == false, "You already voted!");

    setUserVoted(_reportId, msg.sender);
    if (_up == true) {
      incrementReportUpVotes(_reportId);
    } else {
      incrementReportDownVotes(_reportId);
    }

    emit Voted(_reportId, msg.sender, _up);
  }

  function getReportWinner (uint _reportId) external userHasActiveAccount(msg.sender) {
    require(_reportId >= 0 && _reportId < getReportsLength(), "Invalid report id!");
    require(getReportIsFinished(_reportId) == false, "Report already finished!");
    require(checkReportVotingTimeEnded(_reportId) == true, "Voting session has not ended yet!");
    require(checkReportWinnerTimeEnded(_reportId) == false, "Winner reveal time ended!");

    address payable winner;
    address payable loser;

    if (getReportUpVotes(_reportId) > getReportDownVotes(_reportId)) {
      winner = getReportUserReporting(_reportId);
      loser = getReportUserReported(_reportId);
      setPostIsDisabled(getReportPostId(_reportId), true);
    } else {
      winner = getReportUserReported(_reportId);
      loser = getReportUserReporting(_reportId);
    } 

    incrementUserPenaltyCount(loser);

    uint _pricePaid = getUserPricePaid(loser);
    setUserPricePaid(loser, 0);
    setReportIsFinished(_reportId, true);

    emit ReportWinner(_reportId, winner, loser, _pricePaid, getReportUpVotes(_reportId), getReportDownVotes(_reportId));
    winner.transfer(_pricePaid);
  }

}