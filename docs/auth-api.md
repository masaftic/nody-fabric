# **Authentication API**

## `POST /api/v1/auth/register`

Request:

```json
{
    "national_id": "30206281400132",
    "phone": "01222544472",
    "governorate": "Governorate1",
    "face_verification_secret": "a1b2c3d4e5...", // Required for regular voters, obtained from face verification process
    "otp_verification_secret": "x1y2z3...", // Required for regular voters, obtained from OTP verification
    "invitation_code": "ABC1234" // Optional, used for roles like election commission or auditor (bypasses all verification)
}
```

Response:

```json
{
    "user_id": "string", // Unique identifier for the user
    "access_token": "string", // JWT token. contains: user_id, role, governorate
    "certificate": "string", // PEM encoded certificate
    "private_key": "string", // PEM encoded private key
}
```

## `POST /api/v1/auth/login` // Temporarily using phone number for login, Instead of a sign challenge with the private key of the user

Request:

```json
{
    "phone": "01222544472",
}
```

Response:

```json
{
    "access_token": "string", // JWT token. contains: user_id, role, governorate
}
```

## `POST /api/v1/auth/send-otp`

Request:

```json
{
    "phone": "01222544472"
}
```

Response:

```json
{
    "message": "OTP sent successfully"
}
```

## `POST /api/v1/auth/resend-otp`

Request:

```json
{
    "phone": "01222544472"
}
```

Response:

```json
{
    "message": "OTP resent successfully"
}
```

## `POST /api/v1/auth/verify-otp`

Request:

```json
{
    "phone": "01222544472",
    "otp": "123456"
}
```

Response:

```json
{
    "message": "OTP verified successfully",
    "otp_verification_secret": "x1y2z3..." // This secret must be used in the registration request
}
```
