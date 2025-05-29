import mongoose, { Schema, Document } from 'mongoose';

export interface Feedback {
  voter_id: string;
  election_id: string;
  receipt: string;
  rating: number; // 1-5 rating
  comments: string;
  created_at: Date;
}

export interface FeedbackDocument extends Document, Feedback {}

// Schema for voter feedback
const FeedbackSchema = new Schema({
  voter_id: { type: String, required: true },
  election_id: { type: String, required: true },
  receipt: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 }, 
  comments: { type: String },
  created_at: { type: Date, default: Date.now }
});

// Create indexes for better query performance
FeedbackSchema.index({ voter_id: 1, election_id: 1 });
FeedbackSchema.index({ election_id: 1 });
FeedbackSchema.index({ receipt: 1 }, { unique: true });

// Export model
export const FeedbackModel = mongoose.model<FeedbackDocument>('Feedback', FeedbackSchema);
