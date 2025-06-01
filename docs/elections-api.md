# **Elections API**

## `GET /elections/:election_id`

authorized roles: election commission, auditor, voter

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
            "party": "string",
            "description": "string"
        }
    ],
    "start_time": "2023-10-01T00:00:00Z",
    "end_time": "2023-10-31T23:59:59Z",
    "status": "active",
    "eligible_governorates": [
        "string"
    ],
    "election_image": "string", // URL
}
```

## `GET /elections`

authorized roles: election commission, auditor, voter

query parameters:

- `status` (optional): Filter elections by status (e.g., active, inactive)
   status can be: scheduled, live, ended, published, canceled
- `governorate` (optional): Filter elections by eligible governorate
    "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "البحر الأحمر", "البحيرة", "الفيوم", "الغربية", "الإسماعيلية", "المنوفية", "المنيا", "القليوبية", "الوادي الجديد", "السويس", "أسوان", "أسيوط", "بني سويف", "بورسعيد", "دمياط", "الشرقية", "جنوب سيناء", "كفر الشيخ", "مطروح", "الأقصر", "قنا", "شمال سيناء", "سوهاج",
- `start_time` (optional): Filter elections starting after a specific date
- `end_time` (optional): Filter elections ending before a specific date

Response:

```json
[
    {
        "election_id": "string",
        "name": "string",
        "description": "string",
        "start_time": "2023-10-01T00:00:00Z",
        "end_time": "2023-10-31T23:59:59Z",
        "status": "active",
        "election_image": "string", // URL
        "eligible_governorates": [
            "string"
        ]
    },
    {
        "election_id": "string",
        "name": "string",
        "description": "string",
        "start_time": "2023-10-01T00:00:00Z",
        "end_time": "2023-10-31T23:59:59Z",
        "status": "inactive",
        "election_image": "string", // URL
        "eligible_governorates": [
            "string"
        ]
    }
]
```

## `GET /elections/:election_id/analytics` // Not implemented yet

authorized roles: election commission, auditor

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

## `POST /elections`

authorized roles: election commission

Request:

```json
{
    "name": "string",
    "description": "string",
    "candidates": [
        {
            "name": "string",
            "party": "string",
            "profile_image": "string" // URL
        }
    ],
    "start_time": "2023-10-01T00:00:00Z",
    "end_time": "2023-10-31T23:59:59Z",
    "eligible_governorates": [
        "string"
    ],
    "election_image": "string" // URL
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

## `GET /elections/:election_id/tally`

// real-time tally of votes for a given election, including the number of votes each candidate has received and the total number of votes cast. This endpoint is used to provide transparency and real-time updates during the election period.

authorized roles: election commission, auditor, and voter when the election is published

Response:

```json
{
    "election_id": "string",
    "election_name": "string",
    "total_votes": 1000,
    "candidates": [
        {
            "candidate_id": "string",
            "name": "string",
            "party": "string",
            "votes": 500
        },
        {
            "candidate_id": "string",
            "name": "string",
            "party": "string",
            "votes": 300
        }
    ],
    "last_updated": "2023-10-01T00:00:00Z"
}
```

