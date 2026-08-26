import { 
  getAllSubmissions, 
  getSubmissionById as findSubmissionById, 
  createSubmission as addSubmission, 
  updateSubmission as modifySubmission,
  getBountyById as findBountyById 
} from '../store.js';
import fetch from 'node-fetch';

export const getSubmissions = async (req, res, next) => {
  try {
    const submissions = getAllSubmissions();
    res.status(200).json(submissions);
  } catch (error) {
    next(error);
  }
};

export const getSubmissionById = async (req, res, next) => {
  try {
    const submission = findSubmissionById(req.params.id);
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
    
    const bounty = findBountyById(bountyId);
    if (!bounty) {
      return res.status(404).json({ success: false, message: 'Bounty not found' });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    let submission = addSubmission({
      bountyId,
      researcher,
      poeImage
    });

    if (githubToken && !githubToken.includes('your_token_here') && owner && repo) {
      try {
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
          console.warn(`GitHub Actions dispatch warning: ${githubResponse.status} ${errorText}`);
        }
      } catch (ghErr) {
        console.warn('GitHub dispatch network error:', ghErr.message);
      }
    } else {
      console.log('ℹ️ GitHub Token not configured or placeholder used. Submission recorded locally.');
    }

    res.status(201).json(submission);
  } catch (error) {
    next(error);
  }
};

export const pollSubmissionStatus = async (req, res, next) => {
  try {
    const submission = findSubmissionById(req.params.id);
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    if (githubToken && !githubToken.includes('your_token_here') && owner && repo) {
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

              if (Math.abs(runTime - submissionTime) < 60000) {
                modifySubmission(submission._id, {
                  githubRunId: latestRun.id,
                  githubRunUrl: latestRun.html_url,
                  status: 'running'
                });
              }
            }
          }
        } catch (discoverErr) {
          console.error('Error discovering GitHub run ID:', discoverErr);
        }
      } else {
        // We have a run ID — fetch its current status
        try {
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
            const updatedStatus = runData.status === 'completed'
              ? (runData.conclusion === 'success' ? 'success' : 'failed')
              : 'running';

            modifySubmission(submission._id, {
              status: updatedStatus,
              githubRunUrl: runData.html_url
            });
          }
        } catch (runErr) {
          console.error('Error fetching run status:', runErr);
        }
      }
    }

    const updated = findSubmissionById(req.params.id);
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};
