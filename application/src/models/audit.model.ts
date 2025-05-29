import mongoose, { Schema, Document } from 'mongoose';
import { Vote } from './election.model';
import crypto from 'crypto';

// Types of events that can be audited
export type EventType = 
  | 'vote_cast' 
  | 'election_created' 
  | 'election_updated' 
  | 'tally_computed' 
  | 'user_registered' 
  | 'user_status_updated';

// Base audit event structure
export interface AuditEvent {
  event_id: string;
  timestamp: string;
  event_type: EventType;
  details: Record<string, any>;
  block_number?: number;
  tx_id?: string;
}

// Schema for audit events
const AuditEventSchema = new Schema({
  event_id: { type: String, required: true, unique: true },
  timestamp: { type: Date, required: true, default: Date.now },
  event_type: { type: String, required: true },
  details: { type: Schema.Types.Mixed, required: true },
  block_number: { type: Number },
  tx_id: { type: String }
});

// Create indexes for better query performance
AuditEventSchema.index({ event_type: 1 });
AuditEventSchema.index({ timestamp: 1 });
AuditEventSchema.index({ 'details.election_id': 1 });
AuditEventSchema.index({ 'details.voter_id': 1 });

// Voter activity response
export interface VoterActivityResponse {
  voter_id: string;
  activity: Array<{
    timestamp: string;
    action: string;
    details: Record<string, any>;
  }>;
}

// Chaincode events response
export interface ChaincodeEventsResponse {
  events: AuditEvent[];
}

// Vote tally response
export interface VoteTallyResponse {
  tally: Array<{
    candidate_id: string;
    votes: number;
  }>;
  total_votes: number;
  timestamp: string;
}

// Vote tally discrepancy response
export interface VoteTallyDiscrepancyResponse {
  discrepancy: string;
  details: {
    election_id: string;
    expected_votes: number;
    actual_votes: number;
  };
  timestamp: string;
}

export const AuditEventModel = mongoose.model<Document & AuditEvent>('AuditEvent', AuditEventSchema);

// Helper method to generate an event ID
export function generateEventId(): string {
  return crypto.randomUUID();
}

// Helper method to create an audit event
export function createAuditEvent(
  eventType: EventType, 
  details: Record<string, any>, 
  blockNumber?: number,
  txId?: string
): AuditEvent {
  return {
    event_id: generateEventId(),
    timestamp: new Date().toISOString(),
    event_type: eventType,
    details,
    block_number: blockNumber,
    tx_id: txId
  };
}
