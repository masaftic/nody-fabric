# **Authentication API**

## `POST /api/v1/auth/register`

Params:

- (optional) `invitation_code`: invitation code for roles (e.g., election commission, auditor)

Request:

```json
{
    "nationalId": "30206281400132",
    "phone": "01222544472",
    "governorate": "Governorate1"
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
