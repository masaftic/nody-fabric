import mongoose, { Document, Model, Schema } from "mongoose";
import { UserRole } from "./user.model";

export interface IInvitationCode extends Document {
    code: string;
    role: UserRole;
    isUsed: boolean;
    usedBy?: string; // User ID who used this code
    usedAt?: Date;
    createdAt: Date;
    expiresAt?: Date;
}

// Interface for the InvitationCode Model
export interface InvitationCodeModel extends Model<IInvitationCode> { }

const invitationCodeSchema = new Schema<IInvitationCode, InvitationCodeModel>({
    code: {
        type: String,
        required: [true, "Invitation code is required"],
        unique: true,
        trim: true,
        index: true,
    },
    role: {
        type: String,
        enum: Object.values(UserRole),
        required: [true, "Role is required"],
        trim: true
    },
    isUsed: {
        type: Boolean,
        default: false
    },
    usedBy: {
        type: String,
        sparse: true
    },
    usedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date
    }
});

// Create and export the InvitationCode model
const InvitationCodeModel = mongoose.model<IInvitationCode, InvitationCodeModel>("InvitationCode", invitationCodeSchema);

export default InvitationCodeModel;
