# **Authentication API**

## `POST /api/v1/auth/register`

Request:

```json
{
    "national_id": "30206281400132",
    "phone": "01222544472",
    "governorate": "Governorate1",
    "invitation_code": "ABC1234" // Optional, used for roles like election commission or auditor
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
