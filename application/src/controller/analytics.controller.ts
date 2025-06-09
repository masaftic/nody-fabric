import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { logger } from '../logger';
import { AgeGroups, AgeGroupCounts, ElectionAnalyticsModel } from '../models/analytics.model';
import { VoteModel } from '../models/election.model';
import { withFabricConnection } from '../fabric-utils/fabric';
import { BlockChainRepository } from '../fabric-utils/BlockChainRepository';
import User from '../models/user.model';
import { FeedbackModel } from '../models/feedback.model';

// Cache for analytics
interface CacheEntry {
  data: any;
  timestamp: Date;
}

const analyticsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get detailed analytics for an election
 * @param req Request with election ID param
 * @param res Response
 */
export async function getElectionAnalytics(req: Request, res: Response): Promise<void> {
  const { electionId } = req.params;
  const forceRefresh = req.query.refresh === 'true';

  if (!electionId) {
    res.status(StatusCodes.BAD_REQUEST).json({ message: 'Election ID is required' });
    return;
  }

  try {
    const userId = req.user?.user_id;
    if (!userId) {
      res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Authentication required' });
      return;
    }

    // Check cache first if not forcing refresh
    if (!forceRefresh && analyticsCache.has(electionId)) {
      const cacheEntry = analyticsCache.get(electionId)!;
      const now = new Date();
      // If cache is still valid, return it
      if (now.getTime() - cacheEntry.timestamp.getTime() < CACHE_TTL_MS) {
        logger.debug(`Returning cached analytics for election ${electionId}`);
        res.status(StatusCodes.OK).json(cacheEntry.data);
        return;
      } else {
        // Cache expired, remove it
        analyticsCache.delete(electionId);
      }
    }

    // Get election details
    const election = await withFabricConnection(userId, async (contract) => {
      const blockchainRepo = new BlockChainRepository(contract);
      return await blockchainRepo.getElection(electionId);
    });

    if (!election) {
      res.status(StatusCodes.NOT_FOUND).json({ message: 'Election not found' });
      return;
    }

    // Calculate analytics on-demand
    const analytics = await calculateElectionAnalytics(electionId, election);

    // Cache the response
    analyticsCache.set(electionId, {
      data: analytics,
      timestamp: new Date()
    });

    res.status(StatusCodes.OK).json(analytics);
  } catch (error) {
    logger.error(`Error retrieving election analytics: ${error instanceof Error ? error.message : String(error)}`);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: `Error retrieving election analytics: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

/**
 * Calculates analytics for an election on demand
 * @param electionId Election ID
 * @param election Election object with candidate information
 */
async function calculateElectionAnalytics(electionId: string, election: any): Promise<any> {
  logger.info(`Calculating analytics for election ${electionId}`);

  // Get all votes for this election
  const votes = await VoteModel.find({ election_id: electionId });
  if (votes.length === 0) {
    // Return empty analytics if no votes
    return createEmptyAnalytics(electionId, election);
  }

  // Initialize structures
  const candidateVoteCounts: Record<string, number> = {};
  const ageGroupCounts: AgeGroupCounts = {
    '0-17': 0,
    '18-24': 0,
    '25-34': 0,
    '35-44': 0,
    '45-54': 0,
    '55+': 0
  };
  const locationCounts: Record<string, number> = {};
  const feedbackCounts = {
    positive: 0,
    neutral: 0,
    negative: 0
  };

  // Initialize candidate votes counts
  election.candidates.forEach((candidate: any) => {
    candidateVoteCounts[candidate.candidate_id] = 0;
  });

  // Process each vote
  for (const vote of votes) {
    // Count candidate votes
    if (candidateVoteCounts[vote.candidate_id] !== undefined) {
      candidateVoteCounts[vote.candidate_id]++;
    }

    // Get voter information for demographics
    const voter = await User.findOne({ userId: vote.voter_id });
    if (voter) {
      // Age group
      let ageGroup: AgeGroups = '25-34'; // Default
      if (voter.age) {
        if (voter.age < 18) ageGroup = "0-17";
        else if (voter.age <= 24) ageGroup = "18-24";
        else if (voter.age <= 34) ageGroup = "25-34";
        else if (voter.age <= 44) ageGroup = "35-44";
        else if (voter.age <= 54) ageGroup = "45-54";
        else ageGroup = "55+";
      }
      ageGroupCounts[ageGroup]++;

      // Location
      if (voter.governorate) {
        locationCounts[voter.governorate] = (locationCounts[voter.governorate] || 0) + 1;
      }
    }

    // Process feedback if available
    const feedback = await FeedbackModel.findOne({ receipt: vote.receipt });
    if (feedback) {
      if (feedback.rating >= 4) feedbackCounts.positive++;
      else if (feedback.rating >= 3) feedbackCounts.neutral++;
      else feedbackCounts.negative++;
    }
  }

  // Calculate total votes and percentages
  const totalVotes = votes.length;
  const candidateVotesWithNames = election.candidates.map((candidate: any) => {
    const votes = candidateVoteCounts[candidate.candidate_id] || 0;
    const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
    return {
      candidate_id: candidate.candidate_id,
      name: candidate.name,
      votes,
      percentage: Number(percentage.toFixed(1))
    };
  });

  // Save the calculated analytics to the database for future reference
  await saveAnalyticsToDB(electionId, totalVotes, candidateVotesWithNames, 
    ageGroupCounts, locationCounts, feedbackCounts);

  // Return the response
  return {
    election_id: electionId,
    total_votes: totalVotes,
    candidate_votes: candidateVotesWithNames,
    voter_demographics: {
      age_groups: ageGroupCounts
    },
    voter_locations: locationCounts,
    voter_feedback: feedbackCounts,
    last_updated: new Date()
  };
}

/**
 * Creates empty analytics for an election with no votes
 */
function createEmptyAnalytics(electionId: string, election: any): any {
  const candidateVotes = election.candidates.map((candidate: any) => ({
    candidate_id: candidate.candidate_id,
    name: candidate.name,
    votes: 0,
    percentage: 0
  }));

  return {
    election_id: electionId,
    total_votes: 0,
    candidate_votes: candidateVotes,
    voter_demographics: {
      age_groups: {
        '0-17': 0,
        '18-24': 0,
        '25-34': 0,
        '35-44': 0,
        '45-54': 0,
        '55+': 0
      }
    },
    voter_locations: {},
    voter_feedback: {
      positive: 0,
      neutral: 0,
      negative: 0
    },
    last_updated: new Date()
  };
}

/**
 * Saves or updates analytics in the database
 */
async function saveAnalyticsToDB(
  electionId: string,
  totalVotes: number,
  candidateVotes: any[],
  ageGroupCounts: AgeGroupCounts,
  locationCounts: Record<string, number>,
  feedbackCounts: { positive: number, neutral: number, negative: number }
): Promise<void> {
  try {
    await ElectionAnalyticsModel.findOneAndUpdate(
      { election_id: electionId },
      {
        total_votes: totalVotes,
        candidate_votes: candidateVotes,
        voter_demographics: { age_groups: ageGroupCounts },
        voter_locations: locationCounts,
        voter_feedback: feedbackCounts,
        last_updated: new Date()
      },
      { upsert: true, new: true }
    );
    logger.debug(`Saved analytics for election ${electionId} to database`);
  } catch (error) {
    logger.error(`Error saving analytics to database: ${error instanceof Error ? error.message : String(error)}`);
  }
}
