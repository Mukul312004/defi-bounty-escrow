import express from 'express';
import { getSubmissions, getSubmissionById, createSubmission, pollSubmissionStatus } from '../controllers/submissionController.js';

const router = express.Router();

router.get('/', getSubmissions);
router.get('/:id', getSubmissionById);
router.post('/', createSubmission);
router.get('/:id/status', pollSubmissionStatus);

export default router;
