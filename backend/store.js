import crypto from 'crypto';

// ── In-Memory Data Store ──────────────────────────────────────────
// Pre-seeded with demo bounties. Data resets on server restart.

const generateId = () => crypto.randomUUID().slice(0, 24);

const bounties = [
  {
    _id: generateId(),
    onChainId: 1,
    title: "SQL Injection Flag Extraction",
    description: "Extract the value stored in the secrets table via the /search endpoint.",
    category: "SQL Injection",
    repo: "github.com/Mukul312004/defi-bounty-escrow",
    amount: "0.25",
    creator: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    isActive: true,
    txHash: null,
    createdAt: new Date().toISOString()
  },
  {
    _id: generateId(),
    onChainId: 2,
    title: "Reentrancy Vault Drain",
    description: "Drain locked funds in the Vault contract during deposit/withdraw callbacks.",
    category: "Reentrancy",
    repo: "github.com/defi-escrow/ether-vault",
    amount: "1.50",
    creator: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    isActive: true,
    txHash: null,
    createdAt: new Date().toISOString()
  },
  {
    _id: generateId(),
    onChainId: 3,
    title: "Signature Malleability Bypass",
    description: "Bypass signature verification by submitting a malformed EC signature.",
    category: "Cryptography",
    repo: "github.com/defi-escrow/ecdsa-auth",
    amount: "0.75",
    creator: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    isActive: false,
    txHash: null,
    createdAt: new Date().toISOString()
  }
];

const submissions = [];

// ── Bounty Helpers ────────────────────────────────────────────────

export function getAllBounties() {
  return [...bounties].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getBountyById(id) {
  return bounties.find(b => b._id === id) || null;
}

export function createBounty(data) {
  const bounty = {
    _id: generateId(),
    onChainId: data.onChainId ?? null,
    title: data.title,
    description: data.description || '',
    category: data.category || 'Other',
    repo: data.repo || '',
    amount: data.amount,
    creator: data.creator,
    isActive: true,
    txHash: data.txHash || null,
    createdAt: new Date().toISOString()
  };
  bounties.unshift(bounty);
  return bounty;
}

export function updateBounty(id, updates) {
  const index = bounties.findIndex(b => b._id === id);
  if (index === -1) return null;
  bounties[index] = { ...bounties[index], ...updates };
  return bounties[index];
}

// ── Submission Helpers ────────────────────────────────────────────

export function getAllSubmissions() {
  return [...submissions]
    .map(s => ({
      ...s,
      bounty: getBountyById(s.bountyId) || { _id: s.bountyId }
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getSubmissionById(id) {
  const sub = submissions.find(s => s._id === id) || null;
  if (sub) {
    sub.bounty = getBountyById(sub.bountyId) || { _id: sub.bountyId };
  }
  return sub;
}

export function createSubmission(data) {
  const submission = {
    _id: generateId(),
    bountyId: data.bountyId,
    researcher: data.researcher,
    poeImage: data.poeImage,
    status: 'pending',
    githubRunId: null,
    githubRunUrl: null,
    payoutTxHash: null,
    createdAt: new Date().toISOString()
  };
  submissions.push(submission);
  return { ...submission, bounty: getBountyById(data.bountyId) };
}

export function updateSubmission(id, updates) {
  const index = submissions.findIndex(s => s._id === id);
  if (index === -1) return null;
  submissions[index] = { ...submissions[index], ...updates };
  return submissions[index];
}
