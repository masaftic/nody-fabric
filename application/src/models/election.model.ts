import mongoose, { Schema, Document } from 'mongoose';

// Blockchain-focused models (essential data)
export interface BlockchainCandidate {
  candidate_id: string;
}

export interface BlockchainElection {
  election_id: string;
  name: string;
  candidate_ids: string[];
  start_time: string;
  end_time: string;
  status: 'active' | 'inactive' | 'completed';
  eligible_governorates: string[];
  last_tally_time?: string;
}

// MongoDB-focused models (detailed data)
export interface Candidate {
  candidate_id: string;
  name: string;
  party: string;
  profile_image?: string;
  // bio?: string; // Additional details not in blockchain
  // campaign_promises?: string[]; // Additional details not in blockchain
}

export interface Election {
  election_id: string;
  name: string;
  description: string;
  candidates: Candidate[];
  start_time: string;
  end_time: string;
  status: 'active' | 'inactive' | 'completed';
  eligible_governorates: string[];
  last_tally_time?: string; // Synced from blockchain
  created_by?: string; // Additional MongoDB-only fields
  featured_image?: string; // Additional MongoDB-only fields
}

export interface ElectionMetaData {
  election_id: string;
  description: string;
  candidates: Candidate[];
}

export interface Vote {
  vote_id: string;
  voter_id: string;
  election_id: string;
  candidate_id: string;
  receipt: string;
  timestamp: string;
}

export interface VoterDemographics {
  age_groups: Record<string, number>;
}

export interface VoterLocations {
  [location: string]: number;
}

export interface VoterTurnout {
  total_registered: number;
  total_voted: number;
  turnout_rate: number;
}

export interface VoterFeedback {
  positive: number;
  neutral: number;
  negative: number;
}

export interface ElectionAnalytics {
  election_id: string;
  total_votes: number;
  candidate_votes: {
    candidate_id: string;
    votes: number;
  }[];
  voter_demographics: VoterDemographics;
  voter_locations: VoterLocations;
  voter_turnout: VoterTurnout;
  voter_feedback: VoterFeedback;
}

// Request/Response models
export interface CreateElectionRequest {
  name: string;
  description: string;
  candidates: {
    name: string;
    party: string;
    profile_image?: string;
  }[];
  start_time: string;
  end_time: string;
  eligible_governorates: string[];
}

export interface CreateBlockchainElectionRequest {
  election_id: string;
  name: string;
  candidate_ids: string[];
  start_time: string;
  end_time: string;
  eligible_governorates: string[];
}

export interface CreateElectionResponse {
  status: string;
  message: string;
  election_id: string;
}

export interface GetElectionResponse extends Election {}

export interface GetAllElectionsResponse {
  elections: {
    election_id: string;
    name: string;
    description: string;
    start_time: string;
    end_time: string;
    status: string;
  }[];
}

export interface GetElectionAnalyticsResponse extends ElectionAnalytics {}

// Mongoose schema and document interfaces for MongoDB
export interface ElectionDocument extends Document {
  election_id: string;
  name: string;
  description: string;
  candidates: {
    candidate_id: string;
    name: string;
    party: string;
    profile_image?: string;
  }[];
  start_time: Date;
  end_time: Date;
  status: string;
  eligible_governorates: string[];
  vote_tally: Record<string, number>;
  created_at: Date;
  updated_at: Date;
}

export interface VoteDocument extends Document {
  vote_id: string;
  voter_id: string;
  election_id: string;
  candidate_id: string;
  receipt: string;
  timestamp: Date;
  voter_age_group?: string;
  voter_location?: string;
  created_at: Date;
}

export interface AnalyticsDocument extends Document {
  election_id: string;
  total_votes: number;
  candidate_votes: {
    candidate_id: string;
    votes: number;
  }[];
  voter_demographics: {
    age_groups: Record<string, number>;
  };
  voter_locations: Record<string, number>;
  voter_turnout: {
    total_registered: number;
    total_voted: number;
    turnout_rate: number;
  };
  voter_feedback: {
    positive: number;
    neutral: number;
    negative: number;
  };
  last_updated: Date;
}

// Mongoose Schemas
const CandidateSchema = new Schema({
  candidate_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  party: { type: String, required: true },
  profile_image: { type: String }
});

const ElectionSchema = new Schema({
  election_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  candidates: [CandidateSchema],
  start_time: { type: Date, required: true },
  end_time: { type: Date, required: true },
  status: { type: String, enum: ['active', 'inactive', 'completed'], required: true },
  eligible_governorates: [{ type: String }],
  vote_tally: { type: Map, of: Number, default: {} },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const VoteSchema = new Schema({
  vote_id: { type: String, required: true, unique: true },
  voter_id: { type: String, required: true },
  election_id: { type: String, required: true },
  candidate_id: { type: String, required: true },
  receipt: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  voter_age_group: { type: String },
  voter_location: { type: String },
  created_at: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at' } });

const AnalyticsSchema = new Schema({
  election_id: { type: String, required: true, unique: true },
  total_votes: { type: Number, default: 0 },
  candidate_votes: [{
    candidate_id: { type: String, required: true },
    votes: { type: Number, default: 0 }
  }],
  voter_demographics: {
    age_groups: { type: Map, of: Number, default: {} }
  },
  voter_locations: { type: Map, of: Number, default: {} },
  voter_turnout: {
    total_registered: { type: Number, default: 0 },
    total_voted: { type: Number, default: 0 },
    turnout_rate: { type: Number, default: 0 }
  },
  voter_feedback: {
    positive: { type: Number, default: 0 },
    neutral: { type: Number, default: 0 },
    negative: { type: Number, default: 0 }
  },
  last_updated: { type: Date, default: Date.now }
}, { timestamps: { updatedAt: 'last_updated' } });

// Create indexes for better query performance
ElectionSchema.index({ status: 1 });
VoteSchema.index({ election_id: 1, candidate_id: 1 });
VoteSchema.index({ voter_id: 1 });
AnalyticsSchema.index({ election_id: 1 });

// Mongoose models
export const ElectionModel = mongoose.model<ElectionDocument>('Election', ElectionSchema);
export const VoteModel = mongoose.model<VoteDocument>('Vote', VoteSchema);
export const AnalyticsModel = mongoose.model<AnalyticsDocument>('Analytics', AnalyticsSchema);
