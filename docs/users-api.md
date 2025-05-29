# **Users Api**

## `GET /users/:user_id/certificate`

authorized roles: election commission, auditor

Response:

```json
{
    "certificate": "string", // PEM encoded certificate
}
```

## `GET /users/:user_id`

authorized roles: election commission, auditor
Response:

```json
{
    "user_id": "string",
    "governorate": "string",
    "status": "active", // or "inactive"
    "role": "voter", // or "election_commission", "auditor"
    "registration_date": "2023-10-01T00:00:00Z"
}
```

## `GET /users`

authorized roles: election commission, auditor

query parameters:

- `status` (optional): Filter users by status (e.g., active, inactive)
- `governorate` (optional): Filter users by governorate
- `role` (optional): Filter users by role (e.g., voter, election_commission, auditor)

Response:

```json
[
    {
        "user_id": "string",
        "governorate": "string",
        "status": "active",
        "role": "voter", // or "election_commission", "auditor"
        "registration_date": "2023-10-01T00:00:00Z"
    },
    {
        "user_id": "string",
        "governorate": "string",
        "status": "inactive",
        "role": "voter", // or "election_commission", "auditor"
        "registration_date": "2023-10-02T00:00:00Z"
    }
]
```

### `POST /users/:user_id/revoke`

authorized roles: election commission, auditor

Request:

```json
{
    "reason": "string"
}
```

Response:

```json
{
    "status": "success",
    "message": "user revoked successfully"
}
```

### `GET /users/revocations`

authorized roles: election commission, auditor

Response:

```json
[
    {
        "user_id": "string",
        "reason": "string",
        "timestamp": "2023-10-01T00:00:00Z",
        "revoked_by": "string" // user_id of the person who revoked
    },
    {
        "user_id": "string",
        "reason": "string",
        "timestamp": "2023-10-02T00:00:00Z",
        "revoked_by": "string" // user_id of the person who revoked
    }
]
```
