// Agent ID Badge — free mint site (static, no backend, no tracking).
// Connects only through an injected wallet provider (window.ethereum).
// Never asks for a seed phrase or private key.

const BADGE_ABI = [
  "function mint()",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function hasMinted(address holder) view returns (bool)",
  "function totalMinted() view returns (uint256)",
  "function cap() view returns (uint256)",
  "function agentID() view returns (address)",
  "function handleOfToken(uint256 tokenId) view returns (string)",
  "event BadgeMinted(address indexed holder, uint256 indexed tokenId, string handle)",
];

const AGENT_ID_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function handleOf(address owner) view returns (string)",
];

const LS_TOKEN_KEY = "agentIdBadge.tokenId";

const els = {
  btnConnect: document.getElementById("btn-connect"),
  btnSwitchChain: document.getElementById("btn-switch-chain"),
  btnMint: document.getElementById("btn-mint"),
  status: document.getElementById("status"),
  handleLine: document.getElementById("handle-line"),
  statMinted: document.getElementById("stat-minted"),
  statCap: document.getElementById("stat-cap"),
  statConnection: document.getElementById("stat-connection"),
  badgeSection: document.getElementById("badge-section"),
  badgeDisplay: document.getElementById("badge-display"),
  contractAddress: document.getElementById("contract-address"),
};

let provider = null; // ethers.BrowserProvider
let signer = null;
let account = null;
let badgeContract = null;
let agentIdContract = null;
let isHolder = false;
let alreadyMinted = false;
let chainOk = false;

function setStatus(message, kind) {
  els.status.textContent = message || "";
  els.status.className = kind || "";
}

function setError(message) {
  setStatus(message, "error");
}

function setSuccess(message) {
  setStatus(message, "success");
}

function setInfo(message) {
  setStatus(message, "info");
}

// Pick the injected provider. When several providers are injected,
// prefer the Binance Wallet one.
function getInjectedProvider() {
  const eth = window.ethereum;
  if (!eth) return null;
  if (Array.isArray(eth)) {
    return eth.find((p) => p && p.isBinance) || eth[0];
  }
  return eth;
}

function contractDeployed() {
  return (
    CONFIG.CONTRACT_ADDRESS &&
    CONFIG.CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000"
  );
}

function bscscanTxUrl(txHash) {
  return CONFIG.BSCSCAN_BASE.replace(/\/$/, "") + "/tx/" + txHash;
}

function bscscanAddressUrl(address) {
  return CONFIG.BSCSCAN_BASE.replace(/\/$/, "") + "/address/" + address;
}

async function refreshStats() {
  if (!badgeContract) return;
  try {
    const [minted, cap] = await Promise.all([
      badgeContract.totalMinted(),
      badgeContract.cap(),
    ]);
    els.statMinted.textContent = minted.toString();
    els.statCap.textContent = cap.toString();
  } catch (err) {
    console.error("Could not read mint stats:", err);
    els.statMinted.textContent = "—";
    els.statCap.textContent = "—";
  }
}

// Find the tokenId owned by `account`.
// The badge contract is not enumerable, so look for the BadgeMinted
// event in the chain logs first; fall back to the tokenId saved in
// localStorage right after a successful mint in this browser.
async function findOwnedTokenId() {
  if (!provider || !badgeContract) return null;

  try {
    const filter = badgeContract.filters.BadgeMinted(account);
    const logs = await badgeContract.queryFilter(filter, 0, "latest");
    if (logs.length > 0) {
      return logs[logs.length - 1].args.tokenId;
    }
  } catch (err) {
    console.error("Event log lookup failed, trying local storage:", err);
  }

  try {
    const saved = window.localStorage.getItem(LS_TOKEN_KEY);
    if (saved !== null) {
      const tokenId = BigInt(saved);
      const owner = await badgeContract.ownerOf(tokenId);
      if (owner.toLowerCase() === account.toLowerCase()) return tokenId;
    }
  } catch (err) {
    console.error("Local storage tokenId check failed:", err);
  }

  return null;
}

