import mongoose, { Document, Model, Schema } from "mongoose";
import bcryptjs from "bcryptjs"
export interface IUser extends Document {
    userId: string;
    nationalId: string;
    phone?: string;
    isVerified?: boolean;
    verifyCode?: string;
    verifyCodeExpireOn?: Date;
    certificate: string;
    governorate: string;
    role: "voter" | "admin" | "auditor";
    status: "active" | "suspended";
}

export interface IUserMethods {
    compareNationalId(nationalId: string): Promise<boolean>;
    comparePhoneNumber(phone: string): Promise<boolean>;
}
export interface UserModel extends Model<IUser, {}, IUserMethods> { }


export interface UserRegisterRequest {
    nationalId: string;
    phone: string;
    governorate: string;
}


const userSchema = new Schema<IUser, UserModel, IUserMethods>({
    userId: {
        type: String,
        required: [true, "User ID is required"],
        unique: true,
        trim: true,
        index: true,
        immutable: true,
    },
    nationalId: {
        type: String,
        unique: true,
        required: [true, "Muse Provide national id"],
        trim: true,
    },
    phone: {
        type: String,
        unique: true,
        sparse: true, // Only enforce uniqueness for non-null values
        match: [/^(?:\+20|0)?(1[0-9]{9}|2[0-9]{8,9}|(10|11|12|15)[0-9]{8})$/, "Invalid Phone number"], // Fixed: regExp → match
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
    certificate: {
        type: String,
        required: [true, "Certificate is required for Fabric connection"],
        trim: true,
    },
    governorate: {
        type: String,
        required: [true, "Governorate is required"],
        trim: true,
    },
    role: {
        type: String,
        enum: ["voter", "admin", "auditor"],
        default: "voter",
    },
    status: {
        type: String,
        enum: ["active", "suspended"],
        default: "active",
    }
},
    { timestamps: true }
)

userSchema.pre('save', async function (next) {
    try {
        if (this.isNew || this.isModified("nationalId") || this.isModified("phone")) {
            const salt = await bcryptjs.genSalt(10);

            if (this.nationalId) {
                this.nationalId = await bcryptjs.hash(this.nationalId, salt);
            }

            if (this.phone) {
                this.phone = await bcryptjs.hash(this.phone, salt);
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