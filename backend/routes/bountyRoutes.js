import express from 'express';
import { getBounties, getBountyById, createBounty, updateBounty } from '../controllers/bountyController.js';

const router = express.Router();

router.get('/', getBounties);
router.get('/:id', getBountyById);
router.post('/', createBounty);
router.patch('/:id', updateBounty);

export default router;
