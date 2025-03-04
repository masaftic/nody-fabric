package chaincode

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"slices"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// TODO: use CouchDB

// Constants for prefixes
const (
	votePrefix     = "vote_"
	electionPrefix = "election_"
)

// VotingContract provides functions for managing votes and elections
type VotingContract struct {
	contractapi.Contract
}

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
	ElectionID           string         `json:"electionId"`
	Candidates           []string       `json:"candidates"`
	VoteTally            map[string]int `json:"voteTally"`
	StartTime            string         `json:"startTime"`
	EndTime              string         `json:"endTime"`
	ElectionName         string         `json:"electionName"`
	ElectionDescription  string         `json:"electionDescription"`
	EligibleGovernorates []string       `json:"eligibleGovernorates"`
	ElectionStatus       string         `json:"electionStatus"`
}

// GetWorldState returns all key-value pairs in world state (for debugging)
func (s *VotingContract) GetWorldState(ctx contractapi.TransactionContextInterface) (map[string]any, error) {
	iterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("failed to get world state: %v", err)
	}
	defer iterator.Close()

	result := make(map[string]any)
	for iterator.HasNext() {
		queryResponse, err := iterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to get next item: %v", err)
		}

		var value any
		err = json.Unmarshal(queryResponse.Value, &value)
		if err == nil {
			result[queryResponse.Key] = value
		} else {
			result[queryResponse.Key] = string(queryResponse.Value)
		}
	}

	return result, nil
}

// InitLedger initializes the ledger with some sample elections
func (s *VotingContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	elections := []Election{
		{
			ElectionID:           "election123",
			Candidates:           []string{"candidateA", "candidateB"},
			VoteTally:            map[string]int{"candidateA": 0, "candidateB": 0},
			StartTime:            "2022-01-01T00:00:00Z",
			EndTime:              "2022-01-02T00:00:00Z",
			ElectionName:         "Presidential Election",
			ElectionDescription:  "Vote for the next president",
			EligibleGovernorates: []string{"Cairo", "Giza"},
			ElectionStatus:       "active",
		},
	}

	for _, election := range elections {
		electionJSON, err := json.Marshal(election)
		if err != nil {
			return err
		}

		err = ctx.GetStub().PutState(electionPrefix+election.ElectionID, electionJSON)
		if err != nil {
			return fmt.Errorf("failed to put to world state. %v", err)
		}
	}

	return nil
}

// CastVote allows a voter to cast a vote
func (s *VotingContract) CastVote(ctx contractapi.TransactionContextInterface, voteID string, voterID string, electionID string, candidateID string) error {
	// Check if the election is active
	electionJSON, err := ctx.GetStub().GetState(electionPrefix + electionID)
	if err != nil {
		return fmt.Errorf("failed to read from world state: %v", err)
	}
	if electionJSON == nil {
		return fmt.Errorf("the election %s does not exist", electionID)
	}

	var election Election
	err = json.Unmarshal(electionJSON, &election)
	if err != nil {
		return err
	}

	if election.ElectionStatus != "active" {
		return fmt.Errorf("the election %s is not active", electionID)
	}

	// Create the vote receipt
	receipt := sha256.Sum256([]byte(voteID + electionID + candidateID))
	receiptHex := hex.EncodeToString(receipt[:])

	vote := Vote{
		VoteID:      voteID,
		VoterID:     voterID,
		ElectionID:  electionID,
		CandidateID: candidateID,
		Receipt:     receiptHex,
	}
	voteJSON, err := json.Marshal(vote)
	if err != nil {
		return err
	}

	// Store with prefix
	return ctx.GetStub().PutState(votePrefix+voteID, voteJSON)
}

// GetVote returns the vote stored in the world state with given voteID
func (s *VotingContract) GetVote(ctx contractapi.TransactionContextInterface, voteID string) (*Vote, error) {
	voteJSON, err := ctx.GetStub().GetState(votePrefix + voteID)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if voteJSON == nil {
		return nil, fmt.Errorf("the vote %s does not exist", voteID)
	}

	var vote Vote
	err = json.Unmarshal(voteJSON, &vote)
	if err != nil {
		return nil, err
	}

	return &vote, nil
}

// GetElection returns the election stored in the world state with given electionID
func (s *VotingContract) GetElection(ctx contractapi.TransactionContextInterface, electionID string) (*Election, error) {
	electionJSON, err := ctx.GetStub().GetState(electionPrefix + electionID)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if electionJSON == nil {
		return nil, fmt.Errorf("the election %s does not exist", electionID)
	}

	var election Election
	err = json.Unmarshal(electionJSON, &election)
	if err != nil {
		return nil, err
	}

	return &election, nil
}

