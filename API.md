# API documentation

## **Election Commission API**

### `GET /elections/:election_id`

Response:

```json
{
    "election_id": "string",
    "name": "string",
    "description": "string",
    "candidates": [
        {
            "candidate_id": "string",
            "profile_image": "string", // URL
            "name": "string",
            "party": "string"
        }
    ],
    "start_time": "2023-10-01T00:00:00Z",
    "end_time": "2023-10-31T23:59:59Z",
    "status": "active"
}
```

### `GET /elections`

Response:

```json
[
    {
        "election_id": "string",
        "name": "string",
        "description": "string",
        "start_time": "2023-10-01T00:00:00Z",
        "end_time": "2023-10-31T23:59:59Z",
        "status": "active"
    },
    {
        "election_id": "string",
        "name": "string",
        "description": "string",
        "start_time": "2023-10-01T00:00:00Z",
        "end_time": "2023-10-31T23:59:59Z",
        "status": "inactive"
    }
]
```

### `GET /elections/:election_id/analytics`

Response:

```json
{
    "election_id": "string",
    "total_votes": 1000,
    "candidate_votes": [
        {
            "candidate_id": "string",
            "votes": 500
        },
        {
            "candidate_id": "string",
            "votes": 300
        }
    ],
    "voter_demographics": {
        "age_groups": {
            "18-24": 200,
            "25-34": 300,
            "35-44": 250,
            "45-54": 150,
            "55+": 100
        }
    },
    "voter_locations": {
        "location_1": 400,
        "location_2": 300,
        "location_3": 200,
        "location_4": 100
    },
    "voter_turnout": {
        "total_registered": 5000,
        "total_voted": 1000,
        "turnout_rate": 20.0
    },
    "voter_feedback": {
        "positive": 800,
        "neutral": 150,
        "negative": 50
    }
}
```

### `POST /elections`

Request:

```json
{
    "name": "string",
    "description": "string",
    "candidates": [
        {
            "name": "string",
            "party": "string",
            "profile_image": "string" // base64 encoded image
        }
    ],
    "start_time": "2023-10-01T00:00:00Z",
    "end_time": "2023-10-31T23:59:59Z",
    "eligible_governorates": [
        "string"
    ]
}
```

Response:

```json
{
    "status": "success",
    "message": "Election created successfully",
    "election_id": "string"
}
```

### `GET /elections/active`

Response:

```json
[
    {
        "election_id": "string",
        "name": "string",
        "description": "string",
        "start_time": "2023-10-01T00:00:00Z",
        "end_time": "2023-10-31T23:59:59Z",
        "status": "active"
    }
]
```

### `GET /voters/certificate/:voter_id`

Response:

```json
{
    "voter_id": "string",
    "certificate": "string", // PEM encoded certificate
    "public_key": "string" // PEM encoded public key
}
```

### `GET /voters`

Response:

```json
[
    {
        "voter_id": "string",
        "status": "active",
        "registration_date": "2023-10-01T00:00:00Z"
    },
    {
        "voter_id": "string",
        "status": "inactive",
        "registration_date": "2023-10-02T00:00:00Z"
    }
]
```

### `POST /voters/revoke/:voter_id`

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
    "message": "Voter revoked successfully"
}
```

### `GET /voters/revocations`

Response:

```json
[
    {
        "voter_id": "string",
        "reason": "string",
        "timestamp": "2023-10-01T00:00:00Z"
    },
    {
        "voter_id": "string",
        "reason": "string",
        "timestamp": "2023-10-02T00:00:00Z"
    }
]
```

## **Voter API**

### `POST voters/register`

Request:

```json
{
    "national_id_front": "string", // base64 encoded image
    "national_id_back": "string", // base64 encoded image
    "face_image": "string", // base64 encoded image
    "phone_number": "string"
}
```

Response:

```json
{
    "status": "success",
    "message": "Voter registered successfully",
    "voter_id": "string"
}
```

### `POST voters/verify/:voter_id`

```json
Request:
{
    "verification_code": "string"
}

