import mongoose from 'mongoose';

const bountySchema = new mongoose.Schema({
  onChainId: { type: Number },
  title: { type: String, required: true },
  description: { type: String },
  category: { 
    type: String, 
    enum: ['SQL Injection', 'Reentrancy', 'Cryptography', 'Arithmetic Error', 'Other'] 
  },
  repo: { type: String },
  amount: { type: String, required: true },
  creator: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  txHash: { type: String }
}, { timestamps: true });

const Bounty = mongoose.model('Bounty', bountySchema);
export default Bounty;
