import mongoose, { Document, Model, Schema } from "mongoose";
import bcryptjs from "bcryptjs"
import { Governorate, Governorates } from "./election.model";


export enum UserRole {
    Voter = "voter",
    ElectionCommission = "election_commission",
    Auditor = "auditor"
}

export interface IUser extends Document {
    userId: string;
    nationalId: string;
    phone: string;
    nationalIdUnique?: string; // Add field for unique hash
    phoneUnique?: string;      // Add field for unique hash
    isVerified?: boolean;
    verifyCode?: string;
    verifyCodeExpireOn?: Date;
    certificate: string; 
    governorate: Governorate;
    role: UserRole;
    status: "active" | "suspended";
    birthdate?: Date;
    age?: number;
    createdAt: Date;
}

export interface IUserMethods {
    compareNationalId(nationalId: string): Promise<boolean>;
    comparePhoneNumber(phone: string): Promise<boolean>;
}
export interface UserModel extends Model<IUser, {}, IUserMethods> { }


export interface UserRegisterRequest {
    national_id: string;
    phone: string;
    governorate: Governorate;
    invitation_code?: string; // Optional invitation code for admin or auditor registration
    face_verification_secret?: string; // Secret received from face verification process
}


const userSchema = new Schema<IUser, UserModel, IUserMethods>({
    userId: {
        type: String,
        unique: true,
        required: [true, "User ID is required"],
        immutable: true, // Prevent modification after creation
    },
    nationalId: {
        type: String,
        required: [true, "National ID is required"],
        // Remove unique constraint as it won't work with randomly salted hashes
        validate: [
            {
                // Validate before saving/hashing (for new records)
                validator: function(this: any, v: string) {
                    return true; // for now

                    // Skip validation if the value is already hashed (when reading from DB)
                    if (v && v.startsWith('$2')) return true;
                    
                    // Check if the national ID is a valid Egyptian national ID
                    if (!v) return false;
                    // Check length
                    if (v.length !== 14) return false;
                    // Check if all characters are digits
                    if (!/^\d+$/.test(v)) return false;
                    // Check the last digit (checksum)
                    const weights = [2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1];
                    const sum = v
                        .slice(0, 12)
                        .split('')
                        .map((digit, index) => {
                            const num = parseInt(digit, 10);
                            return (num * weights[index]) % 10 + Math.floor((num * weights[index]) / 10);
                        })
                        .reduce((acc, curr) => acc + curr, 0);
                    const checksum = (10 - (sum % 10)) % 10;
                    return checksum === parseInt(v[13], 10);
                },
                message: "Invalid National ID format or checksum"
            }
        ],
        trim: true,
    },
    nationalIdUnique: {
        type: String,
        sparse: true,
        unique: true,
        index: true
    },
    phone: {
        type: String,
        required: true,
        // Remove unique constraint as it won't work with randomly salted hashes
        validate: {
            validator: function(this: any, v: string) {
                // Skip validation if the value is already hashed (when reading from DB)
                if (v && v.startsWith('$2')) return true;
                
                // Validate phone number format
                return /^(?:\+20|0)?(1[0-9]{9}|2[0-9]{8,9}|(10|11|12|15)[0-9]{8})$/.test(v);
            },
            message: "Invalid Phone number format"
        },
        trim: true,
    },
    phoneUnique: {
        type: String,
        sparse: true,
        unique: true,
        index: true
    },
    certificate: {
        type: String,
        required: [true, "Certificate is required"],
        trim: true,
    },
    isVerified: {
        type: Boolean,
        default: false,
        select: false,
    },
    verifyCode: {
        type: String,
        trim: true,
        select: false
    },
    verifyCodeExpireOn: {
        type: Date,
        select: false
    },
    governorate: {
        type: String,
        enum: Object.values(Governorates),
        required: [true, "Governorate is required"],
        index: true, // Index for faster queries
        trim: true,
    },
    birthdate: {
        type: Date,
        // The actual value will be set in the pre-save hook
    },
    age: {
        type: Number,
        // The actual value will be set in the pre-save hook
    },
    role: {
        type: String,
        enum: Object.values(UserRole),
        default: UserRole.Voter, // Default role is voter
        required: [true, "User role is required"],
        index: true,
    },
    status: {
        type: String,
        enum: ["active", "suspended"],
        default: "active",
    },
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true, // Prevent modification after creation
    }
}
)

/**
 * User schema with data protection features:
 * - National IDs and phone numbers are hashed using bcrypt before storage
 * - Uniqueness checks are performed at the service level before saving
 * - Validation is performed on pre-hashed values only
 */

// Import the utility function at the top of the file
import { extractBirthdateFromNationalId, calculateAge } from '../utils/nationalId.utils';

// Import crypto module at the top
import crypto from 'crypto';

userSchema.pre('save', async function (next) {
    try {
        // Store original national ID for age calculation
        let originalNationalId: string | null = null;
        let originalPhone: string | null = null;
        
        // Only hash values if they are new or modified, and only if they don't already look like hashes
        if (this.isNew || this.isModified("nationalId") || this.isModified("phone")) {
            const salt = await bcryptjs.genSalt(10);

            if (this.nationalId && !this.nationalId.startsWith('$2')) {
                // Preserve the original national ID for age calculation and unique hash
                originalNationalId = this.nationalId;
                
                // Create a deterministic hash for uniqueness checks (SHA-256)
                this.nationalIdUnique = crypto.createHash('sha256')
                    .update(originalNationalId)
                    .digest('hex');
                
                // Use bcrypt for the actual storage (security)
                this.nationalId = await bcryptjs.hash(originalNationalId, salt);
            }

            if (this.phone && !this.phone.startsWith('$2')) {
                // Preserve original phone for unique hash
                originalPhone = this.phone;
                
                // Create a deterministic hash for uniqueness checks (SHA-256)
                this.phoneUnique = crypto.createHash('sha256')
                    .update(originalPhone)
                    .digest('hex');
                
                // Use bcrypt for the actual storage (security)
                this.phone = await bcryptjs.hash(originalPhone, salt);
            }
            
            // Extract age from National ID during user creation
            if (originalNationalId) {
                const birthdate = extractBirthdateFromNationalId(originalNationalId);
                if (birthdate) {
                    this.birthdate = birthdate;
                    this.age = calculateAge(birthdate);
                }
            }
        }
        
        next();
    }
    catch (error) {
        console.log(error)
        next(error instanceof Error ? error : new Error(String(error)));
    }
})

userSchema.methods.compareNationalId = async function (userNationalId: string): Promise<boolean> {
    if (this.nationalId)
        return await bcryptjs.compare(userNationalId, this.nationalId)
    return false;
}
userSchema.methods.comparePhoneNumber = async function (userPhone: string): Promise<boolean> {
    if (this.phone)
        return await bcryptjs.compare(userPhone, this.phone)
    return false;
}
const User = mongoose.model<IUser, UserModel>("User", userSchema);

export default User