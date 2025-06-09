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

## GET `/votes/verify/:receipt`

authorized roles: none (public endpoint)

Response:

```json
{
    "verified": true,
    "message": "Vote verified successfully",
    "vote_details": {
        "election_name": "string",
        "timestamp": "2023-10-01T00:00:00Z",
        "receipt": "string"
    },
    "feedback_submitted": true/false
}
```

## GET `/votes/details/:receipt`

authorized roles: voter

Response:

```json
{
    "success": true,
    "message": "Vote details retrieved successfully",
    "vote_details": {
        "election_id": "string",
        "election_name": "string",
        "candidate_id": "string",
        "candidate_name": "string",
        "timestamp": "2023-10-01T00:00:00Z",
        "receipt": "string"
    },
    "feedback_submitted": true/false,
    "feedback": {
        "rating": 5,
        "comments": "string",
        "created_at": "2023-10-01T00:00:00Z"
    }
}
```

## POST `/votes/feedback`

authorized roles: voter

Request:

```json
{
    "election_id": "string",
    "receipt": "string",
    "rating": 1-5, // 1: Very Poor, 2: Poor, 3: Neutral, 4: Good, 5: Excellent
    "comments": "string" // optional
}
```

Response:

```json
{
    "message": "Feedback submitted successfully",
    "feedback_id": "string"
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

## GET `/votes/tally/:electionId`

authorized roles: voter, election commission, auditor

Response:

```json
{
    "election_id": "string",
    "total_votes": 100,
    "tallies": {
        "candidate_id_1": 42,
        "candidate_id_2": 58
    },
    "last_updated": "2023-10-01T00:00:00Z"
}
```

## GET `/votes/check/:userId/:electionId`

authorized roles: voter (self), election commission, auditor

Response:

```json
{
    "success": true,
    "message": "User has voted in this election", // or "User has not voted in this election"
    "hasVoted": true, // or false
    "election_id": "string",
    "user_id": "string",
    "receipt": "string" // only included if hasVoted is true
}
```
