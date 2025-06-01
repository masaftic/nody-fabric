import mongoose, { Schema, Document } from 'mongoose';

// Enums for reusable constants

export const Governorates = [
  "القاهرة",
  "الجيزة",
  "الإسكندرية",
  "الدقهلية",
  "البحر الأحمر",
  "البحيرة",
  "الفيوم",
  "الغربية",
  "الإسماعيلية",
  "المنوفية",
  "المنيا",
  "القليوبية",
  "الوادي الجديد",
  "السويس",
  "أسوان",
  "أسيوط",
  "بني سويف",
  "بورسعيد",
  "دمياط",
  "الشرقية",
  "جنوب سيناء",
  "كفر الشيخ",
  "مطروح",
  "الأقصر",
  "قنا",
  "شمال سيناء",
  "سوهاج",
] as const;

export type Governorate = (typeof Governorates)[number];

export enum ElectionStatus {
  Scheduled = 'scheduled',
  Live = 'live',
  Ended = 'ended',
  Published = 'published',
  Cancelled = 'cancelled',
}

// Candidate model
export interface Candidate {
  candidate_id: string;
  name: string;
  party: string;
  profile_image: string;
  description: string;
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
  eligible_governorates: Governorate[];
  election_image: string; // URL to election image
}

// Request/Response models - simplified
export interface CreateElectionRequest {
  name: string;
  description: string; 
  candidates: Omit<Candidate, 'candidate_id'>[];
  start_time: string;
  end_time: string;
  eligible_governorates: Governorate[];
  election_image: string; // URL
}

export interface CreateElectionResponse {
  status: string;
  message: string;
  election_id: string;
}

export type GetElectionResponse = Election;

export type GetAllElectionsResponse = Election[];

// We only keep user-related data and vote tracking in MongoDB
export interface VoteDocument extends Document, Vote {
}


export interface Vote {
  vote_id: string;
  voter_id: string;
  election_id: string;
  candidate_id: string;
  receipt: string;
  created_at: Date;
}

export interface VoteResponse {
  status: string;
  message: string;
  vote_id: string;
}

// Updated VoteTally interface for real-time vote tracking
export interface VoteTally {
  election_id: string;
  tallies: Map<string, number>;
  total_votes: number;
  last_updated: Date;
}

// Original blockchain VoteTally (renamed to avoid conflicts)
export interface BlockchainVoteTally {
  id: string;
  user_id: string; // user who invoked to compute the tally
  election_id: string;
  tallies: Map<string, number>;
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
});

// Create indexes for better query performance
VoteSchema.index({ election_id: 1, candidate_id: 1 });
VoteSchema.index({ voter_id: 1 });

// Only keep the Vote model for MongoDB
export const VoteModel = mongoose.model<VoteDocument>('Vote', VoteSchema);

// Schema for vote tallies
const VoteTallySchema = new Schema({
  election_id: { type: String, required: true, unique: true },
  tallies: { type: Map, of: Number, default: {} },
  total_votes: { type: Number, default: 0 },
  last_updated: { type: Date, default: Date.now }
});

// Create indexes for better query performance
VoteTallySchema.index({ election_id: 1 });

// Vote tally model for MongoDB
export const VoteTallyModel = mongoose.model<Document & VoteTally>('VoteTally', VoteTallySchema);
