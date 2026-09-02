import { useState, useEffect, useRef } from 'react';
import { BrowserProvider, Contract, parseEther, formatEther } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './constants';
import { fetchBounties, createBountyAPI, createSubmission, pollSubmissionStatus } from './api';
import './App.css';

// Initial empty fallback bounties
const INITIAL_BOUNTIES = [];

// Helper: get a short display ID for a bounty
const getBountyDisplayId = (b) => b?.onChainId ?? b?._id?.slice(-6) ?? '??';

// Helper: safely truncate an address for display
const truncateAddress = (addr) => {
  if (!addr || addr.length < 10) return addr || 'Unknown';
  return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
};

function App() {
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

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
  const [categoryFilter, setCategoryFilter] = useState('All');

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
  const terminalEndRef = useRef(null);

  // Sync dark mode class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

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

  // Auto scroll terminal logs
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  // Fetch bounties on mount
  useEffect(() => {
    fetchBounties()
      .then(data => {
        setBountiesList(data);
        setBountyCount(data.length);
        const active = data.filter(b => b.isActive);
        const resolved = data.filter(b => !b.isActive);
        setResolvedCount(resolved.length);
        const totalLocked = active.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
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
        showToast("Web3 Wallet connected successfully.", "success");

        // Sync statistics if contract is available
        try {
          const counter = await _contract.bountyCounter();
          setBountyCount(Number(counter));
        } catch (e) {
          console.warn("Could not read contract bounty counter. Using API stats.", e);
        }
      } catch (error) {
        console.error("Wallet connection failed", error);
        showToast("Failed to connect wallet.", "error");
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
    showToast("Wallet disconnected. Sandbox Mode active.", "info");
  };

  const handleCreateBounty = async (e) => {
    e.preventDefault();
    if (!bountyAmount || !bountyTitle) {
      showToast("Please provide a bounty reward amount and title.", "warning");
      return;
    }

    if (isWeb3Mode && contract) {
      try {
        showToast("Initiating contract transaction... Please confirm in your wallet.", "info");
        const tx = await contract.createBounty({ value: parseEther(bountyAmount) });
        showToast("Transaction submitted. Awaiting block confirmation...", "info");
        await tx.wait();
        
        showToast("Bounty locked in smart contract successfully.", "success");
        
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
        
        showToast(`Bounty created in sandbox database.`, "success");
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
      showToast(`Selected Bounty #${getBountyDisplayId(found)}`, "success");
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
    setTvl(prev => Math.max(0, (parseFloat(prev) - parseFloat(selectedBounty.amount || 0))).toFixed(2));
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
            setTvl(prev => Math.max(0, parseFloat(prev) - parseFloat(selectedBounty.amount || 0)).toFixed(2));
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
      if (err.message && (err.message.includes('HTTP error') || err.message.includes('Failed to fetch'))) {
        showToast("Backend API offline. Running in sandbox simulation mode.", "info");
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
      showToast("Please query or select a target bounty first.", "warning");
      return;
    }
    if (!selectedBounty.isActive) {
      showToast("Selected bounty has already been resolved.", "error");
      return;
    }
    if (!poeImage) {
      showToast("Please provide a proof-of-exploit Docker image tag.", "warning");
      return;
    }
    if (!researcherPayoutAddress) {
      showToast("Please enter a valid researcher payout wallet.", "warning");
      return;
    }

    triggerGitHubAction();
  };

  // Filter bounties by category
  const filteredBounties = categoryFilter === 'All' 
    ? bountiesList 
    : bountiesList.filter(b => b.category === categoryFilter);

  const categories = ['All', 'SQL Injection', 'Reentrancy', 'Cryptography', 'Arithmetic Error'];

  return (
    <div className="min-h-screen bg-canvas text-body font-sans selection:bg-link-soft selection:text-ink transition-colors duration-200">
      
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-canvas-elevated border border-hairline rounded-md shadow-floating text-xs font-medium text-ink transition-all animate-in fade-in slide-in-from-bottom-2">
          <span className="text-sm">
            {toast.type === 'success' && '✓'}
            {toast.type === 'error' && '✕'}
            {toast.type === 'warning' && '⚠'}
            {toast.type === 'info' && 'ℹ'}
          </span>
          <p className="text-body font-normal">{toast.message}</p>
        </div>
      )}

      {/* Navigation Bar (Geist nav-bar) */}
      <header className="sticky top-0 z-40 bg-canvas/80 backdrop-blur-md border-b border-hairline transition-colors">
        <div className="max-w-6xl mx-auto px-6 h-16 flex justify-between items-center">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-sm bg-ink text-canvas flex items-center justify-center font-bold text-xs shadow-whisper">
              ▲
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base text-ink tracking-tight">
                Aegis Escrow
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-medium text-mute bg-hairline-soft border border-hairline rounded-sm uppercase tracking-wider">
                Protocol v1.0
              </span>
            </div>
          </div>

          {/* Nav Controls */}
          <div className="flex items-center gap-3">
            
            {/* Mode Indicator Pill */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-sm bg-canvas-elevated border border-hairline text-xs font-mono">
              <span className={`h-2 w-2 rounded-full ${isWeb3Mode ? 'bg-link animate-pulse' : 'bg-mute'}`}></span>
              <span className="text-mute font-medium">
                {isWeb3Mode ? "Sepolia Testnet" : "Sandbox Mode"}
              </span>
            </div>

            {/* Dark Mode Toggle Button */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="h-8 w-8 flex items-center justify-center rounded-sm bg-canvas-elevated border border-hairline hover:bg-hairline-soft text-ink transition-colors"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle theme"
            >
              {isDarkMode ? (
                // Sun Icon for Dark Mode
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4"></circle>
                  <path d="M12 2v2"></path>
                  <path d="M12 20v2"></path>
                  <path d="m4.93 4.93 1.41 1.41"></path>
                  <path d="m17.66 17.66 1.41 1.41"></path>
                  <path d="M2 12h2"></path>
                  <path d="M20 12h2"></path>
                  <path d="m6.34 17.66-1.41 1.41"></path>
                  <path d="m19.07 4.93-1.41 1.41"></path>
                </svg>
              ) : (
                // Moon Icon for Light Mode
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                </svg>
              )}
            </button>

            {account ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center px-3 py-1 bg-canvas-elevated border border-hairline rounded-sm text-xs font-mono text-ink">
                  <span className="text-mute mr-1.5">Bal:</span> {balance} ETH
                </div>
                <button 
                  onClick={disconnectWallet}
                  className="h-8 px-3 text-xs font-medium text-ink bg-canvas-elevated border border-hairline hover:bg-hairline-soft rounded-sm transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button 
                onClick={connectWallet}
                className="h-8 px-3.5 text-xs font-medium text-canvas bg-ink hover:opacity-90 rounded-sm transition-colors shadow-whisper flex items-center gap-1.5 dark:bg-white dark:text-black dark:hover:bg-[#e6e6e6]"
              >
                <span>Connect Wallet</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 pt-12 pb-24">

        {/* Hero Band with Mesh Gradient (Geist hero-band) */}
        <section className="relative rounded-lg border border-hairline bg-canvas-elevated p-8 sm:p-12 mb-10 overflow-hidden shadow-whisper transition-colors">
          {/* Multi-stop mesh gradient restricted strictly to hero */}
          <div className="absolute inset-0 hero-mesh-gradient pointer-events-none opacity-85"></div>
          
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            <div className="lg:col-span-8">
              <div className="inline-flex items-center gap-2 font-mono text-xs font-medium text-mute uppercase tracking-wider mb-4">
                <span>Trustless Verification</span>
                <span className="text-hairline">•</span>
                <span className="text-link">Autonomous Payout</span>
              </div>
              
              <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-semibold text-ink tracking-[-2px] leading-[1.1] mb-4">
                Automated Bug Bounty Escrow for Web3 Protocols
              </h1>
              
              <p className="text-body text-sm sm:text-base leading-relaxed max-w-2xl">
                Protocol owners lock bounty rewards in immutable smart contracts. Security researchers submit containerized Proof-of-Exploits. Sandboxed CI environments verify execution and trigger instant on-chain payouts without human bias.
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-6">
                <a
                  href="#create-bounty"
                  className="h-10 px-5 text-sm font-medium text-canvas bg-ink hover:opacity-90 dark:bg-white dark:text-black dark:hover:bg-[#e6e6e6] rounded-pill transition-colors inline-flex items-center justify-center shadow-whisper"
                >
                  Create Bounty
                </a>
                <a
                  href="#submit-poe"
                  className="h-10 px-5 text-sm font-medium text-ink bg-canvas-elevated border border-hairline hover:bg-hairline-soft rounded-pill transition-colors inline-flex items-center justify-center"
                >
                  Submit PoE
                </a>
              </div>
            </div>

            {/* Contract Spec Sheet Card */}
            <div className="lg:col-span-4 bg-canvas/90 border border-hairline rounded-md p-4 text-xs font-mono space-y-2.5 transition-colors">
              <div className="flex justify-between items-center text-mute border-b border-hairline pb-2 font-semibold">
                <span>ESCROW SPEC</span>
                <span className="text-link font-medium">SEPOLIA ACTIVE</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-mute">Contract:</span>
                <a 
                  href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-link hover:underline truncate max-w-[140px]"
                  title={CONTRACT_ADDRESS}
                >
                  {truncateAddress(CONTRACT_ADDRESS)}
                </a>
              </div>
              
              <div className="flex justify-between">
                <span className="text-mute">Oracle:</span>
                <span className="text-body font-mono">0x3914...f9C1</span>
              </div>

              <div className="flex justify-between">
                <span className="text-mute">Sandbox:</span>
                <span className="text-body">Docker v24 + GhA</span>
              </div>
            </div>

          </div>
        </section>

        {/* Stats Grid (Geist logo-strip & feature-cards) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          
          <div className="p-5 rounded-md bg-canvas-elevated border border-hairline shadow-whisper transition-colors">
            <span className="block text-xs font-mono uppercase font-medium text-mute tracking-wider">Total Value Locked</span>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-2xl lg:text-3xl font-semibold text-ink tracking-tight">{tvl}</span>
              <span className="text-xs font-mono font-medium text-mute">ETH</span>
            </div>
            <div className="text-[11px] text-mute mt-1">Locked in BountyEscrow</div>
          </div>
          
          <div className="p-5 rounded-md bg-canvas-elevated border border-hairline shadow-whisper transition-colors">
            <span className="block text-xs font-mono uppercase font-medium text-mute tracking-wider">Active Bounties</span>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-2xl lg:text-3xl font-semibold text-ink tracking-tight">{bountyCount}</span>
              <span className="text-xs font-mono font-medium text-mute">Tasks</span>
            </div>
            <div className="text-[11px] text-mute mt-1">Open for PoE audit</div>
          </div>

          <div className="p-5 rounded-md bg-canvas-elevated border border-hairline shadow-whisper transition-colors">
            <span className="block text-xs font-mono uppercase font-medium text-mute tracking-wider">Resolved Claims</span>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-2xl lg:text-3xl font-semibold text-ink tracking-tight">{resolvedCount}</span>
              <span className="text-xs font-mono font-medium text-mute">Payouts</span>
            </div>
            <div className="text-[11px] text-mute mt-1">Autonomous release</div>
          </div>

          <div className="p-5 rounded-md bg-canvas-elevated border border-hairline shadow-whisper flex flex-col justify-between transition-colors">
            <div>
              <span className="block text-xs font-mono uppercase font-medium text-mute tracking-wider">CI Testbed Engine</span>
              <div className="flex items-center gap-2 mt-2">
                <span className="h-2 w-2 rounded-full bg-link"></span>
                <span className="text-xs font-mono font-semibold text-ink uppercase">READY</span>
              </div>
            </div>
            <span className="text-[11px] font-mono text-mute mt-2 block truncate">
              bounty-ci.yml
            </span>
          </div>

        </section>

        {/* Category Filter Tabs (Geist button-category-pill) */}
        <section className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 custom-scrollbar">
          <span className="text-xs font-mono uppercase font-medium text-mute mr-2 shrink-0">Filter:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`h-7 px-3 text-xs font-medium rounded-pill transition-colors shrink-0 ${
                categoryFilter === cat
                  ? 'bg-ink text-canvas shadow-whisper dark:bg-white dark:text-black'
                  : 'bg-canvas-elevated text-body border border-hairline hover:bg-hairline-soft hover:text-ink'
              }`}
            >
              {cat}
            </button>
          ))}
        </section>

        {/* Action Panel Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
          
          {/* Left Column: Create Bounty & Bounty Database */}
          <div className="lg:col-span-6 space-y-8">
            
            {/* Create Bounty Card (Geist feature-card) */}
            <div id="create-bounty" className="p-6 rounded-md bg-canvas-elevated border border-hairline shadow-whisper transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-medium text-mute uppercase tracking-wider">01 / PROTOCOL OWNER</span>
                <span className="text-[10px] font-mono text-mute bg-hairline-soft px-2 py-0.5 rounded-sm border border-hairline">
                  {isWeb3Mode ? "Contract Deposit" : "Sandbox State"}
                </span>
              </div>
              
              <h2 className="text-lg font-semibold text-ink tracking-[-0.4px]">
                Create & Lock Bounty
              </h2>
              
              <p className="text-xs text-body mt-1 mb-5">
                Deposit ETH into the escrow contract and provide target sandbox repository details.
              </p>

              <form onSubmit={handleCreateBounty} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1.5">
                    Reward Amount (ETH)
                  </label>
                  <div className="relative">
                    <input 
                      type="number" step="0.0001" min="0.0001" required
                      value={bountyAmount} onChange={(e) => setBountyAmount(e.target.value)}
                      placeholder="0.25"
                      className="w-full bg-canvas-elevated border border-hairline focus:border-ink rounded-sm px-3 py-2 text-sm text-ink placeholder-faint outline-none transition-colors"
                    />
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-xs font-mono font-medium text-mute">
                      ETH
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-ink mb-1.5">
                      Bounty Title
                    </label>
                    <input 
                      type="text" required
                      value={bountyTitle} onChange={(e) => setBountyTitle(e.target.value)}
                      placeholder="e.g. Read database secrets"
                      className="w-full bg-canvas-elevated border border-hairline focus:border-ink rounded-sm px-3 py-2 text-sm text-ink placeholder-faint outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-ink mb-1.5">
                      Vulnerability Category
                    </label>
                    <select 
                      value={bountyCategory} onChange={(e) => setBountyCategory(e.target.value)}
                      className="w-full bg-canvas-elevated border border-hairline focus:border-ink rounded-sm px-3 py-2 text-sm text-ink outline-none transition-colors"
                    >
                      <option value="SQL Injection">SQL Injection</option>
                      <option value="Reentrancy">Reentrancy (Vault Drain)</option>
                      <option value="Cryptography">Cryptography (Malleability)</option>
                      <option value="Arithmetic Error">Arithmetic Overflow</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink mb-1.5">
                    Target Repository URL
                  </label>
                  <input 
                    type="text" 
                    value={bountyRepo} onChange={(e) => setBountyRepo(e.target.value)}
                    placeholder="github.com/Mukul312004/defi-bounty-escrow"
                    className="w-full bg-canvas-elevated border border-hairline focus:border-ink rounded-sm px-3 py-2 text-sm font-mono text-ink placeholder-faint outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink mb-1.5">
                    Description & Expected Flag
                  </label>
                  <textarea 
                    rows="2"
                    value={bountyDesc} onChange={(e) => setBountyDesc(e.target.value)}
                    placeholder="The containerized PoE must extract flag{...} from the target service."
                    className="w-full bg-canvas-elevated border border-hairline focus:border-ink rounded-sm px-3 py-2 text-sm text-ink placeholder-faint outline-none transition-colors resize-none"
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  className="w-full h-10 text-sm font-medium text-canvas bg-ink hover:opacity-90 dark:bg-white dark:text-black dark:hover:bg-[#e6e6e6] rounded-sm transition-colors shadow-whisper flex items-center justify-center gap-2 mt-2"
                >
                  <span>{isWeb3Mode ? "Lock Funds on Sepolia Contract" : "Lock Funds in Local Sandbox"}</span>
                </button>
              </form>
            </div>

            {/* Escrow Bounty Database (Geist feature-card grid) */}
            <div className="p-6 rounded-md bg-canvas-elevated border border-hairline shadow-whisper transition-colors">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <span className="font-mono text-xs font-medium text-mute uppercase tracking-wider block">EXPLORER</span>
                  <h3 className="text-base font-semibold text-ink tracking-tight">Active Escrow Database</h3>
                </div>
                <span className="text-xs font-mono text-mute">{filteredBounties.length} items</span>
              </div>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                {filteredBounties.length === 0 && (
                  <div className="text-center text-mute text-xs py-8 font-mono border border-dashed border-hairline rounded-sm">
                    No bounties found for this filter.
                  </div>
                )}
                {filteredBounties.map((b) => {
                  const isSelected = (selectedBounty?._id || selectedBounty?.id) === (b._id || b.id);
                  return (
                    <div 
                      key={b._id || b.id} 
                      onClick={() => selectBountyCard(b)}
                      className={`p-3.5 rounded-sm border transition-all cursor-pointer text-left ${
                        isSelected 
                          ? 'bg-hairline-soft border-ink shadow-whisper' 
                          : 'bg-canvas-elevated border-hairline hover:border-mute/40'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-semibold text-ink">
                              #{getBountyDisplayId(b)}
                            </span>
                            <span className="text-sm font-medium text-ink tracking-tight">
                              {b.title}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-mute block mt-0.5 truncate max-w-[280px]">
                            {b.repo}
                          </span>
                        </div>
                        
                        <div className="text-right">
                          <span className="text-xs font-mono font-semibold text-ink block">
                            {b.amount} ETH
                          </span>
                          <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-sm mt-1 border ${
                            b.isActive 
                              ? 'bg-link-soft text-link dark:text-[#3291ff] border-link/20 font-medium' 
                              : 'bg-hairline-soft text-mute border-hairline font-normal'
                          }`}>
                            {b.isActive ? "ACTIVE" : "RESOLVED"}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-hairline text-[11px] text-mute">
                        <span>Category: <strong className="text-body font-medium">{b.category}</strong></span>
                        <span className="font-mono">By {truncateAddress(b.creator)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Column: Submit PoE & CI Pipeline */}
          <div className="lg:col-span-6 space-y-8">
            
            {/* Submit PoE Card (Geist feature-card) */}
            <div id="submit-poe" className="p-6 rounded-md bg-canvas-elevated border border-hairline shadow-whisper transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-medium text-mute uppercase tracking-wider">02 / SECURITY RESEARCHER</span>
                <span className="text-[10px] font-mono text-link dark:text-[#3291ff] bg-link-soft border border-link/20 px-2 py-0.5 rounded-sm">
                  PoE Verification
                </span>
              </div>

              <h2 className="text-lg font-semibold text-ink tracking-[-0.4px]">
                Submit Proof-of-Exploit
              </h2>

              <p className="text-xs text-body mt-1 mb-5">
                Query target bounty, supply your packaged exploit Docker container, and specify your payout address.
              </p>

              {/* Bounty Lookup Form */}
              <form onSubmit={handleFetchBounty} className="mb-4">
                <label className="block text-xs font-medium text-ink mb-1.5">
                  Select or Query Target Bounty
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text" required
                    value={searchBountyId} onChange={(e) => setSearchBountyId(e.target.value)}
                    placeholder="Search by ID or title"
                    className="flex-1 bg-canvas-elevated border border-hairline focus:border-ink rounded-sm px-3 py-2 text-sm text-ink placeholder-faint outline-none transition-colors"
                  />
                  <button 
                    type="submit" 
                    className="h-9 px-3 text-xs font-medium text-ink bg-canvas-elevated border border-hairline hover:bg-hairline-soft rounded-sm transition-colors"
                  >
                    Select
                  </button>
                </div>
              </form>

              {/* Selected Bounty Details Inset */}
              {selectedBounty && (
                <div className="p-3.5 rounded-sm bg-hairline-soft border border-hairline mb-5 text-xs text-left transition-colors">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-mono font-medium text-ink">
                      Target #{getBountyDisplayId(selectedBounty)} — {selectedBounty.title}
                    </span>
                    <span className={`font-mono text-[10px] ${selectedBounty.isActive ? 'text-link dark:text-[#3291ff] font-semibold' : 'text-mute'}`}>
                      {selectedBounty.isActive ? "OPEN REWARD" : "CLOSED"}
                    </span>
                  </div>
                  <p className="text-body text-[11px] leading-relaxed mb-2">
                    {selectedBounty.description}
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-hairline text-mute">
                    <div>
                      <span>Bounty Pool: </span>
                      <strong className="text-ink font-mono">{selectedBounty.amount} ETH</strong>
                    </div>
                    <div className="truncate">
                      <span>Repo: </span>
                      <strong className="text-body font-mono">{selectedBounty.repo}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* PoE Submission Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1.5">
                    Proof-of-Exploit Docker Image Tag
                  </label>
                  <input 
                    type="text" required
                    value={poeImage} onChange={(e) => setPoeImage(e.target.value)}
                    placeholder="registry/exploit-payload:v1.0"
                    disabled={!selectedBounty?.isActive}
                    className="w-full bg-canvas-elevated border border-hairline focus:border-ink rounded-sm px-3 py-2 text-sm font-mono text-ink placeholder-faint outline-none transition-colors disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink mb-1.5">
                    Researcher Payout Wallet Address
                  </label>
                  <input 
                    type="text" required
                    value={researcherPayoutAddress} onChange={(e) => setResearcherPayoutAddress(e.target.value)}
                    placeholder="0x..."
                    disabled={!selectedBounty?.isActive}
                    className="w-full bg-canvas-elevated border border-hairline focus:border-ink rounded-sm px-3 py-2 text-sm font-mono text-ink placeholder-faint outline-none transition-colors disabled:opacity-50"
                  />
                </div>

                <button 
                  onClick={runVerificationPipeline}
                  disabled={!selectedBounty?.isActive || pipelineStatus === 'running'}
                  className="w-full h-10 text-sm font-medium text-canvas bg-ink hover:opacity-90 dark:bg-white dark:text-black dark:hover:bg-[#e6e6e6] rounded-sm transition-colors shadow-whisper flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed mt-2"
                >
                  {pipelineStatus === 'running' ? (
                    <span className="flex items-center gap-2 font-mono text-xs">
                      <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      Executing CI Testbed Pipeline...
                    </span>
                  ) : (
                    <span>Trigger Automated Verification</span>
                  )}
                </button>
              </div>
            </div>

            {/* Pipeline Step Visualizer */}
            <div className="p-6 rounded-md bg-canvas-elevated border border-hairline shadow-whisper transition-colors">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <span className="font-mono text-xs font-medium text-mute uppercase tracking-wider block">ORACLE LIFECYCLE</span>
                  <h3 className="text-base font-semibold text-ink tracking-tight">CI Verification Pipeline</h3>
                </div>
                {pipelineStatus === 'running' && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono text-link">
                    <span className="h-2 w-2 rounded-full bg-link animate-ping"></span>
                    Running
                  </span>
                )}
              </div>

              {/* Progress timeline */}
              <div className="space-y-4 font-mono text-xs text-left relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-hairline">
                
                {/* Step 1 */}
                <div className="flex items-start gap-4 relative">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold border z-10 transition-colors ${
                    currentStep > 1 ? 'bg-ink text-canvas border-ink dark:bg-white dark:text-black dark:border-white' :
                    currentStep === 1 ? 'bg-link text-white border-link shadow-whisper' :
                    'bg-canvas-elevated text-mute border-hairline'
                  }`}>
                    {currentStep > 1 ? '✓' : '1'}
                  </div>
                  <div>
                    <span className={`block font-medium ${currentStep === 1 ? 'text-ink font-semibold' : currentStep > 1 ? 'text-body' : 'text-mute'}`}>
                      Initialize Runner
                    </span>
                    <span className="text-[11px] text-mute block font-sans">Boot GitHub Actions isolated CI runtime</span>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-4 relative">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold border z-10 transition-colors ${
                    currentStep > 2 ? 'bg-ink text-canvas border-ink dark:bg-white dark:text-black dark:border-white' :
                    currentStep === 2 ? 'bg-link text-white border-link shadow-whisper' :
                    'bg-canvas-elevated text-mute border-hairline'
                  }`}>
                    {currentStep > 2 ? '✓' : '2'}
                  </div>
                  <div>
                    <span className={`block font-medium ${currentStep === 2 ? 'text-ink font-semibold' : currentStep > 2 ? 'text-body' : 'text-mute'}`}>
                      Boot Target App Sandbox
                    </span>
                    <span className="text-[11px] text-mute block font-sans">Seed database flag & start target container</span>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-4 relative">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold border z-10 transition-colors ${
                    currentStep > 3 ? 'bg-ink text-canvas border-ink dark:bg-white dark:text-black dark:border-white' :
                    currentStep === 3 ? 'bg-link text-white border-link shadow-whisper' :
                    'bg-canvas-elevated text-mute border-hairline'
                  }`}>
                    {currentStep > 3 ? '✓' : '3'}
                  </div>
                  <div>
                    <span className={`block font-medium ${currentStep === 3 ? 'text-ink font-semibold' : currentStep > 3 ? 'text-body' : 'text-mute'}`}>
                      Execute Proof-of-Exploit
                    </span>
                    <span className="text-[11px] text-mute block font-sans">Run researcher exploit container in sandbox network</span>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-4 relative">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold border z-10 transition-colors ${
                    currentStep > 4 ? 'bg-ink text-canvas border-ink dark:bg-white dark:text-black dark:border-white' :
                    currentStep === 4 ? 'bg-link text-white border-link shadow-whisper' :
                    'bg-canvas-elevated text-mute border-hairline'
                  }`}>
                    {currentStep > 4 ? '✓' : '4'}
                  </div>
                  <div>
                    <span className={`block font-medium ${currentStep === 4 ? 'text-ink font-semibold' : currentStep > 4 ? 'text-body' : 'text-mute'}`}>
                      Validate Extracted Flag
                    </span>
                    <span className="text-[11px] text-mute block font-sans">Compare exploit JSON flag output against target hash</span>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="flex items-start gap-4 relative">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold border z-10 transition-colors ${
                    pipelineStatus === 'success' ? 'bg-ink text-canvas border-ink dark:bg-white dark:text-black dark:border-white' :
                    currentStep === 5 ? 'bg-link text-white border-link shadow-whisper' :
                    'bg-canvas-elevated text-mute border-hairline'
                  }`}>
                    {pipelineStatus === 'success' ? '✓' : '5'}
                  </div>
                  <div>
                    <span className={`block font-medium ${currentStep === 5 ? 'text-ink font-semibold' : pipelineStatus === 'success' ? 'text-ink font-semibold' : 'text-mute'}`}>
                      Autonomous Blockchain Release
                    </span>
                    <span className="text-[11px] text-mute block font-sans">Oracle broadcasts resolveBounty() on Sepolia</span>
                  </div>
                </div>

              </div>
            </div>

          </div>

        </div>

        {/* Live CI Runner Terminal Logs Panel (Geist code-block) */}
        <section className="rounded-md border border-hairline bg-[#0a0a0a] text-[#ededed] overflow-hidden shadow-floating">
          <div className="flex justify-between items-center px-4 py-3 border-b border-[#222222] bg-[#121212]">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#333333]"></span>
              <span className="h-2.5 w-2.5 rounded-full bg-[#333333]"></span>
              <span className="h-2.5 w-2.5 rounded-full bg-[#333333]"></span>
              <span className="text-xs font-mono font-medium text-[#888888] ml-2">
                ci-oracle-runner · {pipelineStatus.toUpperCase()}
              </span>
            </div>
            <button 
              onClick={() => setTerminalLogs([])}
              className="text-[11px] font-mono text-[#888888] hover:text-white transition-colors"
            >
              Clear
            </button>
          </div>
          
          <div className="p-5 h-64 overflow-y-auto text-left text-xs font-mono bg-[#0a0a0a] terminal-scrollbar select-text leading-relaxed">
            {terminalLogs.length === 0 ? (
              <div className="text-[#555555] flex flex-col items-center justify-center h-full gap-2 font-mono">
                <p className="text-xs">Oracle console idle. Submit or trigger verification above to view execution logs.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {terminalLogs.map((log, index) => (
                  <div key={index} className="transition-opacity">
                    <span className="text-[#555555] mr-2">[{new Date().toLocaleTimeString()}]</span>
                    <span className={
                      log.includes('[SYSTEM]') ? 'text-[#00dfd8]' :
                      log.includes('[DOCKER]') ? 'text-[#f9cb28]' :
                      log.includes('[EXPLOIT]') ? 'text-[#50e3c2]' :
                      log.includes('[DATABASE]') ? 'text-[#a1a1a1]' :
                      log.includes('[CI-ORACLE]') || log.includes('[CI]') ? 'text-[#eb367f] font-semibold' :
                      log.includes('VERIFICATION MATCH') || log.includes('SUCCESS') || log.includes('TRANSACTION CONFIRMED') ? 'text-[#50e3c2] font-semibold' :
                      'text-[#ededed]'
                    }>
                      {log}
                    </span>
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>
            )}
          </div>
        </section>

      </main>

      {/* Footer (Geist footer) */}
      <footer className="border-t border-hairline bg-canvas mt-16 py-8 text-center text-xs text-mute font-mono transition-colors">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <span>Aegis Escrow — Decentralized Bug Bounty Verification Protocol</span>
          <div className="flex items-center gap-4">
            <a 
              href="https://github.com/Mukul312004/defi-bounty-escrow" 
              target="_blank" 
              rel="noreferrer" 
              className="text-body hover:text-ink transition-colors"
            >
              GitHub Repo
            </a>
            <span>•</span>
            <a 
              href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`} 
              target="_blank" 
              rel="noreferrer" 
              className="text-body hover:text-ink transition-colors"
            >
              Sepolia Contract
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;