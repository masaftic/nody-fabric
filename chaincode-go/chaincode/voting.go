package chaincode

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// // Constants for prefixes
// const (
// 	votePrefix     = "vote_"
// 	electionPrefix = "election_"
// 	userPrefix     = "user_"
// )

// // VotingContract provides functions for managing votes and elections
type VotingContract struct {
	contractapi.Contract
}

// // GetWorldState returns all key-value pairs in world state (for debugging)
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
			CandidateIds:         []string{"candidateA", "candidateB", "candidateC"},
			StartTime:            "2022-01-01T00:00:00Z",
			EndTime:              "2022-01-02T00:00:00Z",
			EligibleGovernorates: []string{"Cairo", "Giza"},
			Status:               "active",
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
