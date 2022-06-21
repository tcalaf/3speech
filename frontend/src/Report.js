import React, { useState, useEffect } from "react";
import { Button, Card } from "react-bootstrap";
import {
  getMetamaskRPCError,
  converUnixTimestampToDate,
  filter,
} from "./utils";

export default function Report({
  contract,
  account,
  isActive,
  parentUpdateLastPostTimeout,
  parentUpdateInvolvedInCurrentReport,
  parentUpdateActivationPrice,
  parentUpdateIsActive
}) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const AccountActivatedListener = () => {
    return contract.events
      .AccountActivated({
        filter: { _user: account },
      })
      .on("data", function (event) {
        console.log(event);
        parentUpdateIsActive();
        updateReports();
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
        updateReports();
      });
  };
  const ReportWinnerListener = () => {
    return contract.events.ReportWinner().on("data", function (event) {
      parentUpdateActivationPrice()
      updateReports();
      parentUpdateIsActive()
    });
  };

  const VotedListener = () => {
    return contract.events.Voted().on("data", function (event) {
      updateReports();
    });
  };

  const vote = async (reportId, up) => {
    contract.methods
      .vote(reportId, up)
      .send({ from: account })
      .catch((err) => {
        alert(getMetamaskRPCError(err.message));
      });
  };

  const getReportWinner = async (reportId) => {
    contract.methods
      .getReportWinner(reportId)
      .send({ from: account })
      .catch((err) => {
        alert(getMetamaskRPCError(err.message));
      });
  };

  const getReportVotingTimeLeft = async (report_timestamp) => {
    const currentTime = Math.round(Date.now() / 1000);
    let reportVotingTime = await contract.methods.REPORT_VOTING_TIME().call();
    const voteTimeLimit = Number(report_timestamp) + Number(reportVotingTime);
    if (voteTimeLimit > currentTime) {
      return voteTimeLimit - currentTime;
    }
    return -1;
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

  const updateReports = async () => {
    setLoading(true);
    const _reports = await contract.methods.getReports().call();

    let reports = await Promise.all(
      _reports.map(async (i, id) => {
        const postId = await contract.methods.getReportPostId(id).call();

        const alreadyVoted = await contract.methods
          .userAlreadyVoted(id, account)
          .call();

        const post = await contract.methods.getPostById(postId).call();

        let response = await fetch(
          `https://ipfs.infura.io/ipfs/${post.ipfsHash}`
        );
        const metadataPost = await response.json();

        const reportVotingTimeLeft = await getReportVotingTimeLeft(i.timestamp);
        const reportWinnerTimeLeft = await getReportWinnerTimeLeft(i.timestamp);

        let report = {
          id: id,
          userReporting: i.userReporting,
          postId: i.postId,
          post: post,
          upVotes: i.upVotes,
          downVotes: i.downVotes,
          timestamp: i.timestamp,
          isFinished: i.isFinished,
          alreadyVoted: alreadyVoted,
          content: metadataPost.post,
          reportVotingTimeLeft: reportVotingTimeLeft,
          reportWinnerTimeLeft: reportWinnerTimeLeft,
        };
        return report;
      })
    );
    reports = await filter(reports, async (el) => {
      return !el.isFinished && el.reportWinnerTimeLeft >= 0;
    });
    reports = reports.sort((a, b) => b.timestamp - a.timestamp);
    setReports(reports);
    setLoading(false);
  };

  const initComponent = async () => {
    await parentUpdateActivationPrice();
    await parentUpdateIsActive();
    await parentUpdateInvolvedInCurrentReport();
    await parentUpdateLastPostTimeout();
    await updateReports();
  };

  useEffect(() => {
    if (contract) {
      initComponent();
      const accountActivatedUnsub = AccountActivatedListener();
      const accountDeactivatedUnsub = AccountDeactivatedListener();
      const reportWinnerUnsub = ReportWinnerListener();
      const votedUnsub = VotedListener();

      return () => {
        accountActivatedUnsub.unsubscribe();
        reportWinnerUnsub.unsubscribe();
        accountDeactivatedUnsub.unsubscribe();
        votedUnsub.unsubscribe();
      }
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
      {reports.length > 0 ? (
        reports.map((report, key) => {
          return (
            <div
              key={key}
              className="col-lg-12 my-3 mx-auto"
              style={{ width: "1000px" }}
            >
              <Card border="primary">
                <Card.Header>
                  <div className="d-flex justify-content-between">
                    <small>
                      Reporting:{" "}
                      {report.userReporting.slice(0, 9) +
                        "..." +
                        report.userReporting.slice(35, 42)}
                    </small>
                    <small>
                      Post Date:{" "}
                      {converUnixTimestampToDate(report.post.timestamp)}
                    </small>
                    <small>
                      Reported:{" "}
                      {report.post.author.slice(0, 9) +
                        "..." +
                        report.post.author.slice(35, 42)}
                    </small>
                  </div>
                </Card.Header>
                <Card.Body color="secondary">
                  <Card.Title>{report.content}</Card.Title>
                </Card.Body>
                {report.reportVotingTimeLeft > 0 ? (
                  <Card.Footer>
                    {report.alreadyVoted ? (
                      <div>
                        <div className="d-inline mt-auto float-start">
                          You already voted!{" "}
                        </div>
                        <div className="d-flex flex-column align-items-center">
                            <small className="my-auto mx-5 mb-1">
                              Time left to vote: {report.reportVotingTimeLeft}{" "}
                              seconds
                            </small>
                            <small className="my-auto mx-5 mt-1 ">
                              Vote count:{" "}
                              {Number(report.upVotes) +
                                Number(report.downVotes)}
                            </small>
                          </div>
                      </div>
                    ) : report.userReporting.toLowerCase() ==
                      account.toLowerCase() ? (
                      <div>
                        <div className="d-inline mt-auto float-start">
                          You can not vote. You reported!{" "}
                        </div>
                        <div className="d-flex flex-column align-items-center">
                            <small className="my-auto mx-5 mb-1">
                              Time left to vote: {report.reportVotingTimeLeft}{" "}
                              seconds
                            </small>
                            <small className="my-auto mx-5 mt-1 ">
                              Vote count:{" "}
                              {Number(report.upVotes) +
                                Number(report.downVotes)}
                            </small>
                          </div>
                      </div>
                    ) : report.post.author.toLowerCase() ==
                      account.toLowerCase() ? (
                      <div>
                        <div className="d-inline mt-auto float-start">
                          You can not vote. You are reported!{" "}
                        </div>
                        <div className="d-flex flex-column align-items-center">
                            <small className="my-auto mx-5 mb-1">
                              Time left to vote: {report.reportVotingTimeLeft}{" "}
                              seconds
                            </small>
                            <small className="my-auto mx-5 mt-1 ">
                              Vote count:{" "}
                              {Number(report.upVotes) +
                                Number(report.downVotes)}
                            </small>
                          </div>
                      </div>
                    ) : (
                      <>
                        <div className="d-flex justify-content-center">
                          {isActive && (
                            <button
                              type="button"
                              onClick={() => vote(report.id, true)}
                              className="btn btn-success mx-5 my-2 px-3"
                            >
                              Up
                            </button>
                          )}
                          <div className="d-flex flex-column align-items-center">
                            <small className="my-auto mx-5 mb-1">
                              Time left to vote: {report.reportVotingTimeLeft}{" "}
                              seconds
                            </small>
                            <small className="my-auto mx-5 mt-1 ">
                              Vote count:{" "}
                              {Number(report.upVotes) +
                                Number(report.downVotes)}
                            </small>
                          </div>
                          {isActive && (
                            <button
                              type="button"
                              onClick={() => vote(report.id, false)}
                              className="btn btn-danger mx-5 px-2 my-2"
                            >
                              Down
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </Card.Footer>
                ) : (
                  <Card.Footer>
                    <div className="d-flex justify-content-between">
                      <small className="my-auto">
                        Vote count:{" "}
                        {Number(report.upVotes) + Number(report.downVotes)}
                      </small>

                      <Button className="mx-auto" onClick={() => getReportWinner(report.id)} variant="warning">
                        Get winner
                      </Button>

                      <small className="my-auto ">
                        Time left to reveal: {report.reportWinnerTimeLeft}{" "}
                        seconds
                      </small>
                    </div>
                  </Card.Footer>
                )}
              </Card>
            </div>
          );
        })
      ) : (
        <div className="text-center">
          <main style={{ padding: "1rem 0" }}>
            <h2>No reports yet</h2>
          </main>
        </div>
      )}
    </div>
  );
}
