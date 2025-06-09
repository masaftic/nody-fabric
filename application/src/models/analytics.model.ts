import mongoose, { Schema, Document } from 'mongoose';

export interface AgeGroupCounts {
    '0-17': number;
    '18-24': number;
    '25-34': number;
    '35-44': number;
    '45-54': number;
    '55+': number;
}

export type AgeGroups = keyof AgeGroupCounts;

interface GovernorateCount {
    [governorate: string]: number;
}

interface FeedbackCount {
    positive: number;
    neutral: number;
    negative: number;
}

export interface ElectionAnalytics extends Document {
    election_id: string;
    total_votes: number;
    candidate_votes: {
        candidate_id: string;
        votes: number;
        percentage: number;
    }[];
    voter_demographics: {
        age_groups: AgeGroupCounts;
    };
    voter_locations: GovernorateCount;
    voter_feedback: FeedbackCount;
    last_updated: Date;
}

// Schema for election analytics
const ElectionAnalyticsSchema = new Schema({
    election_id: { 
        type: String, 
        required: true, 
        unique: true,
        index: true
    },
    total_votes: { 
        type: Number, 
        default: 0 
    },
    candidate_votes: [{
        candidate_id: { type: String, required: true },
        votes: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 }
    }],
    voter_demographics: {
        age_groups: {
            '18-24': { type: Number, default: 0 },
            '25-34': { type: Number, default: 0 },
            '35-44': { type: Number, default: 0 },
            '45-54': { type: Number, default: 0 },
            '55+': { type: Number, default: 0 }
        }
    },
    voter_locations: {
        type: Map,
        of: Number,
        default: {}
    },
    voter_feedback: {
        positive: { type: Number, default: 0 },
        neutral: { type: Number, default: 0 },
        negative: { type: Number, default: 0 }
    },
    last_updated: { 
        type: Date, 
        default: Date.now 
    }
});

// Create model
export const ElectionAnalyticsModel = mongoose.model<ElectionAnalytics>('ElectionAnalytics', ElectionAnalyticsSchema);
