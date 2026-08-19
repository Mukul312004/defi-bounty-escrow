import Bounty from '../models/Bounty.js';

export const getBounties = async (req, res, next) => {
  try {
    const bounties = await Bounty.find().sort({ createdAt: -1 });
    res.status(200).json(bounties);
  } catch (error) {
    next(error);
  }
};

export const getBountyById = async (req, res, next) => {
  try {
    const bounty = await Bounty.findById(req.params.id);
    if (!bounty) {
      return res.status(404).json({ success: false, message: 'Bounty not found' });
    }
    res.status(200).json(bounty);
  } catch (error) {
    next(error);
  }
};

export const createBounty = async (req, res, next) => {
  try {
    const { title, description, category, repo, amount, creator, txHash, onChainId } = req.body;
    const bounty = await Bounty.create({
      title, description, category, repo, amount, creator, txHash, onChainId
    });
    res.status(201).json(bounty);
  } catch (error) {
    next(error);
  }
};

export const updateBounty = async (req, res, next) => {
  try {
    const bounty = await Bounty.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!bounty) {
      return res.status(404).json({ success: false, message: 'Bounty not found' });
    }
    res.status(200).json(bounty);
  } catch (error) {
    next(error);
  }
};
