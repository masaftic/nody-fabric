package chaincode

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// UpdateElectionStatus updates the status of an election
// This is used by the scheduler and admin processes to manage election lifecycle
func (s *VotingContract) UpdateElectionStatus(ctx contractapi.TransactionContextInterface, electionID string, newStatus string) error {
	// Validate the new status
	validStatuses := map[string]bool{
		"scheduled": true,
		"live":      true,
		"ended":     true,
		"published": true,
		"cancelled": true,
	}

	if !validStatuses[newStatus] {
		return fmt.Errorf("invalid status: %s", newStatus)
	}

	// Get the current election
	election, err := s.GetElection(ctx, electionID)
	if err != nil {
		return fmt.Errorf("failed to get election: %v", err)
	}

	// Update the status
	oldStatus := election.Status
	election.Status = newStatus

	// Marshal and save the updated election
	electionJSON, err := json.Marshal(election)
	if err != nil {
		return fmt.Errorf("failed to marshal election: %v", err)
	}

	err = ctx.GetStub().PutState(electionPrefix+electionID, electionJSON)
	if err != nil {
		return fmt.Errorf("failed to update election: %v", err)
	}

	// Create event payload
	eventPayload := map[string]interface{}{
		"election_id": electionID,
		"old_status":  oldStatus,
		"new_status":  newStatus,
		"timestamp":   time.Now().Format(time.RFC3339),
	}

	eventPayloadJSON, err := json.Marshal(eventPayload)
	if err != nil {
		return fmt.Errorf("failed to marshal event payload: %v", err)
	}

	// Emit event for status change to be picked up by listeners
	err = ctx.GetStub().SetEvent("election_status_changed", eventPayloadJSON)
	if err != nil {
		return fmt.Errorf("failed to emit event: %v", err)
	}

	return nil
}

// ComputeFinalTally calculates the final tally for an election and marks it as final
// Used when an election has ended and the final results need to be published
func (s *VotingContract) ComputeFinalTally(ctx contractapi.TransactionContextInterface, electionID string) (*VoteTally, error) {
	// Generate a unique ID for this tally
	tallyID := fmt.Sprintf("final_tally_%s", electionID)

	// Call the existing compute tally function
	tally, err := s.ComputeVoteTally(ctx, tallyID, electionID)
	if err != nil {
		return nil, fmt.Errorf("failed to compute vote tally: %v", err)
	}

	// Mark the tally as final
	tally.IsFinal = true

	// Re-save the tally with the updated IsFinal flag
	tallyJSON, err := json.Marshal(tally)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal tally: %v", err)
	}

	err = ctx.GetStub().PutState(tallyPrefix+tallyID, tallyJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to save final tally: %v", err)
	}

	// Emit an event for the final tally computation
	eventPayload := map[string]interface{}{
		"election_id": electionID,
		"tally_id":    tallyID,
		"is_final":    true,
		"timestamp":   tally.CreatedAt,
	}

	eventPayloadJSON, err := json.Marshal(eventPayload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal event payload: %v", err)
	}

	err = ctx.GetStub().SetEvent("final_tally_computed", eventPayloadJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to emit event: %v", err)
	}

	return tally, nil
}