Response:
{
    "certificate": "string", // PEM encoded certificate
    "private_key": "string", // PEM encoded private key
    "public_key": "string" // PEM encoded public key
}
```

### `POST voters/challenge/request`

Request:

```json
{
    "voter_id": "string"
}
```

Response:

```json
{
    "challenge": "string", // base64 encoded challenge
}
```

### `POST voters/challenge/verify`

```json
Request:
{
    "voter_id": "string",
    "challenge_response": "string" // base64 encoded response
}

Response:
{
    "access_token": "string" // JWT token
}
```

### `WS /vote/sign`

**Description:**  
Establish a WebSocket connection to `/vote/sign`. The server will send three digests sequentially. The client must sign each digest with their private key and send the signature back before receiving the next digest.

**Protocol:**

1. **Client connects** to `/vote/sign` with a valid JWT (Bearer Token).
2. **Client sends** initial vote request:

    ```json
    {
        "election_id": "string",
        "voter_id": "string",
        "candidate_id": "string"
    }
    ```

3. **Server responds** with:

    ```json
    {
        "digest_index": 1,
        "digest": "base64-encoded-digest"
    }
    ```

4. **Client signs** the digest and sends:

    ```json
    {
        "digest_index": 1,
        "signature": "base64-encoded-signature"
    }
    ```

5. **Repeat steps 3-4** for `digest_index` 2 and 3.

6. **After all 3 digests are signed**, the server confirms the vote:

    ```json
    {
        "status": "success",
        "message": "Vote recorded"
    }
    ```

### GET `/audit/vote-receipt/:receipt_id/verify`

```json
{
    "receipt_id": "string",
    "status": "recorded",
    "timestamp": "2025-05-12T12:00Z",
    "governorate": "Cairo"
}
```

### POST `/voters/feedback`

Request:

```json
{
    "voter_id": "string",
    "election_id": "string",
    "receipt_id": "string",
    "feedback": 1-5, // 1: Very Poor, 2: Poor, 3: Neutral, 4: Good, 5: Excellent
    "comments": "string" // optional
}
```

Response:

```json
{
    "status": "success",
    "message": "Feedback submitted successfully"
}
```

## **Auditor API**

### GET `/audit/voter-activity/:voterId`

Response:

```json
{
    "voter_id": "string",
    "activity": [
        {
            "timestamp": "2023-10-01T00:00:00Z",
            "action": "registered",
            "details": {
                "ip_address": "string",
                "location": "string"
            }
        },
        {
            "timestamp": "2023-10-02T00:00:00Z",
            "action": "voted",
            "details": {
                "election_id": "string",
                "candidate_id": "string"
            }
        }
    ]
}
```

### GET `/audit/chaincode-events`

Response:

```json
{
    "events": [
        {
            "event_id": "string",
            "timestamp": "2023-10-01T00:00:00Z",
            "event_type": "vote_cast",
            "details": {
                "election_id": "string",
                "voter_id": "string",
                "candidate_id": "string"
            }
        },
        {
            "event_id": "string",
            "timestamp": "2023-10-02T00:00:00Z",
            "event_type": "election_started",
            "details": {
                "election_id": "string"
            }
        }
    ]
}
```

### POST `/audit/vote-tally/:election_id`

Recalculates the vote tally for a given election.

Response:

```json
{
    "tally": [
        {
            "candidate_id": "string",
            "votes": 500
        },
        {
            "candidate_id": "string",
            "votes": 300
        }
    ],
    "total_votes": 1000,
    "timestamp": "2023-10-01T00:00:00Z"
}
```

Error response:

```json
{
    "discrepancy": "string",
    "details": {
        "election_id": "string",
        "expected_votes": 1000,
        "actual_votes": 900
    },
    "timestamp": "2023-10-01T00:00:00Z"
}
```

### GET `/audit/transactions`

Parameters:

- txType (chaincode function name)
- startBlock, endBlock (range-based queries)
- voterId
- limit
- offset

Response:

```json
{
    "transactions": [
        {
            "transaction_id": "string",
            "timestamp": "2023-10-01T00:00:00Z",
            "identity": "string",
            "tx_type": "string",
            "function_name": "string",
            "input": [
                {
                    "key": "string",
                    "value": "string"
                }
            ],
            "validation_code": "string"
        }
    ],
    "total_count": 100,
    "page": 1,
    "page_size": 10,
    "total_pages": 10
}
```
