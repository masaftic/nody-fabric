# **Votes Api**

## POST `/votes`

authorized roles: voter

Request:

```json
{
    "election_id": "string",
    "candidate_id": "string",
}
```

Response:

```json
{
    "status": "success",
    "message": "Vote cast successfully",
    "receipt": "string" // unique receipt for the vote
}
```

## POST `votes/verify`

authorized roles: voter, election commission, auditor

Request:

```json
{
    "receipt": "string",
}
```

Response:

```json
{
    "status": "success",
    "message": "Vote verified successfully"
}
```

## POST `/votes/feedback`

authorized roles: voter

Request:

```json
{
    "election_id": "string",
    "receipt": "string",
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

## GET `/votes`

authorized roles: election commission, auditor

Query parameters:

- `election_id` (optional): Filter votes by election ID
- `candidate_id` (optional): Filter votes by candidate ID
- `voter_id` (optional): Filter votes by voter ID

Response:

```json
[
    {
        "vote_id": "string",
        "election_id": "string",
        "candidate_id": "string",
        "voter_id": "string",
        "timestamp": "2023-10-01T00:00:00Z",
        "receipt": "string"
    },
    {
        "vote_id": "string",
        "election_id": "string",
        "candidate_id": "string",
        "voter_id": "string",
        "timestamp": "2023-10-01T00:05:00Z",
        "receipt": "string"
    }
]
```

## GET `/votes/:vote_id`

authorized roles: election commission, auditor

Response:

```json
{
    "vote_id": "string",
    "election_id": "string",
    "candidate_id": "string",
    "voter_id": "string",
    "timestamp": "2023-10-01T00:00:00Z",
    "receipt": "string"
}
```
