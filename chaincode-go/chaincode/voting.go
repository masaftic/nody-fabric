package chaincode

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
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

		err = ctx.GetStub().PutState(election.ElectionID, electionJSON)
		if err != nil {
			return fmt.Errorf("failed to put to world state. %v", err)
		}
	}

	return nil
}

// CastVote allows a voter to cast a vote
func (s *VotingContract) CastVote(ctx contractapi.TransactionContextInterface, voteID string, voterID string, electionID string, candidateID string) error {
	// Check if the election is active
	electionJSON, err := ctx.GetStub().GetState(electionID)
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

	// Create the vote
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

	// Put the vote in the world state
	err = ctx.GetStub().PutState(voteID, voteJSON)
	if err != nil {
		return fmt.Errorf("failed to put to world state. %v", err)
	}

	// Update the vote tally
	election.VoteTally[candidateID]++
	electionJSON, err = json.Marshal(election)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(electionID, electionJSON)
}

// GetVote returns the vote stored in the world state with given voteID
func (s *VotingContract) GetVote(ctx contractapi.TransactionContextInterface, voteID string) (*Vote, error) {
	voteJSON, err := ctx.GetStub().GetState(voteID)
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
	electionJSON, err := ctx.GetStub().GetState(electionID)
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
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var votes []*Vote
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
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
	resultsIterator, err := ctx.GetStub().GetStateByRange("", "")
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
func (s *VotingContract) ComputeVoteTally(ctx contractapi.TransactionContextInterface, electionID string) (map[string]int, error) {
	// Get all votes for this election
	votesIterator, err := ctx.GetStub().GetStateByPartialCompositeKey("vote", []string{electionID})
	if err != nil {
		return nil, err
	}
	defer votesIterator.Close()

	tally := make(map[string]int)
	for votesIterator.HasNext() {
		queryResponse, err := votesIterator.Next()
		if err != nil {
			return nil, err
		}

		var vote Vote
		err = json.Unmarshal(queryResponse.Value, &vote)
		if err != nil {
			return nil, err
		}
		tally[vote.CandidateID]++
	}
	return tally, nil
}
