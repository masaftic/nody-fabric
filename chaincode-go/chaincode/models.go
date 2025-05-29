package chaincode

// Constants for prefixes
const (
	votePrefix     = "vote_"
	electionPrefix = "election_"
	userPrefix     = "user_"
	tallyPrefix    = "tally_"
)

// Vote represents a vote cast by a voter
type Vote struct {
	VoteID      string `json:"vote_id"`
	VoterID     string `json:"voter_id"`
	ElectionID  string `json:"election_id"`
	CandidateID string `json:"candidate_id"`
	Receipt     string `json:"receipt"`
	CreatedAt   string `json:"created_at"` // Timestamp of when the vote was cast
}

// Election represents an election with its parameters
type Election struct {
	ElectionID           string      `json:"election_id"`
	Name                 string      `json:"name"`
	Description          string      `json:"description"`
	Candidates           []Candidate `json:"candidates"`
	StartTime            string      `json:"start_time"`
	EndTime              string      `json:"end_time"`
	EligibleGovernorates []string    `json:"eligible_governorates"`
	Status               string      `json:"status"`
	LastTallyTime        string      `json:"last_tally_time,omitempty"`
	ElectionImage        string      `json:"election_image"`
}

// Candidate represents a candidate in an election
type Candidate struct {
	CandidateID  string `json:"candidate_id"`
	Name         string `json:"name"`
	Party        string `json:"party"`
	ProfileImage string `json:"profile_image"`
	Description  string `json:"description"`
}

// User represents a registered voter in the system
type User struct {
	ID               string   `json:"id"`
	Governorate      string   `json:"governorate"`
	VotedElectionIds []string `json:"voted_election_ids"` // Track which elections this user has voted in
	Role             string   `json:"role"`               // e.g., "voter", "election_commission", "auditor"
	Status           string   `json:"status"`             // e.g., "active", "suspended"
}

type VoteTally struct {
	ID         string         `json:"id"`          // Unique identifier for the tally
	UserID     string         `json:"user_id"`     // ID of the user who created the tally
	ElectionID string         `json:"election_id"` // TODO: index this column
	Tallies    map[string]int `json:"tallies"`     // Map of candidateID -> vote count
	CreatedAt  string         `json:"created_at"`  // Timestamp of when the tally was created
	IsFinal    bool           `json:"is_final"`    // Indicates if this is the finalized tally
}
