import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema({
  bounty: { type: mongoose.Schema.Types.ObjectId, ref: 'Bounty', required: true },
  researcher: { type: String, required: true },
  poeImage: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'running', 'success', 'failed'], 
    default: 'pending' 
  },
  githubRunId: { type: Number },
  githubRunUrl: { type: String },
  payoutTxHash: { type: String }
}, { timestamps: true });

const Submission = mongoose.model('Submission', submissionSchema);
export default Submission;