async function renderBadge(tokenId) {
  try {
    const uri = await badgeContract.tokenURI(tokenId);
    const jsonPrefix = "data:application/json;base64,";
    if (!uri.startsWith(jsonPrefix)) {
      throw new Error("Unexpected tokenURI format.");
    }
    const metadata = JSON.parse(atob(uri.slice(jsonPrefix.length)));
    const handle = await badgeContract.handleOfToken(tokenId);

    els.badgeDisplay.innerHTML = "";
    if (metadata.image) {
      const img = document.createElement("img");
      img.src = metadata.image;
      img.alt = "Agent ID Badge #" + tokenId.toString();
      els.badgeDisplay.appendChild(img);
    }
    const handleLine = document.createElement("p");
    handleLine.className = "handle-line";
    handleLine.textContent = handle ? handle + ".ai" : "Agent ID Badge";
    els.badgeDisplay.appendChild(handleLine);

    const tokenLine = document.createElement("p");
    tokenLine.className = "token-line";
    tokenLine.textContent = "Badge #" + tokenId.toString();
    els.badgeDisplay.appendChild(tokenLine);

    if (metadata.name) {
      const nameLine = document.createElement("p");
      nameLine.className = "small";
      nameLine.textContent = metadata.name;
      els.badgeDisplay.appendChild(nameLine);
    }

    els.badgeSection.hidden = false;
  } catch (err) {
    console.error("Could not render badge:", err);
    setError("Badge minted, but its image could not be loaded. Check the transaction on the block explorer.");
  }
}

async function updateMintState() {
  els.btnMint.disabled = true;

  if (!account) return;

  if (!contractDeployed()) {
    setInfo("The badge contract is not deployed yet — minting will open once it is live on " + CONFIG.CHAIN_NAME + ".");
    return;
  }

  // Chain check.
  const network = await provider.getNetwork();
  chainOk = Number(network.chainId) === CONFIG.CHAIN_ID;
  els.btnSwitchChain.hidden = chainOk;
  if (!chainOk) {
    setError(
      "Wrong network. You are on chain " + network.chainId.toString() +
      " — switch to " + CONFIG.CHAIN_NAME + " (chain " + CONFIG.CHAIN_ID + ") to mint."
    );
    return;
  }

  // Agent ID holder check.
  try {
    const balance = await agentIdContract.balanceOf(account);
    isHolder = balance > 0n;
  } catch (err) {
    console.error("Agent ID balance check failed:", err);
    setError("Could not check your Agent ID balance. Please try again.");
    return;
  }

  if (!isHolder) {
    els.handleLine.textContent =
      "This wallet does not hold an Agent ID. Agent ID is claimed for free in the Binance app: Wallet > Agent ID.";
    setInfo("You need an Agent ID to mint this badge.");
    return;
  }

  let handle = "";
  try {
    handle = await agentIdContract.handleOf(account);
  } catch (err) {
    console.error("handleOf failed:", err);
  }
  els.handleLine.textContent = handle
    ? "Connected as " + handle + ".ai"
    : "Connected — Agent ID holder";

  // Already minted?
  try {
    alreadyMinted = await badgeContract.hasMinted(account);
  } catch (err) {
    console.error("hasMinted check failed:", err);
    setError("Could not check whether you already minted. Please try again.");
    return;
  }

  if (alreadyMinted) {
    setInfo("You already minted your badge.");
    const tokenId = await findOwnedTokenId();
    if (tokenId !== null) {
      await renderBadge(tokenId);
    } else {
      els.badgeSection.hidden = false;
      els.badgeDisplay.innerHTML = "";
      const note = document.createElement("p");
      note.className = "small";
      note.textContent = "Your badge is minted, but its token ID could not be found in the event logs from this browser.";
      els.badgeDisplay.appendChild(note);
    }
    return;
  }

  els.btnMint.disabled = false;
  setInfo("You are eligible — one free badge for " + (handle ? handle + ".ai" : "your Agent ID") + ". You only pay network gas.");
}

