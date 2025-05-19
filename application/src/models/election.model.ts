import mongoose, { Schema, Document } from 'mongoose';

// Enums for reusable constants
export type ElectionStatus = 'active' | 'inactive' | 'completed';

// Candidate model
export interface Candidate {
  candidate_id: string;
  name: string;
  party: string;
  profile_image?: string;
}

// Election model - single model for both blockchain and API
export interface Election {
  election_id: string;
  name: string;
  description: string;
  candidates: Candidate[];
  start_time: string;
  end_time: string;
  status: ElectionStatus;
  eligible_governorates: string[];
  last_tally_time?: string;
}

// Request/Response models - simplified
export interface CreateElectionRequest {
  name: string;
  description: string; 
  candidates: Omit<Candidate, 'candidate_id'>[];
  start_time: string;
  end_time: string;
  eligible_governorates: string[];
}

export interface CreateElectionResponse {
  status: string;
  message: string;
  election_id: string;
}

export type GetElectionResponse = Election;

export interface GetAllElectionsResponse {
  elections: Election[];
}

// We only keep user-related data and vote tracking in MongoDB
export interface VoteDocument extends Document, Vote {
}


export interface Vote {
  vote_id: string;
  voter_id: string;
  election_id: string;
  candidate_id: string;
  receipt: string;
  timestamp: Date;
}

export interface VoteResponse {
  status: string;
  message: string;
  vote_id: string;
}

export interface VoteTally {
  id: string;
  user_id: string;
  election_id: string;
  tallies: Record<string, number>;
  created_at: Date;
  is_final: boolean;
}

// Schema only for votes - users will be stored in MongoDB
const VoteSchema = new Schema({
  vote_id: { type: String, required: true, unique: true },
  voter_id: { type: String, required: true },
  election_id: { type: String, required: true },
  candidate_id: { type: String, required: true },
  receipt: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  created_at: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at' } });

// Create indexes for better query performance
VoteSchema.index({ election_id: 1, candidate_id: 1 });
VoteSchema.index({ voter_id: 1 });

// Only keep the Vote model for MongoDB
export const VoteModel = mongoose.model<VoteDocument>('Vote', VoteSchema);
