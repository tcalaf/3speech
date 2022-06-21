import React, { useState, useEffect } from "react";
import { Row, Form, Button, Card } from "react-bootstrap";
import { create as ipfsHttpClient } from "ipfs-http-client";
import {
  getMetamaskRPCError,
  converUnixTimestampToDate,
  filter,
} from "./utils";
import Web3 from "web3";

const client = ipfsHttpClient("https://ipfs.infura.io:5001/api/v0");

export default function Home({
  contract,
  account,
  isActive,
  parentUpdateLastPostTimeout,
  parentUpdateInvolvedInCurrentReport,
  parentUpdateActivationPrice,
  parentUpdateIsActive,
}) {
  const [posts, setPosts] = useState([]);
  const [post, setPost] = useState("");
  const [involvedInCurrentReport, setInvolvedInCurrentReport] = useState(false);
  const [timeout, setTimeout] = useState(null);
  const [loading, setLoading] = useState(true);

  const ReportedListener = () => {
    return contract.events.Reported().on("data", function (event) {
      console.log(event);
      updatePosts();
      updateInvolvedInCurrentReport(account);
      parentUpdateInvolvedInCurrentReport();
    });
  };

  const AccountActivatedListener = () => {
    return contract.events
      .AccountActivated({
        filter: { _user: account },
      })
      .on("data", function (event) {
        console.log(event);
        parentUpdateIsActive();
        updatePosts();
      });
  };

  const AccountDeactivatedListener = () => {
    return contract.events
      .AccountDeactivated({
        filter: { _user: account },
      })
      .on("data", function (event) {
        console.log(event);
        parentUpdateIsActive();
        updatePosts();
      });
  };

  const PostTippedListener = () => {
    return contract.events.PostTipped().on("data", function (event) {
      console.log(event);
      updatePosts();
    });
  };

  const PostCreatedListener = () => {
    return contract.events.PostCreated().on("data", function (event) {
      console.log(event);
      updatePosts();
      getLastPostTimeout();
      parentUpdateLastPostTimeout();
    });
  };

  const uploadPost = async () => {
    if (!post) return;
    let hash;
    try {
      const result = await client.add(JSON.stringify({ post }));
      hash = result.path;
    } catch (error) {
      window.alert("ipfs image upload error: ", error);
    }
    contract.methods
      .uploadPost(hash)
      .send({ from: account })
      .catch((err) => {
        alert(getMetamaskRPCError(err.message));
      });
  };

  const tipPostOwner = async (postId) => {
    let amount = prompt("How much ETH?", 0.01);
    if (amount) {
      contract.methods
        .tipPostOwner(postId)
        .send({ from: account, value: Web3.utils.toWei(amount, "ether") })
        .catch((err) => {
          alert(getMetamaskRPCError(err.message));
        });
    }
  };

  const updatePosts = async () => {
    setLoading(true);
    const _posts = await contract.methods.getPosts().call();

    let posts = await Promise.all(
      _posts.map(async (i, id) => {
        let response = await fetch(`https://ipfs.infura.io/ipfs/${i.ipfsHash}`);
        const metadataPost = await response.json();

        const authorIsInvolvedInACurrentReport =
          await checkUserInvolvedInCurrentReport(i.author);

        let post = {
          id: id,
          content: metadataPost.post,
          tipAmount: i.tipAmount,
          author: i.author,
          isDisabled: i.isDisabled,
          timestamp: i.timestamp,
          authorIsInvolvedInACurrentReport: authorIsInvolvedInACurrentReport,
        };
        return post;
      })
    );
    posts = await filter(posts, async (el) => {
      const isAuthorActive = await contract.methods
        .hasActiveAccount(el.author)
        .call();
      return !el.isDisabled && isAuthorActive;
    });
    posts = posts.sort((a, b) => b.timestamp - a.timestamp);
    setPosts(posts);
    setLoading(false);
  };

  const report = async (postId) => {
    contract.methods
      .report(postId)
      .send({ from: account })
      .catch((err) => {
        alert(getMetamaskRPCError(err.message));
      });
  };

  const getReportWinnerTimeLeft = async (report_timestamp) => {
    const currentTime = Math.round(Date.now() / 1000);
    let reportVotingTime = await contract.methods.REPORT_VOTING_TIME().call();
    let reportCheckWinnerTime = await contract.methods
      .REPORT_CHECK_WINNER_TIME()
      .call();
    const winnerTimeLimit =
      Number(report_timestamp) +
      Number(reportVotingTime) +
      Number(reportCheckWinnerTime);
    if (winnerTimeLimit > currentTime) {
      return winnerTimeLimit - currentTime;
    }
    return -1;
  };

  const checkUserInvolvedInCurrentReport = async (address) => {
    let _reports = await contract.methods.getReports().call();
    _reports = await filter(_reports, async (el) => {
      const reportWinnerTimeLeft = await getReportWinnerTimeLeft(el.timestamp);
      return !el.isFinished && reportWinnerTimeLeft >= 0;
    });
    for (let i = 0; i < _reports.length; i++) {
      const postAuthor = await contract.methods
        .getPostAuthor(_reports[i].postId)
        .call();
      if (
        postAuthor.toLowerCase() == address.toLowerCase() ||
        _reports[i].userReporting.toLowerCase() == address.toLowerCase()
      ) {
        return true;
      }
    }
    return false;
  };

  const updateInvolvedInCurrentReport = async (address) => {
    const res = await checkUserInvolvedInCurrentReport(address);
    setInvolvedInCurrentReport(res);
  };

  const getLastPostTimeout = async () => {
    setTimeout(null);
    let postCount = await contract.methods
      .getUserPostOwnerLength(account)
      .call();
    let postCreationTimeout = await contract.methods
      .POST_CREATION_TIMEOUT()
      .call();
    if (postCount > 0) {
      let lastPostId = await contract.methods.getUserLastPostId(account).call();
      if (lastPostId) {
        let _lastPostTimestamp = await contract.methods
          .getPostTimestamp(lastPostId)
          .call();
        const currentTime = Math.round(Date.now() / 1000);
        if (
          Number(_lastPostTimestamp) + Number(postCreationTimeout) >
          currentTime
        ) {
          setTimeout(
            Number(_lastPostTimestamp) +
              Number(postCreationTimeout) -
              currentTime
          );
        }
      }
    }
  };

  const initComponent = async () => {
    await parentUpdateIsActive();
    await parentUpdateActivationPrice();
    await parentUpdateInvolvedInCurrentReport();
    await parentUpdateLastPostTimeout();
    await getLastPostTimeout();
    await updateInvolvedInCurrentReport(account);
    await updatePosts();
    setLoading(false);
  };

  useEffect(() => {
    if (contract) {
      const postCreatedUnsub = PostCreatedListener();
      const postTippedUnsub = PostTippedListener();
      const accountActivatedUnsub = AccountActivatedListener();
      const accountDeactivatedUnsub = AccountDeactivatedListener();
      const reportedUnsub = ReportedListener();
      initComponent();

      return () => {
        accountActivatedUnsub.unsubscribe();
        postTippedUnsub.unsubscribe();
        accountDeactivatedUnsub.unsubscribe();
        reportedUnsub.unsubscribe();
        postCreatedUnsub.unsubscribe();
      };
    }
  }, [contract]);

  if (loading)
    return (
      <div className="text-center">
        <main style={{ padding: "1rem 0" }}>
          <h2>Loading...</h2>
        </main>
      </div>
    );

  return (
    <div className="container-fluid mt-5">
      {isActive && timeout === null ? (
        <div className="row">
          <main
            role="main"
            className="col-lg-12 mx-auto"
            style={{ maxWidth: "1000px" }}
          >
            <div className="content mx-auto">
              <Row className="g-4">
                <Form.Control
                  onChange={(e) => setPost(e.target.value)}
                  size="lg"
                  required
                  as="textarea"
                />
                <div className="d-grid px-0">
                  <Button onClick={uploadPost} variant="primary" size="lg">
                    Post!
                  </Button>
                </div>
              </Row>
            </div>
          </main>
        </div>
      ) : isActive && timeout ? (
        <div className="text-center">
          <main style={{ padding: "1rem 0" }}>
            <h2>You need to wait {timeout} more seconds to post!</h2>
          </main>
        </div>
      ) : (
        <div className="text-center">
          <main style={{ padding: "1rem 0" }}>
            <h2>Please activate your account in order to post!</h2>
          </main>
        </div>
      )}

      <p>&nbsp;</p>
      <hr />
      <p className="my-auto">&nbsp;</p>
      {posts.length > 0 ? (
        posts.map((post, key) => {
          return (
            <div
              key={key}
              className="col-lg-12 my-3 mx-auto"
              style={{ width: "1000px" }}
            >
              <Card border="primary">
                <Card.Header>
                  <small className="ms-2 me-auto d-inline">
                    {converUnixTimestampToDate(post.timestamp)}
                  </small>
                  <small className="mt-1 float-end d-inline">
                    {post.author}
                  </small>
                </Card.Header>
                <Card.Body color="secondary">
                  <Card.Title>{post.content}</Card.Title>
                </Card.Body>
                <Card.Footer className="list-group-item">
                  <div className="d-inline mt-auto float-start">
                    Tip Amount: {Web3.utils.fromWei(post.tipAmount, "ether")}{" "}
                    ETH
                  </div>
                  {account.toLowerCase() === post.author.toLowerCase() ? null : (
                    <div className="d-inline float-end">
                      <Button
                        onClick={() => tipPostOwner(post.id)}
                        className="px-10 mx-2 py-0 font-size-20"
                        variant="info"
                      >
                        Tip
                      </Button>
                      {isActive ? (
                        <Button
                          onClick={() => report(post.id)}
                          className="px-10 mx-2 py-0 font-size-20"
                          variant="danger"
                          disabled={
                            involvedInCurrentReport ||
                            post.authorIsInvolvedInACurrentReport
                          }
                        >
                          Report
                        </Button>
                      ) : null}
                    </div>
                  )}
                </Card.Footer>
              </Card>
            </div>
          );
        })
      ) : (
        <div className="text-center">
          <main style={{ padding: "1rem 0" }}>
            <h2>No posts yet</h2>
          </main>
        </div>
      )}
    </div>
  );
}
