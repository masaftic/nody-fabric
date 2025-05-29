# **Auditor API**

The Auditor API provides a set of endpoints for auditing and validating the integrity of the voting system. These endpoints are only accessible to users with the 'auditor' role.

## GET `/api/v1/audits/voter-activity/:voterId`

Retrieves the activity history of a specific voter, including registration, voting, and any status changes.

**Parameters:**
- `voterId`: The ID of the voter to retrieve activity for

**Authorization**: Required (Auditor or Election Commission role)

**Response:**

```json
{
    "voter_id": "string",
    "activity": [
        {
            "timestamp": "2023-10-01T00:00:00Z",
            "action": "user_registered",
            "details": {
                "governorate": "string",
                "role": "voter"
            }
        },
        {
            "timestamp": "2023-10-02T00:00:00Z",
            "action": "voted",
            "details": {
                "election_id": "string",
                "candidate_id": "string",
                "receipt": "hash_string"
            }
        },
        {
            "timestamp": "2023-10-03T00:00:00Z",
            "action": "user_status_updated",
            "details": {
                "status": "suspended",
                "reason": "Suspicious activity",
                "updated_by": "admin_id"
            }
        }
    ]
}
```


## GET `/api/v1/audits/chaincode-events`

Retrieves a list of blockchain events for auditing purposes, with optional filtering by event type, election ID, and date range.

**Query Parameters:**
- `eventType` (optional): Filter by event type (vote_cast, election_created, etc.)
- `electionId` (optional): Filter by election ID
- `limit` (optional): Maximum number of events to return (default: 50)
- `startDate` (optional): Filter events after this date
- `endDate` (optional): Filter events before this date

**Authorization**: Required (Auditor or Election Commission role)

**Response:**

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
                "candidate_id": "string",
                "receipt": "hash_string",
                "vote_id": "string"
            }
        },
        {
            "event_id": "string",
            "timestamp": "2023-10-02T00:00:00Z",
            "event_type": "election_created",
            "details": {
                "election_id": "string",
                "name": "Presidential Election 2024",
                "creator_id": "admin_id",
                "eligible_governorates": ["Gov1", "Gov2"],
                "candidate_count": 3
            }
        },
        {
            "event_id": "string",
            "timestamp": "2023-10-03T00:00:00Z",
            "event_type": "tally_computed",
            "details": {
                "election_id": "string",
                "computed_by": "auditor_id"
            }
        }
    ]
}
```

## POST `/api/v1/audits/tally/:election_id`

Recalculates the vote tally for a given election by validating votes stored in the blockchain against the real-time tally maintained by the application. This helps identify any potential discrepancies between the blockchain and the application state.

**Parameters:**
- `election_id`: The ID of the election to recalculate tally for

**Authorization**: Required (Auditor role)

**Success Response:**

```json
{
    "tally": [
        {
            "candidate_id": "candidate1",
            "votes": 500
        },
        {
            "candidate_id": "candidate2",
            "votes": 300
        },
        {
            "candidate_id": "candidate3",
            "votes": 200
        }
    ],
    "total_votes": 1000,
    "timestamp": "2023-10-01T00:00:00Z"
}
```

**Discrepancy Response:**

```json
{
    "discrepancy": "Tally discrepancy detected",
    "details": {
        "election_id": "election123",
        "discrepancies": {
            "candidate1": {
                "calculated": 500, 
                "stored": 450
            },
            "totals": {
                "calculated": 1000,
                "stored": 950
            }
        }
    },
    "timestamp": "2023-10-01T00:00:00Z"
}
```