async function connect() {
  const injected = getInjectedProvider();
  if (!injected) {
    setError("No wallet found. Install the Binance Wallet extension or open this page in the Binance app browser, then try again.");
    return;
  }

  try {
    provider = new ethers.BrowserProvider(injected);
    const accounts = await provider.send("eth_requestAccounts", []);
    if (!accounts || accounts.length === 0) {
      setError("No account was shared by your wallet.");
      return;
    }
    account = accounts[0];
    signer = await provider.getSigner();

    badgeContract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, BADGE_ABI, provider);
    agentIdContract = new ethers.Contract(CONFIG.AGENT_ID_ADDRESS, AGENT_ID_ABI, provider);

    els.statConnection.textContent = "Connected";
    els.btnConnect.textContent = "Connected: " + account.slice(0, 6) + "…" + account.slice(-4);
    els.btnConnect.disabled = true;

    setInfo("Connected. Checking your Agent ID…");
    await refreshStats();
    await updateMintState();
  } catch (err) {
    console.error("Connect failed:", err);
    if (err && err.code === 4001) {
      setError("Connection request was rejected in your wallet.");
    } else {
      setError("Could not connect to your wallet. Please try again.");
    }
  }
}

async function switchChain() {
  const injected = getInjectedProvider();
  if (!injected) {
    setError("No wallet found.");
    return;
  }
  const hexChainId = "0x" + CONFIG.CHAIN_ID.toString(16);
  try {
    await injected.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }],
    });
    setInfo("Network switched. Checking eligibility…");
    await updateMintState();
  } catch (err) {
    console.error("Chain switch failed:", err);
    if (err && err.code === 4902) {
      // Chain not added to the wallet yet — add it, then retry the switch.
      try {
        const chainParams =
          CONFIG.CHAIN_ID === 97
            ? {
                chainId: hexChainId,
                chainName: "BSC Testnet",
                nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
                rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545/"],
                blockExplorerUrls: ["https://testnet.bscscan.com"],
              }
            : {
                chainId: hexChainId,
                chainName: "BNB Smart Chain",
                nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
                rpcUrls: ["https://bsc-dataseed.bnbchain.org/"],
                blockExplorerUrls: ["https://bscscan.com"],
              };
        await injected.request({
          method: "wallet_addEthereumChain",
          params: [chainParams],
        });
        await updateMintState();
      } catch (addErr) {
        console.error("Adding chain failed:", addErr);
        setError("Could not add " + CONFIG.CHAIN_NAME + " to your wallet. Please add it manually and try again.");
      }
    } else if (err && err.code === 4001) {
      setError("Network switch was rejected in your wallet.");
    } else {
      setError("Could not switch network. Please switch to " + CONFIG.CHAIN_NAME + " in your wallet and try again.");
    }
  }
}

