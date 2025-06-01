package chaincode

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"slices"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// CastVote allows a voter to cast a vote
func (s *VotingContract) CastVote(ctx contractapi.TransactionContextInterface, voteID string, electionID string, candidateID string) (string, error) {
	// Check if the election is active
	electionJSON, err := ctx.GetStub().GetState(electionPrefix + electionID)
	if err != nil {
		return "", fmt.Errorf("failed to read from world state: %v", err)
	}
	if electionJSON == nil {
		return "", fmt.Errorf("the election %s does not exist", electionID)
	}

	var election Election
	err = json.Unmarshal(electionJSON, &election)
	if err != nil {
		return "", err
	}

	// TODO: Check if the election is live. commented until cron jobs.
	// if election.Status != "live" {
	// 	return "", fmt.Errorf("the election %s is not live", electionID)
	// }

	// Get voter ID by extracting CN from client identity
	voterId, err := getUserId(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get voter ID: %v", err)
	}

	// Retrieve user record
	userJSON, err := ctx.GetStub().GetState(userPrefix + voterId)
	if err != nil {
		return "", fmt.Errorf("failed to read user from world state: %v", err)
	}
	if userJSON == nil {
		return "", fmt.Errorf("user %s is not registered in the system", voterId)
	}

	var user User
	err = json.Unmarshal(userJSON, &user)
	if err != nil {
		return "", err
	}

	// Check if user is active
	if user.Status != "active" {
		return "", fmt.Errorf("user account is not active")
	}

	// Check if user has already voted in this election
	if slices.Contains(user.VotedElectionIds, electionID) {
		return "", fmt.Errorf("user has already voted in this election")
	}

	// Check if user's governorate is eligible for this election
	if !slices.Contains(election.EligibleGovernorates, user.Governorate) {
		return "", fmt.Errorf("user from %s is not eligible to vote in this election", user.Governorate)
	}

	// Check if candidate is valid for this election
	isValidCandidate := false
	for _, candidate := range election.Candidates {
		if candidate.CandidateID == candidateID {
			isValidCandidate = true
			break
		}
	}
	if !isValidCandidate {
		return "", fmt.Errorf("invalid candidate ID: %s", candidateID)
	}

	// Create the vote receipt
	receipt := sha256.Sum256([]byte(voteID + electionID + candidateID))
	receiptHex := hex.EncodeToString(receipt[:])

	vote := Vote{
		VoteID:      voteID,
		VoterID:     voterId,
		ElectionID:  electionID,
		CandidateID: candidateID,
		Receipt:     receiptHex,
		CreatedAt:   time.Now().Format(time.RFC3339),
	}
	voteJSON, err := json.Marshal(vote)
	if err != nil {
		return "", err
	}

	// Update user's voting history
	user.VotedElectionIds = append(user.VotedElectionIds, electionID)
	updatedUserJSON, err := json.Marshal(user)
	if err != nil {
		return "", err
	}

	// Store both the vote and updated user record
	err = ctx.GetStub().PutState(votePrefix+voteID, voteJSON)
	if err != nil {
		return "", err
	}

	// Emit a vote_cast event with the entire vote object
	// This will eliminate the need to fetch the vote again in the client
	eventJSON, err := json.Marshal(vote)
	if err != nil {
		return "", err
	}

	err = ctx.GetStub().SetEvent("vote_cast", eventJSON)
	if err != nil {
		return "", fmt.Errorf("failed to emit vote_cast event: %v", err)
	}

	err = ctx.GetStub().PutState(userPrefix+voterId, updatedUserJSON)
	if err != nil {
		return "", err
	}
	return vote.Receipt, nil
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
