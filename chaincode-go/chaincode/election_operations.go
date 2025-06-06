package chaincode

import (
	"encoding/json"
	"fmt"
	"slices"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

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

// CreateElection creates a new election from JSON input (admin only)
func (s *VotingContract) CreateElection(ctx contractapi.TransactionContextInterface, electionInputJSON string) error {
	// Parse the JSON input
	var input Election
	err := json.Unmarshal([]byte(electionInputJSON), &input)
	if err != nil {
		return fmt.Errorf("failed to unmarshal election input: %v", err)
	}

	// Validate required fields
	if input.ElectionID == "" || input.Name == "" || len(input.Candidates) == 0 ||
		input.StartTime == "" || input.EndTime == "" {
		return fmt.Errorf("missing required fields in election input")
	}

	// Check if election already exists
	electionJSON, err := ctx.GetStub().GetState(electionPrefix + input.ElectionID)
	if err != nil {
		return fmt.Errorf("failed to read from world state: %v", err)
	}
	if electionJSON != nil {
		return fmt.Errorf("election already exists with Id: %s", input.ElectionID)
	}

	electionJSON, err = json.Marshal(input)
	if err != nil {
		return fmt.Errorf("failed to marshal election input: %v", err)
	}

	// Create the election directly with all the data from the input
	err = ctx.GetStub().PutState(electionPrefix+input.ElectionID, electionJSON)
	if err != nil {
		return err
	}

	// Emit event with entire election data for MongoDB sync
	err = ctx.GetStub().SetEvent("election_created", electionJSON)
	if err != nil {
		return fmt.Errorf("failed to set event: %v", err)
	}

	return nil
}

// ComputeVoteTally calculates tally on demand
func (s *VotingContract) ComputeVoteTally(ctx contractapi.TransactionContextInterface, tallyID string, electionID string) (*VoteTally, error) {
	// First get the election to validate it exists and initialize tally
	election, err := s.GetElection(ctx, electionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get election %s: %v", electionID, err)
	}

	// Initialize tally with 0 for all candidates
	tally := make(map[string]int)
	for _, candidate := range election.Candidates {
		tally[candidate.CandidateID] = 0
	}

	// Get all votes using range query with prefix
	iterator, err := ctx.GetStub().GetStateByRange(votePrefix, votePrefix+"}")
	if err != nil {
		return nil, fmt.Errorf("failed to get votes: %v", err)
	}
	defer iterator.Close()

	// Count votes
	for iterator.HasNext() {
		queryResult, err := iterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to get next vote: %v", err)
		}

		var vote Vote
		err = json.Unmarshal(queryResult.Value, &vote)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal vote: %v", err)
		}

		// Only count votes for the specified election
		if vote.ElectionID == electionID {
			// Validate candidate is valid for this election
			candidateIDs := make([]string, len(election.Candidates))
			for i, candidate := range election.Candidates {
				candidateIDs[i] = candidate.CandidateID
			}
			isValidCandidate := slices.Contains(candidateIDs, vote.CandidateID)
			if !isValidCandidate {
				return nil, fmt.Errorf("invalid candidate ID found in vote: %s", vote.CandidateID)
			}
			tally[vote.CandidateID]++
		}
	}

	// Get the client identity ID
	clientID, err := getUserId(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get client identity: %v", err)
	}

	// Create a VoteTally structure to save the results
	voteTally := VoteTally{
		ID:         tallyID,
		UserID:     clientID,
		ElectionID: electionID,
		Tallies:    tally,
		CreatedAt:  time.Now().Format(time.RFC3339),
		IsFinal:    false,
	}

	if election.Status == "completed" {
		voteTally.IsFinal = true
	}

	// Save tally to state
	tallyJSON, err := json.Marshal(voteTally)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal vote tally: %v", err)
	}

	err = ctx.GetStub().PutState(tallyPrefix+electionID, tallyJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to save vote tally: %v", err)
	}

	// Emit an event with the election ID for the tally computation
	tallyEventPayload, err := json.Marshal(map[string]string{
		"electionId": electionID,
		"timestamp":  voteTally.CreatedAt,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal tally event payload: %v", err)
	}

	err = ctx.GetStub().SetEvent("tally_computed", tallyEventPayload)
	if err != nil {
		return nil, fmt.Errorf("failed to emit tally_computed event: %v", err)
	}

	// Save updated election
	electionJSON, err := json.Marshal(election)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal updated election: %v", err)
	}

	err = ctx.GetStub().PutState(tallyPrefix+electionID, electionJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to save updated election: %v", err)
	}

	return &voteTally, nil
}

// ClearElections removes all elections from the ledger - restricted to admins only
func (s *VotingContract) ClearElections(ctx contractapi.TransactionContextInterface) error {
	// Ensure admin privileges
	if err := s.ensureAdmin(ctx); err != nil {
		return err
	}

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
