# **Auditor API**

## GET `/audit/voter-activity/:voterId`

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

## GET `/audit/chaincode-events`

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

## POST `/audit/tally/:election_id`

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