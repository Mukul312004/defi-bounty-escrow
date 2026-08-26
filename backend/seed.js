import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Bounty from './models/Bounty.js';

dotenv.config();

const SEED_BOUNTIES = [
  {
    onChainId: 1,
    title: "SQL Injection Flag Extraction",
    description: "Extract the value stored in the secrets table via the /search endpoint.",
    category: "SQL Injection",
    repo: "github.com/Mukul312004/defi-bounty-escrow",
    amount: "0.25",
    creator: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    isActive: true
  },
  {
    onChainId: 2,
    title: "Reentrancy Vault Drain",
    description: "Drain locked funds in the Vault contract during deposit/withdraw callbacks.",
    category: "Reentrancy",
    repo: "github.com/defi-escrow/ether-vault",
    amount: "1.50",
    creator: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    isActive: true
  },
  {
    onChainId: 3,
    title: "Signature Malleability Bypass",
    description: "Bypass signature verification by submitting a malformed EC signature.",
    category: "Cryptography",
    repo: "github.com/defi-escrow/ecdsa-auth",
    amount: "0.75",
    creator: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    isActive: false
  }
];

const seedDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/aegis-escrow';
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    // Clear existing bounties
    const deleted = await Bounty.deleteMany({});
    console.log(`🗑️  Cleared ${deleted.deletedCount} existing bounties`);

    // Insert seed data
    const created = await Bounty.insertMany(SEED_BOUNTIES);
    console.log(`🌱 Seeded ${created.length} bounties:`);
    created.forEach(b => {
      console.log(`   • [${b._id}] ${b.title} — ${b.amount} ETH (${b.isActive ? 'Active' : 'Resolved'})`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Database seeded successfully! You can now start the server.');
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
};

seedDB();