async function mint() {
  if (!signer || !badgeContract) {
    setError("Connect your wallet first.");
    return;
  }
  if (!isHolder) {
    setError("This wallet does not hold an Agent ID, so it cannot mint the badge.");
    return;
  }
  if (alreadyMinted) {
    setError("You already minted your badge.");
    return;
  }

  els.btnMint.disabled = true;
  setInfo("Waiting for you to confirm the transaction in your wallet…");

  try {
    const contractWithSigner = badgeContract.connect(signer);
    const tx = await contractWithSigner.mint();
    setInfo("Transaction sent. Waiting for confirmation…");

    const receipt = await tx.wait();
    if (receipt.status !== 1n && receipt.status !== 1) {
      throw new Error("Transaction failed on-chain.");
    }

    // Save the tokenId locally as a fallback for later visits.
    let tokenId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = badgeContract.interface.parseLog(log);
        if (parsed && parsed.name === "BadgeMinted") {
          tokenId = parsed.args.tokenId;
        }
      } catch (parseErr) {
        // Log is not from this contract — ignore.
      }
    }
    if (tokenId !== null) {
      try {
        window.localStorage.setItem(LS_TOKEN_KEY, tokenId.toString());
      } catch (storageErr) {
        console.error("Could not save tokenId locally:", storageErr);
      }
    }

    alreadyMinted = true;
    await refreshStats();

    const explorerLink = document.createElement("a");
    explorerLink.href = bscscanTxUrl(tx.hash);
    explorerLink.target = "_blank";
    explorerLink.rel = "noopener noreferrer";
    explorerLink.textContent = "View transaction on the block explorer";
    els.status.innerHTML = "";
    els.status.className = "success";
    els.status.appendChild(document.createTextNode("Badge minted! "));
    els.status.appendChild(explorerLink);

    if (tokenId !== null) {
      await renderBadge(tokenId);
    } else {
      const found = await findOwnedTokenId();
      if (found !== null) await renderBadge(found);
    }
  } catch (err) {
    console.error("Mint failed:", err);
    els.btnMint.disabled = false;
    if (err && err.code === 4001) {
      setError("Transaction was rejected in your wallet. Nothing was minted.");
    } else if (err && err.message && err.message.includes("already minted")) {
      setError("This wallet already minted its badge.");
    } else {
      setError("Mint failed: " + (err && err.shortMessage ? err.shortMessage : err && err.message ? err.message : "unknown error"));
    }
  }
}

function onAccountsChanged(accounts) {
  if (!accounts || accounts.length === 0) {
    account = null;
    signer = null;
    els.statConnection.textContent = "Not connected";
    els.btnConnect.disabled = false;
    els.btnConnect.textContent = "Connect Wallet";
    els.btnMint.disabled = true;
    els.handleLine.textContent = "Connect your wallet to check your Agent ID.";
    setInfo("Wallet disconnected.");
    return;
  }
  account = accounts[0];
  updateMintState().catch((err) => {
    console.error("Account change refresh failed:", err);
    setError("Could not refresh after the account change. Please reload the page.");
  });
}

function onChainChanged() {
  updateMintState().catch((err) => {
    console.error("Chain change refresh failed:", err);
    setError("Could not refresh after the network change. Please reload the page.");
  });
}

function init() {
  els.btnSwitchChain.textContent = "Switch to " + CONFIG.CHAIN_NAME;
  els.contractAddress.textContent = contractDeployed()
    ? CONFIG.CONTRACT_ADDRESS
    : CONFIG.CONTRACT_ADDRESS + " (not deployed yet)";

  const contractLink = document.createElement("a");
  if (contractDeployed()) {
    contractLink.href = bscscanAddressUrl(CONFIG.CONTRACT_ADDRESS);
    contractLink.target = "_blank";
    contractLink.rel = "noopener noreferrer";
    contractLink.textContent = CONFIG.CONTRACT_ADDRESS;
    els.contractAddress.textContent = "";
    els.contractAddress.appendChild(contractLink);
  }

  els.btnConnect.addEventListener("click", connect);
  els.btnSwitchChain.addEventListener("click", switchChain);
  els.btnMint.addEventListener("click", mint);

  const injected = getInjectedProvider();
  if (injected && injected.on) {
    injected.on("accountsChanged", onAccountsChanged);
    injected.on("chainChanged", onChainChanged);
  }

  if (!contractDeployed()) {
    setInfo("The badge contract is not deployed yet — minting will open once it is live on " + CONFIG.CHAIN_NAME + ".");
  }

  // Read-only stats are only possible once a contract exists.
  if (contractDeployed() && window.ethers) {
    const readProvider = new ethers.JsonRpcProvider(
      CONFIG.CHAIN_ID === 97
        ? "https://data-seed-prebsc-1-s1.binance.org:8545/"
        : "https://bsc-dataseed.bnbchain.org/"
    );
    badgeContract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, BADGE_ABI, readProvider);
    refreshStats();
  }
}

init();
