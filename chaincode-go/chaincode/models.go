package chaincode

// Constants for prefixes
const (
	votePrefix     = "vote_"
	electionPrefix = "election_"
	userPrefix     = "user_"
)

// Vote represents a vote cast by a voter
type Vote struct {
	VoteID      string `json:"voteId"`
	VoterID     string `json:"voterId"`
	ElectionID  string `json:"electionId"`
	CandidateID string `json:"candidateId"`
	Receipt     string `json:"receipt"`
}

// Election represents an election with its parameters
type Election struct {
	ElectionID           string   `json:"election_id"`
	Name                 string   `json:"name"`
	CandidateIds         []string `json:"candidate_ids"`
	StartTime            string   `json:"start_time"`
	EndTime              string   `json:"end_time"`
	EligibleGovernorates []string `json:"eligible_governorates"`
	Status               string   `json:"status"`
	LastTallyTime        string   `json:"last_tally_time,omitempty"`
}

// User represents a registered voter in the system
type User struct {
	ID             string   `json:"id"`
	Governorate    string   `json:"governorate"`
	VotedElections []string `json:"votedElections"` // Track which elections this user has voted in
	Role           string   `json:"role"`           // e.g., "voter", "admin", "auditor"
	Status         string   `json:"status"`         // e.g., "active", "suspended"
}

type VoteTally struct {
	ElectionID  string         `json:"electionId"`
	Tallies     map[string]int `json:"tallies"` // Map of candidateID -> vote count
	LastUpdated string         `json:"lastUpdated"`
	IsFinal     bool           `json:"isFinal"` // Indicates if this is the finalized tally
}