// GetAllVotes returns all votes found in world state
func (s *VotingContract) GetAllVotes(ctx contractapi.TransactionContextInterface) ([]*Vote, error) {
	iterator, err := ctx.GetStub().GetStateByRange(votePrefix, votePrefix+"}")
	if err != nil {
		return nil, err
	}
	defer iterator.Close()

	var votes []*Vote
	for iterator.HasNext() {
		queryResponse, err := iterator.Next()
		if err != nil {
			return nil, err
		}

		var vote Vote
		err = json.Unmarshal(queryResponse.Value, &vote)
		if err != nil {
			return nil, err
		}
		votes = append(votes, &vote)
	}

	return votes, nil
}

// GetAllElections returns all elections found in world state
func (s *VotingContract) GetAllElections(ctx contractapi.TransactionContextInterface) ([]*Election, error) {
	resultsIterator, err := ctx.GetStub().GetStateByRange(electionPrefix, electionPrefix+"}")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var elections []*Election
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var election Election
		err = json.Unmarshal(queryResponse.Value, &election)
		if err != nil {
			return nil, err
		}
		elections = append(elections, &election)
	}
	return elections, nil
}

// ComputeVoteTally calculates tally on demand
func (s *VotingContract) ComputeVoteTally(ctx contractapi.TransactionContextInterface, electionID string) error {
	// First get the election to validate it exists and initialize tally
	election, err := s.GetElection(ctx, electionID)
	if err != nil {
		return fmt.Errorf("failed to get election %s: %v", electionID, err)
	}

	// Initialize tally with 0 for all candidates
	tally := make(map[string]int)
	for _, candidate := range election.Candidates {
		tally[candidate] = 0
	}

	// Get all votes using range query with prefix
	iterator, err := ctx.GetStub().GetStateByRange(votePrefix, votePrefix+"}")
	if err != nil {
		return fmt.Errorf("failed to get votes: %v", err)
	}
	defer iterator.Close()

	// Count votes
	for iterator.HasNext() {
		queryResult, err := iterator.Next()
		if err != nil {
			return fmt.Errorf("failed to get next vote: %v", err)
		}

		var vote Vote
		err = json.Unmarshal(queryResult.Value, &vote)
		if err != nil {
			return fmt.Errorf("failed to unmarshal vote: %v", err)
		}

		// Only count votes for the specified election
		if vote.ElectionID == electionID {
			// Validate candidate is valid for this election
			isValidCandidate := slices.Contains(election.Candidates, vote.CandidateID)
			if !isValidCandidate {
				return fmt.Errorf("invalid candidate ID found in vote: %s", vote.CandidateID)
			}
			tally[vote.CandidateID]++
		}
	}

	// Update election with new tally
	election.VoteTally = tally

	// Save updated election
	electionJSON, err := json.Marshal(election)
	if err != nil {
		return fmt.Errorf("failed to marshal updated election: %v", err)
	}

	return ctx.GetStub().PutState(electionPrefix+electionID, electionJSON)
}

// ClearVotes removes all votes from the ledger
func (s *VotingContract) ClearVotes(ctx contractapi.TransactionContextInterface) error {
	iterator, err := ctx.GetStub().GetStateByRange(votePrefix, votePrefix+"}")
	if err != nil {
		return fmt.Errorf("failed to get votes: %v", err)
	}
	defer iterator.Close()

	for iterator.HasNext() {
		queryResult, err := iterator.Next()
		if err != nil {
			return fmt.Errorf("failed to get next vote: %v", err)
		}

		err = ctx.GetStub().DelState(queryResult.Key)
		if err != nil {
			return fmt.Errorf("failed to delete vote %s: %v", queryResult.Key, err)
		}
	}

	return nil
}

// ClearElections removes all elections from the ledger
func (s *VotingContract) ClearElections(ctx contractapi.TransactionContextInterface) error {
	iterator, err := ctx.GetStub().GetStateByRange(electionPrefix, electionPrefix+"}")
	if err != nil {
		return fmt.Errorf("failed to get elections: %v", err)
	}
	defer iterator.Close()

	for iterator.HasNext() {
		queryResult, err := iterator.Next()
		if err != nil {
			return fmt.Errorf("failed to get next election: %v", err)
		}

		err = ctx.GetStub().DelState(queryResult.Key)
		if err != nil {
			return fmt.Errorf("failed to delete election %s: %v", queryResult.Key, err)
		}
	}

	return nil
}
