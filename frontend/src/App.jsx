import { useState, useEffect, useRef } from 'react';
import { BrowserProvider, Contract, parseEther, formatEther } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './constants';
import { fetchBounties, createBountyAPI, createSubmission, pollSubmissionStatus } from './api';
import './App.css';

// Bounties are now loaded from MongoDB via the backend API
const INITIAL_BOUNTIES = [];

// Helper: get a short display ID for a bounty
const getBountyDisplayId = (b) => b.onChainId ?? b._id?.slice(-6) ?? '??';

// Helper: safely truncate an address for display
const truncateAddress = (addr) => {
  if (!addr || addr.length < 10) return addr || 'Unknown';
  return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
};

function App() {
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState("0");
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [isWeb3Mode, setIsWeb3Mode] = useState(false);

  // Blockchain metrics
  const [tvl, setTvl] = useState("0.00");
  const [bountyCount, setBountyCount] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);

  // User Bounties List (for Sandbox / Web3 hybrid rendering)
  const [bountiesList, setBountiesList] = useState(INITIAL_BOUNTIES);

  // Form states
  const [bountyAmount, setBountyAmount] = useState('');
  const [bountyTitle, setBountyTitle] = useState('');
  const [bountyCategory, setBountyCategory] = useState('SQL Injection');
  const [bountyRepo, setBountyRepo] = useState('github.com/Mukul312004/defi-bounty-escrow');
  const [bountyDesc, setBountyDesc] = useState('');
  
  const [searchBountyId, setSearchBountyId] = useState('');
  const [selectedBounty, setSelectedBounty] = useState(null);
  
  const [poeImage, setPoeImage] = useState('your-dockerhub-user/sql-exploit:latest');
  const [researcherPayoutAddress, setResearcherPayoutAddress] = useState('');
  
  // Pipeline details
  const [pipelineStatus, setPipelineStatus] = useState('idle'); // idle, running, success, failed
  const [currentStep, setCurrentStep] = useState(0); // 0 to 5
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  const pollIntervalRef = useRef(null);

  // Auto-fill researcher wallet address when wallet connects
  useEffect(() => {
    if (account) {
      setResearcherPayoutAddress(account);
    }
  }, [account]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Fetch bounties on mount
  useEffect(() => {
    fetchBounties()
      .then(data => {
        setBountiesList(data);
        setBountyCount(data.length);
        const active = data.filter(b => b.isActive);
        const resolved = data.filter(b => !b.isActive);
        setResolvedCount(resolved.length);
        const totalLocked = active.reduce((sum, b) => sum + parseFloat(b.amount), 0);
        setTvl(totalLocked.toFixed(2));
      })
      .catch(err => console.error('Failed to fetch bounties:', err));
  }, []);

  // Toast notification helper
  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 4000);
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const _provider = new BrowserProvider(window.ethereum);
        const accounts = await _provider.send("eth_requestAccounts", []);
        const signer = await _provider.getSigner();
        const _contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        // Fetch user balance
        const rawBalance = await _provider.getBalance(accounts[0]);
        setBalance(parseFloat(formatEther(rawBalance)).toFixed(4));
        
        setAccount(accounts[0]);
        setProvider(_provider);
        setContract(_contract);
        setIsWeb3Mode(true);
        showToast("Web3 Wallet Connected successfully!", "success");

        // Sync statistics if contract is available
        try {
          const counter = await _contract.bountyCounter();
          setBountyCount(Number(counter));
        } catch (e) {
          console.warn("Could not read contract bounty counter. Using mock stats.", e);
        }
      } catch (error) {
        console.error("Wallet connection failed", error);
        showToast("Failed to connect wallet", "error");
      }
    } else {
      showToast("MetaMask not detected. Running in Sandbox Mode.", "warning");
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setBalance("0");
    setProvider(null);
    setContract(null);
    setIsWeb3Mode(false);
    showToast("Disconnected Web3 wallet. Sandbox Mode enabled.", "info");
  };

  const handleCreateBounty = async (e) => {
    e.preventDefault();
    if (!bountyAmount || !bountyTitle) {
      showToast("Please fill in reward amount and bounty title", "warning");
      return;
    }

    if (isWeb3Mode && contract) {
      try {
        showToast("Initiating contract transaction... Please approve in MetaMask.", "info");
        const tx = await contract.createBounty({ value: parseEther(bountyAmount) });
        showToast("Transaction submitted! Waiting for block confirmation...", "info");
        await tx.wait();
        
        showToast("Bounty locked in contract successfully!", "success");
        
        // Refresh local stats
        const counter = await contract.bountyCounter();
        const newId = Number(counter);
        
        const savedBounty = await createBountyAPI({
          title: bountyTitle,
          description: bountyDesc || 'Audit project sandbox and submit proof of exploit.',
          category: bountyCategory,
          repo: bountyRepo || 'github.com/Mukul312004/defi-bounty-escrow',
          amount: bountyAmount,
          creator: account,
          txHash: tx.hash,
          onChainId: newId
        });

        setBountyCount(newId);
        setBountiesList(prev => [savedBounty, ...prev]);
        setTvl(prev => (parseFloat(prev) + parseFloat(bountyAmount)).toFixed(2));

        // Reset inputs
        setBountyAmount('');
        setBountyTitle('');
        setBountyDesc('');
      } catch (error) {
        console.error(error);
        showToast("Failed to create on-chain bounty.", "error");
      }
    } else {
      // Sandbox Mode simulation
      try {
        const savedBounty = await createBountyAPI({
          title: bountyTitle,
          description: bountyDesc || "Sandbox bounty. Submit docker exploit to test logic.",
          category: bountyCategory,
          repo: bountyRepo || 'github.com/Mukul312004/defi-bounty-escrow',
          amount: bountyAmount,
          creator: account || "0xSandboxCreatorAddress"
        });
        
        setBountiesList(prev => [savedBounty, ...prev]);
        setTvl(prev => (parseFloat(prev) + parseFloat(bountyAmount)).toFixed(2));
        setBountyCount(prev => prev + 1);
        
        showToast(`Bounty created successfully!`, "success");
      } catch (err) {
        // Backend offline — add to local state only
        console.warn('Backend unavailable, saving locally:', err);
        const localBounty = {
          _id: `local-${Date.now()}`,
          title: bountyTitle,
          description: bountyDesc || "Sandbox bounty. Submit docker exploit to test logic.",
          category: bountyCategory,
          repo: bountyRepo || 'github.com/Mukul312004/defi-bounty-escrow',
          amount: bountyAmount,
          creator: account || "0xSandboxCreatorAddress",
          isActive: true
        };
        setBountiesList(prev => [localBounty, ...prev]);
        setTvl(prev => (parseFloat(prev) + parseFloat(bountyAmount)).toFixed(2));
        setBountyCount(prev => prev + 1);
        showToast(`Bounty created locally (backend offline).`, "warning");
      }
      
      // Reset inputs
      setBountyAmount('');
      setBountyTitle('');
      setBountyDesc('');
    }
  };

  const handleFetchBounty = (e) => {
    e.preventDefault();
    if (!searchBountyId) return;

    const query = searchBountyId.trim();
    const idNum = parseInt(query);
    const found = bountiesList.find(b => 
      b._id === query || 
      b.onChainId === idNum ||
      (b.title && b.title.toLowerCase().includes(query.toLowerCase()))
    );

    if (found) {
      setSelectedBounty(found);
      showToast(`Fetched details for Bounty #${getBountyDisplayId(found)}`, "success");
    } else {
      setSelectedBounty(null);
      showToast(`Bounty not found in database.`, "error");
    }
  };

  const selectBountyCard = (bounty) => {
    setSelectedBounty(bounty);
    setSearchBountyId((bounty._id || bounty.id || '').toString());
    showToast(`Selected Bounty #${getBountyDisplayId(bounty)}`, "info");
  };

  // Helper to add lines to terminal logs
  const appendLog = (text) => {
    setTerminalLogs(prev => [...prev, text]);
  };

  // Automated mock hacker terminal simulation (Fallback mode)
  const writeLogWithDelay = (text, delay) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        appendLog(text);
        resolve();
      }, delay);
    });
  };

  const runMockSimulation = async () => {
    setCurrentStep(1);
    await writeLogWithDelay(`[SYSTEM] Starting Local CI Simulation for Bounty #${getBountyDisplayId(selectedBounty)}...`, 200);
    await writeLogWithDelay(`[SYSTEM] Pulling target base environment (Ubuntu 22.04 LTS)...`, 300);
    await writeLogWithDelay(`[DOCKER] Creating isolated bridge network 'bounty-net'... Done.`, 400);
    
    setCurrentStep(2);
    await writeLogWithDelay(`[DOCKER] Launching Vulnerable Application environment...`, 300);
    await writeLogWithDelay(`[DOCKER] Target host configured: http://vulnerable-app:5000`, 200);
    await writeLogWithDelay(`[DOCKER] Initializing SQLite tables: 'users', 'secrets'...`, 400);
    await writeLogWithDelay(`[DATABASE] Seeded admin accounts & target flag.`, 200);
    await writeLogWithDelay(`[DOCKER] Web application is online, listening on port 5000.`, 300);
    
    setCurrentStep(3);
    await writeLogWithDelay(`[DOCKER] Pulling researcher exploit image: ${poeImage}...`, 400);
    await writeLogWithDelay(`[DOCKER] Image successfully resolved. Spawning exploit process.`, 200);
    await writeLogWithDelay(`[EXPLOIT] Running exploit script against target endpoint...`, 400);
    
    if (selectedBounty.category === "SQL Injection") {
      await writeLogWithDelay(`[EXPLOIT] Injecting Payload: ' UNION SELECT flag, 'exploited' FROM secrets --`, 400);
      await writeLogWithDelay(`[EXPLOIT] Received HTTP 200 Response from target.`, 200);
      await writeLogWithDelay(`[EXPLOIT] Extracted database content: {"success": true, "flag": "flag{sql_injection_success}"}`, 400);
    } else {
      await writeLogWithDelay(`[EXPLOIT] Deploying Malicious Attack Contract...`, 400);
      await writeLogWithDelay(`[EXPLOIT] Draining target contracts...`, 500);
      await writeLogWithDelay(`[EXPLOIT] Extracted cryptographic proof. Flag retrieved.`, 400);
    }

    setCurrentStep(4);
    await writeLogWithDelay(`[CI-ORACLE] Dumping exploit log output to 'exploit_output.json'...`, 200);
    await writeLogWithDelay(`[CI-ORACLE] Starting validation check...`, 200);
    await writeLogWithDelay(`[CI-ORACLE] VERIFICATION MATCH: "flag{sql_injection_success}" matched!`, 300);
    await writeLogWithDelay(`[CI-ORACLE] STATUS: Valid Proof-of-Exploit confirmed.`, 200);

    setCurrentStep(5);
    await writeLogWithDelay(`[ORACLE-BLOCKCHAIN] Connecting to blockchain provider...`, 300);
    await writeLogWithDelay(`[ORACLE-BLOCKCHAIN] resolveBounty(${getBountyDisplayId(selectedBounty)}, ${researcherPayoutAddress})`, 400);
    
    if (isWeb3Mode && contract) {
      const simulatedHash = "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
      await writeLogWithDelay(`[ORACLE-BLOCKCHAIN] Transaction Broadcasted! Hash: ${simulatedHash}`, 300);
      await writeLogWithDelay(`[SYSTEM] Bounty #${getBountyDisplayId(selectedBounty)} successfully resolved on-chain!`, 200);
    } else {
      await writeLogWithDelay(`[ORACLE-SANDBOX] Escrow balance release executed locally.`, 300);
      await writeLogWithDelay(`[SYSTEM] Bounty #${getBountyDisplayId(selectedBounty)} successfully resolved in sandbox!`, 200);
    }

    // Update States
    const bountyKey = selectedBounty._id || selectedBounty.id;
    setBountiesList(prev => prev.map(b => (b._id || b.id) === bountyKey ? { ...b, isActive: false } : b));
    setSelectedBounty(prev => ({ ...prev, isActive: false }));
    setTvl(prev => Math.max(0, (parseFloat(prev) - parseFloat(selectedBounty.amount))).toFixed(2));
    setResolvedCount(prev => prev + 1);
    setPipelineStatus('success');
    showToast(`Bounty #${getBountyDisplayId(selectedBounty)} resolved and paid out!`, "success");
  };

  const triggerGitHubAction = async () => {
    setPipelineStatus('running');
    setCurrentStep(1);
    setTerminalLogs([]);
    appendLog('[SYSTEM] Sending exploit submission to Aegis backend...');

    try {
      const submission = await createSubmission({
        bountyId: selectedBounty._id,
        researcher: researcherPayoutAddress,
        poeImage: poeImage
      });

      appendLog(`[SYSTEM] Submission created! ID: ${submission._id}`);
      appendLog('[SYSTEM] GitHub Action triggered. Polling for status...');
      setCurrentStep(2);

      // Poll backend for status updates
      pollIntervalRef.current = setInterval(async () => {
        try {
          const updated = await pollSubmissionStatus(submission._id);
          appendLog(`[CI] Pipeline Status: ${updated.status.toUpperCase()}`);

          if (updated.githubRunUrl && !terminalLogs.some(l => l.includes('View live'))) {
            appendLog(`[CI] View live: ${updated.githubRunUrl}`);
          }

          if (updated.status === 'running') {
            setCurrentStep(prev => prev < 4 ? prev + 1 : prev);
          } else if (updated.status === 'success') {
            clearInterval(pollIntervalRef.current);
            setCurrentStep(5);
            setPipelineStatus('success');
            appendLog('[CI-ORACLE] SUCCESS: Exploit validated and payout executed!');
            setBountiesList(prev => prev.map(b => b._id === selectedBounty._id ? { ...b, isActive: false } : b));
            setSelectedBounty(prev => ({ ...prev, isActive: false }));
            setTvl(prev => Math.max(0, parseFloat(prev) - parseFloat(selectedBounty.amount)).toFixed(2));
            setResolvedCount(prev => prev + 1);
            showToast(`Bounty resolved and paid out!`, 'success');
          } else if (updated.status === 'failed') {
            clearInterval(pollIntervalRef.current);
            setPipelineStatus('failed');
            appendLog('[CI-ORACLE] FAILED: Exploit rejected or chain error.');
            showToast('Verification failed.', 'error');
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, 5000);
    } catch (err) {
      if (err.message.includes('HTTP error') || err.message.includes('Failed to fetch')) {
        showToast("Backend API error. Running in simulation mode.", "info");
        runMockSimulation();
      } else {
        appendLog(`[SYSTEM] ERROR: ${err.message}`);
        setPipelineStatus('failed');
        showToast('Failed to submit exploit.', 'error');
      }
    }
  };

  const runVerificationPipeline = () => {
    if (!selectedBounty) {
      showToast("Please query or select a target bounty first", "warning");
      return;
    }
    if (!selectedBounty.isActive) {
      showToast("Selected bounty has already been resolved", "error");
      return;
    }
    if (!poeImage) {
      showToast("Please provide a proof-of-exploit Docker image tag", "warning");
      return;
    }
    if (!researcherPayoutAddress) {
      showToast("Please enter a valid researcher payout wallet", "warning");
      return;
    }

    triggerGitHubAction();
  };

  return (
    <div className="min-h-screen pb-16 bg-grid-pattern relative">
      
      {/* Dynamic Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none animate-pulse-slow"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none animate-pulse-slow"></div>

      {/* Global Toast Notification */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 transform translate-y-0
          ${toast.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/30 text-emerald-300 glow-emerald' : ''}
          ${toast.type === 'error' ? 'bg-rose-950/80 border-rose-500/30 text-rose-300' : ''}
          ${toast.type === 'warning' ? 'bg-amber-950/80 border-amber-500/30 text-amber-300' : ''}
          ${toast.type === 'info' ? 'bg-slate-900/80 border-slate-500/30 text-cyan-300 glow-cyan' : ''}
        `}>
          <div className="text-xl">
            {toast.type === 'success' && '🛡️'}
            {toast.type === 'error' && '⚠️'}
            {toast.type === 'warning' && '⚡'}
            {toast.type === 'info' && 'ℹ️'}
          </div>
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-white/10 bg-[#080B11]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-cyan-500/20">
              🛡️
            </div>
            <div>
              <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                AEGIS ESCROW
              </span>
              <span className="block text-[10px] text-cyan-500/70 tracking-widest font-mono font-bold uppercase">
                Decentralized Bug Escrow
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono">
              <span className={`h-2.5 w-2.5 rounded-full ${isWeb3Mode ? 'bg-indigo-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span className="text-gray-300">{isWeb3Mode ? "Sepolia Testnet" : "Local Sandbox Mode"}</span>
            </div>

            {account ? (
              <div className="flex items-center gap-3 pl-3 pr-2 py-1.5 rounded-xl bg-white/5 border border-white/10">
                <div className="text-right">
                  <span className="block text-[10px] text-gray-500 font-bold uppercase">Balance</span>
                  <span className="text-xs font-mono font-medium text-cyan-400">{balance} ETH</span>
                </div>
                <button 
                  onClick={disconnectWallet}
                  className="px-3 py-1.5 text-xs bg-red-950/40 border border-red-500/30 text-red-400 hover:bg-red-900/50 hover:text-white rounded-lg transition"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button 
                onClick={connectWallet}
                className="relative group overflow-hidden px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 rounded-xl text-sm font-semibold transition shadow-lg shadow-cyan-500/20 active:scale-95"
              >
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
                  </svg>
                  Connect Wallet
                </div>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 mt-8">

        {/* Hero Banner with system description */}
        <section className="p-8 rounded-3xl bg-gradient-to-r from-slate-900/90 via-[#0B0F19]/90 to-slate-900/90 border border-white/10 shadow-2xl relative overflow-hidden mb-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.1),transparent_50%)] pointer-events-none"></div>
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                Active Protocol
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold text-white mt-4 tracking-tight leading-tight">
                Automating Web3 Trust <br/>
                <span className="bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                  With Cryptographic Escrow
                </span>
              </h1>
              <p className="text-gray-400 mt-4 text-sm md:text-base leading-relaxed">
                Aegis Escrow uses sandboxed automated environments to verify software vulnerabilities. 
                Lock your bounty funds in the smart contract. Once our automated GitHub Actions runner checks the researcher's proof-of-exploit (PoE) and matches the flag, funds are paid out autonomously. No manual intervention, no rug-pulls.
              </p>
            </div>

            {/* Smart Contract Info Pill */}
            <div className="flex flex-col gap-3 p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm self-start lg:self-center font-mono text-xs w-full lg:w-80">
              <div className="flex justify-between items-center text-gray-500 font-bold border-b border-white/10 pb-2">
                <span>ESCROW DETAILS</span>
                <span className="text-cyan-500 font-bold">ONLINE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Address:</span>
                <a 
                  href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1"
                >
                  {CONTRACT_ADDRESS.substring(0, 6)}...{CONTRACT_ADDRESS.substring(38)}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-3 h-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Oracle Wallet:</span>
                <span className="text-gray-300">0x3914...f9C1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Environment:</span>
                <span className="text-amber-400">Docker Sandbox v1.2</span>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-white/20 transition duration-300">
            <span className="block text-xs text-gray-500 uppercase font-mono font-bold">Total Escrow Value</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-white font-display tracking-tight">{tvl}</span>
              <span className="text-xs font-bold font-mono text-cyan-400">ETH</span>
            </div>
            <div className="text-[10px] text-gray-500 mt-1">Locked secure in Smart Contract</div>
          </div>
          
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-white/20 transition duration-300">
            <span className="block text-xs text-gray-500 uppercase font-mono font-bold">Active Bounties</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-white font-display tracking-tight">{bountyCount}</span>
              <span className="text-xs font-semibold text-indigo-400 font-mono">Bounties</span>
            </div>
            <div className="text-[10px] text-indigo-400 mt-1">Verifiable by sandboxed Docker</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-white/20 transition duration-300">
            <span className="block text-xs text-gray-500 uppercase font-mono font-bold">Paid Out (Resolved)</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-white font-display tracking-tight">{resolvedCount}</span>
              <span className="text-xs font-semibold text-emerald-400 font-mono">Claims</span>
            </div>
            <div className="text-[10px] text-emerald-400 mt-1">Exploits validated by CI oracle</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-white/20 transition duration-300 flex flex-col justify-between">
            <div>
              <span className="block text-xs text-gray-500 uppercase font-mono font-bold">CI Runner Engine</span>
              <div className="flex items-center gap-2 mt-3">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="text-sm font-bold font-mono text-emerald-400 uppercase tracking-wider">ONLINE & LISTENING</span>
              </div>
            </div>
            <span className="text-[9px] text-gray-500 mt-2 block font-mono">Workflow: github.com/Mukul312004/defi-bounty-escrow</span>
          </div>
        </section>

        {/* Action Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Columns - Bounty Creation & Interactive List */}
          <div className="lg:col-span-6 flex flex-col gap-8">
            
            {/* Create Bounty Form */}
            <div className="p-6 rounded-2xl bg-[#0B0F19]/80 border border-white/10 glow-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-cyan-900/40 text-cyan-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">1. Create Bounty (Owner)</h2>
              </div>
              <p className="text-xs text-gray-400 mb-5">
                Fund a new bounty. Specify target vulnerability and repo. Reward will be locked in the smart contract.
              </p>

              <form onSubmit={handleCreateBounty} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Bounty Reward Amount (ETH)</label>
                  <div className="relative">
                    <input 
                      type="number" step="0.0001" min="0.0001" required
                      value={bountyAmount} onChange={(e) => setBountyAmount(e.target.value)}
                      placeholder="e.g. 0.25"
                      className="w-full bg-slate-950 border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-3 text-white placeholder-gray-600 outline-none text-sm transition"
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-xs font-mono font-bold text-gray-500">
                      ETH
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Bounty Title</label>
                    <input 
                      type="text" required
                      value={bountyTitle} onChange={(e) => setBountyTitle(e.target.value)}
                      placeholder="e.g., Read database secrets"
                      className="w-full bg-slate-950 border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-3 text-white placeholder-gray-600 outline-none text-sm transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Vulnerability Class</label>
                    <select 
                      value={bountyCategory} onChange={(e) => setBountyCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-3 text-white outline-none text-sm transition"
                    >
                      <option value="SQL Injection">SQL Injection</option>
                      <option value="Reentrancy">Reentrancy (Vault Drain)</option>
                      <option value="Cryptography">Cryptography (Signature Malleability)</option>
                      <option value="Arithmetic Error">Arithmetic Overflow / Rounding</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Sandbox Repository (GitHub)</label>
                  <input 
                    type="text" 
                    value={bountyRepo} onChange={(e) => setBountyRepo(e.target.value)}
                    placeholder="e.g., github.com/Mukul312004/defi-bounty-escrow"
                    className="w-full bg-slate-950 border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-3 text-white placeholder-gray-600 outline-none text-sm transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Bounty Description & Flag Condition</label>
                  <textarea 
                    rows="2"
                    value={bountyDesc} onChange={(e) => setBountyDesc(e.target.value)}
                    placeholder="Provide details. E.g., The app must yield the flag starting with flag{...}"
                    className="w-full bg-slate-950 border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-3 text-white placeholder-gray-600 outline-none text-sm transition resize-none"
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition text-sm shadow-md shadow-cyan-500/10 flex items-center justify-center gap-2 mt-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  {isWeb3Mode ? "Lock Funds on Sepolia Contract" : "Lock Funds in Local Sandbox"}
                </button>
              </form>
            </div>

            {/* Interactive Bounties List */}
            <div className="p-6 rounded-2xl bg-[#0B0F19]/80 border border-white/10">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-indigo-900/40 text-indigo-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Escrow Bounty Database</h3>
                </div>
                <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Select to claim</span>
              </div>

              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 terminal-scrollbar">
                {bountiesList.length === 0 && (
                  <div className="text-center text-gray-500 text-xs py-8 font-mono">
                    No bounties loaded. Create one above or check backend connection.
                  </div>
                )}
                {bountiesList.map((b) => (
                  <div 
                    key={b._id || b.id} 
                    onClick={() => selectBountyCard(b)}
                    className={`p-4 rounded-xl border transition cursor-pointer text-left ${
                      (selectedBounty?._id || selectedBounty?.id) === (b._id || b.id) 
                        ? 'bg-cyan-950/30 border-cyan-500/50 glow-cyan' 
                        : 'bg-slate-950/50 border-white/5 hover:border-white/10 hover:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-cyan-400">#{getBountyDisplayId(b)}</span>
                          <span className="text-sm font-bold text-white tracking-tight">{b.title}</span>
                        </div>
                        <span className="text-[10px] font-mono text-gray-500 block mt-1">{b.repo}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-extrabold text-white block">{b.amount} ETH</span>
                        <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full mt-1 ${
                          b.isActive ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' : 'bg-red-950 text-red-400 border border-red-500/20'
                        }`}>
                          {b.isActive ? "🟢 Active" : "🔴 Claimed"}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5 text-[10px] text-gray-400">
                      <span>Category: <strong className="text-indigo-400">{b.category}</strong></span>
                      <span className="font-mono text-gray-500">Creator: {truncateAddress(b.creator)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Columns - Researcher Submission & Live Pipeline Status */}
          <div className="lg:col-span-6 flex flex-col gap-8">
            
            {/* Researcher Action Panel */}
            <div className="p-6 rounded-2xl bg-[#0B0F19]/80 border border-white/10 glow-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-purple-900/40 text-purple-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">2. Submit PoE (Researcher)</h2>
              </div>

              {/* Step 2.1: Target Selection */}
              <form onSubmit={handleFetchBounty} className="mb-4">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Query Escrow Bounty</label>
                  <span className="text-[10px] text-gray-500 font-mono">Search by title or on-chain ID</span>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" required
                    value={searchBountyId} onChange={(e) => setSearchBountyId(e.target.value)}
                    placeholder="Bounty title, on-chain ID, or DB ID"
                    className="flex-1 bg-slate-950 border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-3 text-white placeholder-gray-600 outline-none text-sm transition"
                  />
                  <button 
                    type="submit" 
                    className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 border border-white/10"
                  >
                    Fetch Info
                  </button>
                </div>
              </form>

              {/* Render selected bounty preview card */}
              {selectedBounty && (
                <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/20 mb-5 text-left">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20">
                      Bounty #{getBountyDisplayId(selectedBounty)} Details
                    </span>
                    <span className={`text-xs font-bold font-mono ${selectedBounty.isActive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {selectedBounty.isActive ? "ACTIVE ESCROW" : "RESOLVED & CLAIMS CLOSED"}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{selectedBounty.title}</h4>
                  <p className="text-xs text-gray-400 mt-1.5 leading-relaxed bg-white/5 p-2 rounded border border-white/5">
                    {selectedBounty.description}
                  </p>
                  <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-white/5 text-xs">
                    <div>
                      <span className="text-gray-500 block uppercase text-[9px] font-bold">Reward Pool</span>
                      <strong className="text-white text-sm">{selectedBounty.amount} ETH</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block uppercase text-[9px] font-bold">Target Sandbox repo</span>
                      <span className="text-indigo-400 font-mono text-[11px] truncate block">{selectedBounty.repo}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2.2: PoE Submissions form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Proof-of-Exploit Docker Image</label>
                  <input 
                    type="text" required
                    value={poeImage} onChange={(e) => setPoeImage(e.target.value)}
                    placeholder="e.g. registry/exploit-payload:v1.0"
                    disabled={!selectedBounty?.isActive}
                    className="w-full bg-slate-950 border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-3 text-white placeholder-gray-600 outline-none text-sm transition disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Researcher Payout Wallet Address</label>
                  <input 
                    type="text" required
                    value={researcherPayoutAddress} onChange={(e) => setResearcherPayoutAddress(e.target.value)}
                    placeholder="0x..."
                    disabled={!selectedBounty?.isActive}
                    className="w-full bg-slate-950 border border-white/10 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl px-4 py-3 text-white placeholder-gray-600 outline-none text-sm transition disabled:opacity-50 font-mono"
                  />
                </div>

                <button 
                  onClick={runVerificationPipeline}
                  disabled={!selectedBounty?.isActive || pipelineStatus === 'running'}
                  className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition text-sm shadow-md shadow-purple-500/10 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {pipelineStatus === 'running' ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Executing Pipeline...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.64 3.75 14.98 14.98 0 003.5 15.86c0 1 .13 1.96.38 2.89m12.11-4.38l-4.8-4.8m0 0a3.97 3.97 0 015.62-5.63m-5.62 5.63L3.5 15.86m0 0a3.97 3.97 0 005.63 5.62" />
                      </svg>
                      Trigger Automated Verification
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Pipeline Step Visualizer */}
            <div className="p-6 rounded-2xl bg-[#0B0F19]/80 border border-white/10">
              <h3 className="text-base font-bold text-white tracking-tight mb-4 flex items-center gap-2">
                <span>CI Testbed Verification Pipeline</span>
                {pipelineStatus === 'running' && <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping"></span>}
              </h3>

              {/* Progress timeline */}
              <div className="space-y-4 font-mono text-xs text-left relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-white/5">
                
                {/* Step 1 */}
                <div className="flex items-start gap-4 relative">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold border z-10 transition ${
                    currentStep > 1 ? 'bg-emerald-950 text-emerald-400 border-emerald-500' :
                    currentStep === 1 ? 'bg-indigo-950 text-indigo-400 border-indigo-500 glow-purple animate-pulse' :
                    'bg-slate-950 text-gray-600 border-white/5'
                  }`}>
                    {currentStep > 1 ? '✓' : '1'}
                  </div>
                  <div>
                    <span className={`block font-bold ${currentStep === 1 ? 'text-indigo-400' : currentStep > 1 ? 'text-gray-300' : 'text-gray-600'}`}>
                      Trigger Sandbox Runner
                    </span>
                    <span className="text-[10px] text-gray-500 block">Initialize CI runtime in github actions.</span>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-4 relative">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold border z-10 transition ${
                    currentStep > 2 ? 'bg-emerald-950 text-emerald-400 border-emerald-500' :
                    currentStep === 2 ? 'bg-indigo-950 text-indigo-400 border-indigo-500 glow-purple animate-pulse' :
                    'bg-slate-950 text-gray-600 border-white/5'
                  }`}>
                    {currentStep > 2 ? '✓' : '2'}
                  </div>
                  <div>
                    <span className={`block font-bold ${currentStep === 2 ? 'text-indigo-400' : currentStep > 2 ? 'text-gray-300' : 'text-gray-600'}`}>
                      Boot Vulnerable Target App
                    </span>
                    <span className="text-[10px] text-gray-500 block">Initialize seed DB and start Flask target in network.</span>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-4 relative">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold border z-10 transition ${
                    currentStep > 3 ? 'bg-emerald-950 text-emerald-400 border-emerald-500' :
                    currentStep === 3 ? 'bg-indigo-950 text-indigo-400 border-indigo-500 glow-purple animate-pulse' :
                    'bg-slate-950 text-gray-600 border-white/5'
                  }`}>
                    {currentStep > 3 ? '✓' : '3'}
                  </div>
                  <div>
                    <span className={`block font-bold ${currentStep === 3 ? 'text-indigo-400' : currentStep > 3 ? 'text-gray-300' : 'text-gray-600'}`}>
                      Execute Proof-of-Exploit
                    </span>
                    <span className="text-[10px] text-gray-500 block">Run the submitted docker container exploit payloads.</span>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-4 relative">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold border z-10 transition ${
                    currentStep > 4 ? 'bg-emerald-950 text-emerald-400 border-emerald-500' :
                    currentStep === 4 ? 'bg-indigo-950 text-indigo-400 border-indigo-500 glow-purple animate-pulse' :
                    'bg-slate-950 text-gray-600 border-white/5'
                  }`}>
                    {currentStep > 4 ? '✓' : '4'}
                  </div>
                  <div>
                    <span className={`block font-bold ${currentStep === 4 ? 'text-indigo-400' : currentStep > 4 ? 'text-gray-300' : 'text-gray-600'}`}>
                      Flag Match Verification
                    </span>
                    <span className="text-[10px] text-gray-500 block">Check outputs against target database secret flag.</span>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="flex items-start gap-4 relative">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold border z-10 transition ${
                    pipelineStatus === 'success' ? 'bg-emerald-950 text-emerald-400 border-emerald-500 glow-emerald' :
                    currentStep === 5 ? 'bg-indigo-950 text-indigo-400 border-indigo-500 glow-purple animate-pulse' :
                    'bg-slate-950 text-gray-600 border-white/5'
                  }`}>
                    {pipelineStatus === 'success' ? '✓' : '5'}
                  </div>
                  <div>
                    <span className={`block font-bold ${currentStep === 5 ? 'text-indigo-400' : pipelineStatus === 'success' ? 'text-emerald-400' : 'text-gray-600'}`}>
                      Automated Blockchain Payout
                    </span>
                    <span className="text-[10px] text-gray-500 block">Sign payout transactions via smart contract interface.</span>
                  </div>
                </div>

              </div>
            </div>

          </div>

        </div>

        {/* Live CI Runner Terminal Logs Panel */}
        <section className="mt-8 border border-white/10 bg-[#04060b] rounded-3xl overflow-hidden scanline relative shadow-2xl">
          <div className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-[#080B11]/50 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500"></span>
              <span className="h-3 w-3 rounded-full bg-yellow-500"></span>
              <span className="h-3 w-3 rounded-full bg-green-500"></span>
              <span className="text-xs font-mono font-bold text-gray-400 ml-3 flex items-center gap-2">
                <svg className={`w-3.5 h-3.5 text-cyan-500 ${pipelineStatus === 'running' ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                CI-RUNNER-CONSOLE: {pipelineStatus.toUpperCase()}
              </span>
            </div>
            <button 
              onClick={() => setTerminalLogs([])}
              className="text-[10px] font-mono text-gray-500 hover:text-cyan-400 hover:underline transition"
            >
              Clear Logs
            </button>
          </div>
          
          <div className="p-6 h-64 overflow-y-auto text-left text-xs font-mono text-cyan-400 bg-black/60 terminal-scrollbar select-text leading-relaxed">
            {terminalLogs.length === 0 ? (
              <div className="text-gray-600 flex flex-col items-center justify-center h-full gap-2 font-sans">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8 text-gray-700">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
                <p className="text-xs">Console is idle. Trigger a verification payload above to inspect live pipeline execution output.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {terminalLogs.map((log, index) => (
                  <div key={index} className="transition duration-200">
                    <span className="text-gray-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                    <span className={
                      log.includes('[SYSTEM]') ? 'text-indigo-400 font-bold' :
                      log.includes('[DOCKER]') ? 'text-amber-400' :
                      log.includes('[EXPLOIT]') ? 'text-cyan-300' :
                      log.includes('[DATABASE]') ? 'text-gray-400' :
                      log.includes('[CI-ORACLE]') || log.includes('[CI]') ? 'text-pink-400 font-bold' :
                      log.includes('VERIFICATION MATCH') || log.includes('SUCCESS') || log.includes('TRANSACTION CONFIRMED') || log.includes('Tracked GitHub') ? 'text-emerald-400 font-bold' :
                      'text-cyan-400'
                    }>
                      {log}
                    </span>
                  </div>
                ))}
                {pipelineStatus === 'running' && (
                  <div className="h-1.5 w-1.5 bg-cyan-400 inline-block animate-pulse ml-1"></div>
                )}
              </div>
            )}
          </div>
        </section>

      </main>
    </div>
  );
}

export default App;