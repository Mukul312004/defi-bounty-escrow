import Submission from '../models/Submission.js';
import Bounty from '../models/Bounty.js';
import fetch from 'node-fetch';

export const getSubmissions = async (req, res, next) => {
  try {
    const submissions = await Submission.find().populate('bounty').sort({ createdAt: -1 });
    res.status(200).json(submissions);
  } catch (error) {
    next(error);
  }
};

export const getSubmissionById = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id).populate('bounty');
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }
    res.status(200).json(submission);
  } catch (error) {
    next(error);
  }
};

export const createSubmission = async (req, res, next) => {
  try {
    const { bountyId, researcher, poeImage } = req.body;
    
    const bounty = await Bounty.findById(bountyId);
    if (!bounty) {
      return res.status(404).json({ success: false, message: 'Bounty not found' });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    const githubResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/bounty-ci.yml/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          bounty_id: bounty.onChainId != null ? bounty.onChainId.toString() : "",
          researcher_address: researcher
        }
      })
    });

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text();
      throw new Error(`GitHub API error: ${githubResponse.status} ${errorText}`);
    }

    const submission = await Submission.create({
      bounty: bountyId,
      researcher,
      poeImage,
      status: 'pending'
    });

    res.status(201).json(submission);
  } catch (error) {
    next(error);
  }
};

export const pollSubmissionStatus = async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    // If we don't have a run ID yet, search recent workflow runs to find it
    if (!submission.githubRunId) {
      try {
        const runsResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/actions/runs?event=workflow_dispatch&per_page=5`,
          {
            headers: {
              'Authorization': `Bearer ${githubToken}`,
              'Accept': 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28'
            }
          }
        );

        if (runsResponse.ok) {
          const runsData = await runsResponse.json();
          const latestRun = runsData.workflow_runs?.[0];

          if (latestRun) {
            const runTime = new Date(latestRun.created_at).getTime();
            const submissionTime = new Date(submission.createdAt).getTime();

            // Match if the run was created within 60 seconds of our submission
            if (Math.abs(runTime - submissionTime) < 60000) {
              submission.githubRunId = latestRun.id;
              submission.githubRunUrl = latestRun.html_url;
              submission.status = 'running';
              await submission.save();
            }
          }
        }
      } catch (discoverErr) {
        console.error('Error discovering GitHub run ID:', discoverErr);
      }

      return res.status(200).json(submission);
    }

    // We have a run ID — fetch its current status
    const runResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${submission.githubRunId}`,
      {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    if (runResponse.ok) {
      const runData = await runResponse.json();

      if (runData.status === 'completed') {
        submission.status = runData.conclusion === 'success' ? 'success' : 'failed';
      } else {
        submission.status = 'running';
      }
      submission.githubRunUrl = runData.html_url;
      await submission.save();
    }

    res.status(200).json(submission);
  } catch (error) {
    next(error);
  }
};
