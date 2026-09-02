# Automated DeFi Bug Bounty Protocol/System

[![Solidity](https://img.shields.io/badge/Solidity-%23363636.svg?style=flat&logo=solidity&logoColor=white)](https://soliditylang.org/)
[![React](https://img.shields.io/badge/React-19-20232A?style=flat&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=flat&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
[![Ethereum](https://img.shields.io/badge/Ethereum-Sepolia-3C3C3D?style=flat&logo=ethereum&logoColor=white)](https://sepolia.etherscan.io/)
[![Docker](https://img.shields.io/badge/Docker-Sandbox-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)

> **Aegis Escrow** is a trustless, automated bug bounty escrow platform that bridges Web3 smart contracts and automated sandboxed testbeds. Protocol owners lock bounty rewards in an immutable escrow smart contract. Security researchers submit containerized Proof-of-Exploits (PoE). An automated CI/CD oracle verifies the exploit in an isolated Docker sandbox and autonomously releases the locked bounty payout on-chain.

---

## The Problem & The Solution

| Traditional Bug Bounties  | Aegis Automated Escrow  |
|---|---|
| Protocol owners can refuse to pay or ghost researchers after receiving bug details. | Funds are locked in smart contracts upfront before audits begin. |
| Subjective human triage delays payouts by weeks or months. | Automated CI/CD testbed validates exploits in seconds. |
| Researchers risk leaking 0-days without guaranteed compensation. | Proof-of-Exploits are executed against isolated sandboxes autonomously. |
| Manual blockchain transfers required by admins. | Oracle triggers smart contract release directly to the researcher's wallet. |

---

## Architecture & Workflow

```
 ┌──────────────────┐
 │  Protocol Owner  │── 1. Create Bounty (Lock ETH in Contract) ──┐
 └──────────────────┘                                            │
                                                                 ▼
 ┌──────────────────┐                                   ┌─────────────────┐
 │ Security Hacker  │── 2. Submit PoE Docker Image ───►│  Aegis Escrow   │
 └──────────────────┘                                   │ Smart Contract  │
                                                        └────────┬────────┘
                                                                 ▲
 ┌────────────────────────────────────────────────────────┐      │ 5. Trigger
 │             GitHub Actions / CI/CD Oracle               │      │    Payout
 │                                                        │      │
 │  ┌───────────────────────┐   ┌──────────────────────┐ │      │
 │  │ Target Vulnerable App │◄──│ PoE Exploit Payload  │ │──────┘
 │  │   (Docker Sandbox)    │   │  (Docker Container)  │ │
 │  └───────────────────────┘   └──────────────────────┘ │
 │                             │                         │
 │                 4. Secret Flag Validated?             │
 └────────────────────────────────────────────────────────┘
```

### Flow Breakdown:
1. **Bounty Creation**: Protocol owner deposits ETH into `BountyEscrow.sol` specifying the vulnerability category, target repo, and reward.
2. **Exploit Submission**: Researcher packages their Proof-of-Exploit script into a Docker container and submits the image tag + payout wallet address.
3. **Sandboxed Verification**: GitHub Actions spins up an isolated bridge network, boots the vulnerable target app, and runs the exploit container against it.
4. **Flag Matching**: The CI pipeline inspects exploit output for cryptographic proof/flag match (`flag{sql_injection_success}`).
5. **Autonomous Payout**: The CI Oracle script signs and broadcasts `resolveBounty(id, researcher)` to release the locked ETH directly to the researcher.

---

## Repository Structure

```tree
defi-bounty-escrow/
├── contracts/                  # Solidity smart contracts
│   └── BountyEscrow.sol        # On-chain escrow contract on Sepolia
├── frontend/                   # React + Vite + Tailwind frontend application
│   ├── src/
│   │   ├── App.jsx             # Main interactive dashboard & terminal UI
│   │   ├── api.js              # REST API client bridge to backend
│   │   ├── constants.js        # Contract ABI & deployed Sepolia address
│   │   └── index.css           # Glowing cyber-security theme styles
│   ├── vercel.json             # SPA routing rewrite configuration for Vercel
│   └── vite.config.js          # Vite configuration with /api dev proxy
├── backend/                    # Express.js REST API
│   ├── controllers/            # Bounty and Submission route handlers
│   ├── routes/                 # Express API routing definitions
│   ├── store.js                # High-performance in-memory data store for MVP
│   └── server.js               # Express server entry point
├── vulnerable-app/             # Example vulnerable target application
│   ├── app.py                  # Flask web app with SQL Injection vulnerability
│   ├── init_db.py              # SQLite seed database containing hidden flag
│   └── Dockerfile              # Container definition for CI testbed
├── exploit-poe/                # Researcher Proof-of-Exploit payload
│   ├── exploit.py              # Automated SQL injection exploit script
│   └── Dockerfile              # Container definition for researcher payload
├── verification/               # Oracle verification & payout trigger
│   └── verify_and_payout.py    # Python + Web3.py script that broadcasts payout tx
└── .github/workflows/          # CI/CD automation
    └── bounty-ci.yml           # GitHub Actions workflow for end-to-end PoE testing
```

---

## Live Deployments

- **Frontend App**: Hosted on **Vercel**
- **Backend API**: Hosted on **Render**
- **Smart Contract (Sepolia Testnet)**: [`0xF1d74CC50C1Fd533438FFADa8981E221C17d2531`](https://sepolia.etherscan.io/address/0xF1d74CC50C1Fd533438FFADa8981E221C17d2531)

---

## Local Quickstart

### Prerequisites
- **Node.js**: v18+ ([Download](https://nodejs.org/))
- **npm**: v9+
- **Git**

### 1. Clone the Repository
```bash
git clone https://github.com/Mukul312004/defi-bounty-escrow.git
cd defi-bounty-escrow
```

### 2. Start the Backend API
```bash
cd backend
npm install
npm start
```
The backend will launch at **`http://localhost:5000`**.

### 3. Start the Frontend Application
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## How to Test the App

### Mode 1: Local Sandbox Mode (Zero Wallet / Gas Required)
1. Open the frontend at `http://localhost:5173`.
2. Leave wallet disconnected to operate in **Local Sandbox Mode**.
3. Create a bounty with reward amount, title, and description.
4. Select the bounty from the **Escrow Bounty Database** list.
5. In the **Submit PoE** section, click **"Trigger Automated Verification"**.
6. Watch the **live CI Runner Terminal** simulate the container startup, exploit execution, flag extraction, and automated escrow payout in real time!

### Mode 2: Web3 Mode (Sepolia Testnet)
1. Click **"Connect Wallet"** in the header and switch to **Sepolia Testnet**.
2. Create an on-chain bounty — MetaMask will prompt you to deposit testnet ETH.
3. Once confirmed, the bounty is locked in the `BountyEscrow` smart contract.
4. Submit a Docker Proof-of-Exploit image tag and your payout wallet address.
5. The backend dispatches the GitHub Actions pipeline, which tests the exploit and signs the `resolveBounty()` transaction to pay your wallet automatically.

---

## Smart Contract Reference

### `BountyEscrow.sol`
Deployed on **Ethereum Sepolia**: `0xF1d74CC50C1Fd533438FFADa8981E221C17d2531`

```solidity
function createBounty() external payable;
function resolveBounty(uint256 _bountyId, address payable _researcher) external onlyOracle;
function bounties(uint256) view returns (address creator, uint256 amount, bool isActive);
function bountyCounter() view returns (uint256);
```

---

## Security Considerations

- **Reentrancy Protection**: State updates in `resolveBounty` occur before the external ETH transfer (`Checks-Effects-Interactions` pattern).
- **Oracle Isolation**: Only the designated Oracle address (authenticated GitHub Actions runner) has permissions to invoke `resolveBounty`.
- **Sandboxed Execution**: Researcher exploit payloads run inside unprivileged, ephemeral Docker containers on an isolated bridge network with zero host filesystem access.

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
