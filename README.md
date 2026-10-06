# Automated Bug Bounty Escrow Platform

A full-stack bug bounty escrow platform that combines Web3 smart contracts with automated, sandboxed exploit verification.

The platform allows protocol owners to lock bounty rewards in an Ethereum smart contract. Security researchers can submit containerized Proof-of-Exploit (PoE) payloads, which are automatically executed against a vulnerable target inside an isolated Docker environment. If the exploit is successfully verified, the CI/CD oracle triggers the smart contract to release the bounty to the researcher's wallet.

##  Key Features

-  Smart-contract-based bounty escrow
-  Sandboxed Proof-of-Exploit execution using Docker
-  Automated exploit verification with GitHub Actions
-  Automatic on-chain bounty payouts
-  MetaMask + Ethereum Sepolia integration
-  React-based dashboard
-  Express.js REST API
-  Isolated exploit execution environment
-  Smart-contract reentrancy protection
-  Local Sandbox Mode for testing without a wallet

##  Architecture

```text
                    ┌─────────────────────┐
                    │   Protocol Owner    │
                    │                     │
                    │   Create Bounty     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  BountyEscrow.sol   │
                    │  Ethereum Sepolia   │
                    └──────────┬──────────┘
                               │
                               │ Bounty Locked
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Security Researcher │
                    │                     │
                    │ Submit PoE + Wallet │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    GitHub Actions   │
                    │      CI/CD Oracle   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │    Docker Sandbox   │
                    │                     │
                    │ ┌─────────────────┐ │
                    │ │ Vulnerable App  │ │
                    │ └────────┬────────┘ │
                    │          │          │
                    │ ┌────────▼────────┐ │
                    │ │ PoE Exploit     │ │
                    │ │ Container       │ │
                    │ └────────┬────────┘ │
                    └──────────┼──────────┘
                               │
                        Exploit Verified
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Verification       │
                    │  Oracle             │
                    └──────────┬──────────┘
                               │
                         resolveBounty()
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Researcher Wallet   │
                    │   Bounty Paid       │
                    └─────────────────────┘
```

## How It Works
1. Create a Bounty
A protocol owner creates a bounty and deposits testnet ETH into the BountyEscrow smart contract.
2. Submit a Proof-of-Exploit
A security researcher submits:
- Docker image containing the exploit
- Researcher's payout wallet
- Bounty details
3. Automated Verification
GitHub Actions starts the verification workflow and creates an isolated Docker environment containing:
- The vulnerable target application
- The submitted exploit container
The exploit is executed against the target application.
4. Verify the Exploit
The verification process checks the exploit output for the expected proof/flag.
For the included demonstration, the vulnerable application contains a SQL injection vulnerability and the verification process checks for the expected success flag.
5. Release the Bounty
If verification succeeds, the verification script calls:
resolveBounty(bountyId, researcher)

The smart contract then releases the locked bounty to the researcher's wallet.

## Tech Stack
### Frontend
- React.js
- Vite
- Tailwind CSS
- Ethers.js
### Backend
- Node.js
- Express.js
- REST APIs
### Web3
- Solidity
- Ethereum
- Sepolia Testnet
- Ethers.js
- MetaMask
### Security & Automation
- Docker
- GitHub Actions
- Python
- Web3.py
### Development
- Git
- GitHub
- npm

## Project Structure
```
defi-bounty-escrow/
│
├── contracts/
│   └── BountyEscrow.sol
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── constants.js
│   │   └── index.css
│   ├── vercel.json
│   └── vite.config.js
│
├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── store.js
│   └── server.js
│
├── vulnerable-app/
│   ├── app.py
│   ├── init_db.py
│   └── Dockerfile
│
├── exploit-poe/
│   ├── exploit.py
│   └── Dockerfile
│
├── verification/
│   └── verify_and_payout.py
│
├── .github/
│   └── workflows/
│       └── bounty-ci.yml
│
└── DESIGN.md
```

## Local Setup

Prerequisites
- Node.js 18+
- npm 9+
- Git
- Docker

1. Clone the repository
```code
git clone https://github.com/Mukul312004/defi-bounty-escrow.git
cd defi-bounty-escrow
```

2. Start the backend
```code
cd backend
npm install
npm start
```

The backend runs on:
http://localhost:5000

3. Start the frontend
Open another terminal:
```code
cd frontend
npm install
npm run dev
```

Open:
http://localhost:5173

##Testing
The application supports two testing modes.
Local Sandbox Mode
Local Sandbox Mode allows the application workflow to be tested without connecting a wallet or spending gas.
1. Open the frontend.
2. Keep the wallet disconnected.
3. Create a bounty.
4. Select the bounty.
5. Trigger automated verification.
6. Observe the simulated verification workflow.

###Web3 Mode
The Web3 workflow uses the Ethereum Sepolia testnet.
1. Connect MetaMask.
2. Switch to Sepolia.
3. Create an on-chain bounty.
4. Deposit testnet ETH.
5. Submit the Proof-of-Exploit details.
6. Trigger the verification workflow.
7. GitHub Actions verifies the exploit.
8. The oracle calls resolveBounty().
9. The bounty is released to the researcher's wallet.

## Smart Contract
The BountyEscrow.sol contract is deployed on Ethereum Sepolia.
Main functions
```code
function createBounty() external payable;

function resolveBounty(
    uint256 _bountyId,
    address payable _researcher
) external onlyOracle;
```

The contract stores bounty information and controls the release of escrowed funds.

## Security Considerations
Reentrancy Protection
The payout logic follows the Checks-Effects-Interactions pattern, updating bounty state before transferring ETH.
Oracle Authorization
Only the designated oracle address can call resolveBounty().
Sandboxed Exploit Execution
Proof-of-Exploit payloads are executed inside isolated Docker containers rather than directly on the host environment.

## Deployment
- Frontend: Vercel
- Backend: Render
- Smart Contract: Ethereum Sepolia Testnet
Contract Address
0xF1d74CC50C1Fd533438FFADa8981E221C17d2531

## Project Status
This project is an MVP/prototype demonstrating automated bug bounty verification and escrow-based payouts.

## License
This project is licensed under the MIT License.
