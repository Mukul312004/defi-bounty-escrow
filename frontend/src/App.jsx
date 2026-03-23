import { useState, useEffect } from 'react';
import { BrowserProvider, Contract, parseEther, formatEther } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from './constants';

function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);

  // Form states
  const [bountyAmount, setBountyAmount] = useState('');
  const [searchBountyId, setSearchBountyId] = useState('');
  const [bountyInfo, setBountyInfo] = useState(null);
  const [poeImage, setPoeImage] = useState('');
  const [status, setStatus] = useState('');

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const _provider = new BrowserProvider(window.ethereum);
        const accounts = await _provider.send("eth_requestAccounts", []);
        const signer = await _provider.getSigner();
        const _contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        setAccount(accounts[0]);
        setProvider(_provider);
        setContract(_contract);
      } catch (error) {
        console.error("Wallet connection failed", error);
      }
    } else {
      alert("Please install MetaMask!");
    }
  };

  const handleCreateBounty = async (e) => {
    e.preventDefault();
    if (!contract || !bountyAmount) return;
    try {
      setStatus("Creating bounty... please approve in MetaMask.");
      const tx = await contract.createBounty({ value: parseEther(bountyAmount) });
      await tx.wait();
      setStatus("Bounty created successfully!");
    } catch (error) {
      console.error(error);
      setStatus("Failed to create bounty.");
    }
  };

  const handleFetchBounty = async (e) => {
    e.preventDefault();
    if (!contract || !searchBountyId) return;
    try {
      const data = await contract.bounties(searchBountyId);
      setBountyInfo({
        creator: data.creator,
        amount: formatEther(data.amount),
        isActive: data.isActive
      });
      setStatus(`Fetched details for Bounty #${searchBountyId}`);
    } catch (error) {
      console.error(error);
      setStatus("Failed to fetch bounty. Does it exist?");
    }
  };

  const handleSubmitPoE = async (e) => {
    e.preventDefault();
    if (!poeImage || !searchBountyId) {
      setStatus("Provide a Bounty ID and Docker Image tag.");
      return;
    }
    // For MVP: We simulate the API call that would trigger GitHub Actions
    setStatus(`Triggering CI Pipeline for Bounty #${searchBountyId} using image: ${poeImage}...`);

    setTimeout(() => {
      setStatus("CI Pipeline is running. The Oracle will automatically release funds if the exploit is valid.");
    }, 2000);
  };

  return (
    <div className="min-h-screen p-8 font-sans text-gray-800">
      <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold mb-6 text-center text-blue-600">DeFi Bug Bounty Escrow</h1>

        <div className="flex justify-between items-center mb-8 pb-4 border-b">
          <p className="font-medium">
            Status: <span className="text-green-600">{account ? `Connected: ${account.substring(0, 6)}...${account.substring(38)}` : "Disconnected"}</span>
          </p>
          {!account && (
            <button onClick={connectWallet} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Connect Wallet
            </button>
          )}
        </div>

        {/* Status Message */}
        {status && <div className="mb-6 p-4 bg-yellow-100 text-yellow-800 rounded border border-yellow-300">{status}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Project Owner Section */}
          <div className="bg-gray-50 p-4 rounded border">
            <h2 className="text-xl font-semibold mb-4 border-b pb-2">1. Create Bounty (Owner)</h2>
            <form onSubmit={handleCreateBounty}>
              <label className="block text-sm mb-1">Bounty Reward (ETH)</label>
              <input
                type="number" step="0.0001"
                value={bountyAmount} onChange={(e) => setBountyAmount(e.target.value)}
                className="w-full p-2 border rounded mb-4" placeholder="e.g. 0.05"
              />
              <button type="submit" className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">
                Lock Funds in Escrow
              </button>
            </form>
          </div>

          {/* Researcher Section */}
          <div className="bg-gray-50 p-4 rounded border">
            <h2 className="text-xl font-semibold mb-4 border-b pb-2">2. Submit PoE (Researcher)</h2>
            <form onSubmit={handleFetchBounty} className="mb-4">
              <label className="block text-sm mb-1">Target Bounty ID</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={searchBountyId} onChange={(e) => setSearchBountyId(e.target.value)}
                  className="flex-1 p-2 border rounded" placeholder="Bounty ID"
                />
                <button type="submit" className="bg-gray-600 text-white px-3 py-2 rounded hover:bg-gray-700">Check</button>
              </div>
            </form>

            {bountyInfo && (
              <div className="mb-4 text-sm bg-white p-2 border rounded">
                <p><strong>Status:</strong> {bountyInfo.isActive ? "🟢 Active" : "🔴 Resolved"}</p>
                <p><strong>Reward:</strong> {bountyInfo.amount} ETH</p>
              </div>
            )}

            <form onSubmit={handleSubmitPoE}>
              <label className="block text-sm mb-1">PoE Docker Image</label>
              <input
                type="text"
                value={poeImage} onChange={(e) => setPoeImage(e.target.value)}
                className="w-full p-2 border rounded mb-4" placeholder="e.g., your-dockerhub-user/sql-exploit:latest"
              />
              <button type="submit" className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 disabled:opacity-50" disabled={!bountyInfo?.isActive}>
                Submit Exploit to CI
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;