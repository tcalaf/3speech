import { Link, HashRouter, Routes, Route } from "react-router-dom";
import React, { useState, useEffect } from "react";
import FreeSpeech from "./contracts/FreeSpeech.json";
import { Spinner, Navbar, Nav, Button, Container } from "react-bootstrap";
import logo from "./logo.png";
import "./App.css";
import Home from "./Home";
import Report from "./Report";
import Web3 from "web3";
import { getMetamaskRPCError, filter } from "./utils";

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [activationPrice, setActivationPrice] = useState(0);
  const [timeout, setTimeout] = useState(null);
  const [involvedInCurrentReport, setInvolvedInCurrentReport] = useState(false);
  const [web3, setWeb3] = useState(null);

  const AccountVerifiedListener = () => {
    return contract.events
      .AccountVerified({
        filter: { _user: account },
      })
      .on("data", function (event) {
        console.log(event);
        updateIsVerified();
        updateActivationPrice();
      });
  };

  const initComponent = async () => {
    await updateInvolvedInCurrentReport();
    await updateLastPostTimeout();
    await updateIsVerified();
    await updateIsActive();
    await updateActivationPrice();
    setLoading(false);
  };

  useEffect(() => {
    if (contract) {
      const accountVerifiedUnsub = AccountVerifiedListener();
      initComponent();

      return () => {
        accountVerifiedUnsub.unsubscribe();
      };
    }
  }, [contract]);

  const loadBlockchainData = async () => {
    if (typeof window.ethereum !== "undefined") {
      const web3 = new Web3(window.ethereum);
      setWeb3(web3);

      const accounts = await web3.eth.getAccounts();

      if (accounts.length > 0) {
        setAccount(accounts[0]);
      }

      const networkId = await web3.eth.net.getId();

      const freeSpeech = new web3.eth.Contract(
        FreeSpeech.abi,
        FreeSpeech.networks[networkId].address
      );
      setContract(freeSpeech);

      window.ethereum.on("accountsChanged", function (accounts) {
        setAccount(accounts[0]);
      });

      window.ethereum.on("chainChanged", (chainId) => {
        window.location.reload();
      });
    }
  }

  const web3Handler = async () => {
		if (web3) {
			const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
			setAccount(accounts[0])
		}
  };

	useEffect(() => {
		loadBlockchainData()
	}, [account])

  const activateAccount = async () => {
    const value = await contract.methods
      .getAccountActivationPrice(account)
      .call();
    contract.methods
      .activateAccount()
      .send({ from: account, value: value })
      .catch((err) => {
        alert(getMetamaskRPCError(err.message));
      });
  };

  const getVerified = async () => {
    contract.methods
      .getVerified()
      .send({ from: account })
      .catch((err) => {
        alert(getMetamaskRPCError(err.message));
      });
  };

  const deactivateAccount = async () => {
    let beneficiary = prompt("Please enter beneficiary address!", account);
    if (beneficiary != null) {
      contract.methods
        .deactivateAccount(beneficiary)
        .send({ from: account })
        .catch((err) => {
          alert(getMetamaskRPCError(err.message));
        });
    }
  };

  const updateIsVerified = async () => {
    const _isVerified = await contract.methods
      .getUserIsVerified(account)
      .call();
    setIsVerified(_isVerified);
  };

  const updateIsActive = async () => {
    const _isActive = await contract.methods.hasActiveAccount(account).call();
    setIsActive(_isActive);
  };

  const updateActivationPrice = async () => {
    const _activationPrice = await contract.methods
      .getAccountActivationPrice(account)
      .call();
    setActivationPrice(Web3.utils.fromWei(_activationPrice, "ether"));
  };

  const updateLastPostTimeout = async () => {
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

  const updateInvolvedInCurrentReport = async () => {
    setInvolvedInCurrentReport(false);
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
        postAuthor.toLowerCase() == account.toLowerCase() ||
        _reports[i].userReporting.toLowerCase() == account.toLowerCase()
      ) {
        setInvolvedInCurrentReport(true);
        return;
      }
    }
  };

  return (
    <HashRouter>
      <div className="App">
        <>
          <Navbar expand="lg" bg="secondary" variant="dark">
            <Container>
              <Navbar.Brand
                href="https://github.com/tcalaf/3speech"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img src={logo} width="40" height="40" className="" alt="" />
                &nbsp; 3Speech
              </Navbar.Brand>
              <Navbar.Toggle aria-controls="responsive-navbar-nav" />
              <Navbar.Collapse id="responsive-navbar-nav">
                <Nav className="me-auto">
                  <Nav.Link as={Link} to="/">
                    Home
                  </Nav.Link>
                  <Nav.Link as={Link} to="/reports">
                    Reports
                  </Nav.Link>
                </Nav>
                <Nav>
                  {account ? (
                    <>
                      <Nav.Link
                        href={`https://etherscan.io/address/${account}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline-light">
                          {account.slice(0, 5) + "..." + account.slice(38, 42)}
                        </Button>
                      </Nav.Link>
                      {isActive && timeout ? (
                        <Nav.Link disabled>
                          <Button variant="secondary" disabled>
                            Post timeout! Remaining {timeout} seconds
                          </Button>
                        </Nav.Link>
                      ) : isActive && involvedInCurrentReport ? (
                        <Nav.Link disabled>
                          <Button variant="secondary" disabled>
                            You are in a report!
                          </Button>
                        </Nav.Link>
                      ) : isActive ? (
                        <Nav.Link>
                          <Button
                            onClick={deactivateAccount}
                            variant="outline-light"
                          >
                            Deactivate Account: +{activationPrice} ether
                          </Button>
                        </Nav.Link>
                      ) : (
                        <Nav.Link>
                          <Button
                            onClick={activateAccount}
                            variant="outline-light"
                          >
                            Activate Account -{activationPrice} ether
                          </Button>
                        </Nav.Link>
                      )}
                      {isVerified ? (
                        <Nav.Link disabled>
                          <Button disabled variant="secondary">
                            Verified
                          </Button>
                        </Nav.Link>
                      ) : (
                        <Nav.Link>
                          <Button onClick={getVerified} variant="outline-light">
                            Get Verified
                          </Button>
                        </Nav.Link>
                      )}
                    </>
                  ) : (
                    <Button onClick={web3Handler} variant="outline-light">
                      Connect Wallet
                    </Button>
                  )}
                </Nav>
              </Navbar.Collapse>
            </Container>
          </Navbar>
        </>
        <div>
          {loading ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "80vh",
              }}
            >
              <Spinner animation="border" style={{ display: "flex" }} />
              <p className="mx-3 my-0">Awaiting Metamask Connection...</p>
            </div>
          ) : (
            <Routes>
              <Route
                path="/"
                element={
                  <Home
                    contract={contract}
                    account={account}
                    isActive={isActive}
                    parentUpdateLastPostTimeout={updateLastPostTimeout}
                    parentUpdateInvolvedInCurrentReport={
                      updateInvolvedInCurrentReport
                    }
                    parentUpdateActivationPrice={updateActivationPrice}
                    parentUpdateIsActive={updateIsActive}
                  />
                }
              />
              <Route
                path="/reports"
                element={
                  <Report
                    contract={contract}
                    account={account}
                    isActive={isActive}
                    parentUpdateLastPostTimeout={updateLastPostTimeout}
                    parentUpdateInvolvedInCurrentReport={
                      updateInvolvedInCurrentReport
                    }
                    parentUpdateActivationPrice={updateActivationPrice}
                    parentUpdateIsActive={updateIsActive}
                  />
                }
              />
            </Routes>
          )}
        </div>
      </div>
    </HashRouter>
  );
}

export default App;
