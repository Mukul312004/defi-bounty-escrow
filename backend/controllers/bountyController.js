import { getAllBounties, getBountyById as findBountyById, createBounty as addBounty, updateBounty as modifyBounty } from '../store.js';

export const getBounties = async (req, res, next) => {
  try {
    const bounties = getAllBounties();
    res.status(200).json(bounties);
  } catch (error) {
    next(error);
  }
};

export const getBountyById = async (req, res, next) => {
  try {
    const bounty = findBountyById(req.params.id);
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
    const bounty = addBounty({
      title, description, category, repo, amount, creator, txHash, onChainId
    });
    res.status(201).json(bounty);
  } catch (error) {
    next(error);
  }
};

export const updateBounty = async (req, res, next) => {
  try {
    const bounty = modifyBounty(req.params.id, req.body);
    if (!bounty) {
      return res.status(404).json({ success: false, message: 'Bounty not found' });
    }
    res.status(200).json(bounty);
  } catch (error) {
    next(error);
  }
};
