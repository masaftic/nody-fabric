package chaincode

import (
	"encoding/json"
	"fmt"
	"time"

	"slices"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// RegisterUser registers a new user in the system
func (s *VotingContract) RegisterUser(ctx contractapi.TransactionContextInterface, userId string, governorate string, role string) error {
	// Check if user already exists
	userJSON, err := ctx.GetStub().GetState(userPrefix + userId)
	if err != nil {
		return fmt.Errorf("failed to read from world state: %v", err)
	}
	if userJSON != nil {
		return fmt.Errorf("user already exists with ID: %s", userId)
	}

	// Validate role
	validRoles := []string{"voter", "election_commission", "auditor"}
	if !slices.Contains(validRoles, role) {
		return fmt.Errorf("invalid role: %s. Must be one of: %v", role, validRoles)
	}

	// Create new user
	user := User{
		ID:               userId,
		Governorate:      governorate,
		VotedElectionIds: []string{},
		Role:             role, // Default role
		Status:           "active",
	}

	userJSON, err = json.Marshal(user)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(userPrefix+userId, userJSON)
}

// GetUser retrieves a user by ID
func (s *VotingContract) GetUser(ctx contractapi.TransactionContextInterface, userID string) (*User, error) {
	userJSON, err := ctx.GetStub().GetState(userPrefix + userID)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if userJSON == nil {
		return nil, fmt.Errorf("the user %s does not exist", userID)
	}

	var user User
	err = json.Unmarshal(userJSON, &user)
	if err != nil {
		return nil, err
	}

	return &user, nil
}

// GetAllUsers returns all users in the system
func (s *VotingContract) GetAllUsers(ctx contractapi.TransactionContextInterface) ([]*User, error) {
	iterator, err := ctx.GetStub().GetStateByRange(userPrefix, userPrefix+"}")
	if err != nil {
		return nil, err
	}
	defer iterator.Close()

	var users []*User
	for iterator.HasNext() {
		queryResponse, err := iterator.Next()
		if err != nil {
			return nil, err
		}

		var user User
		err = json.Unmarshal(queryResponse.Value, &user)
		if err != nil {
			return nil, err
		}
		users = append(users, &user)
	}

	return users, nil
}

// SetUserRole updates a user's role (admin only)
func (s *VotingContract) SetUserRole(ctx contractapi.TransactionContextInterface, userID string, role string) error {
	// Ensure admin privileges
	if err := s.ensureAdmin(ctx); err != nil {
		return err
	}

	// Validate role
	validRoles := []string{"voter", "election_commission", "auditor"}
	if !slices.Contains(validRoles, role) {
		return fmt.Errorf("invalid role: %s. Must be one of: %v", role, validRoles)
	}

	// Get the user
	userJSON, err := ctx.GetStub().GetState(userPrefix + userID)
	if err != nil {
		return fmt.Errorf("failed to read from world state: %v", err)
	}
	if userJSON == nil {
		return fmt.Errorf("user %s does not exist", userID)
	}

	var user User
	err = json.Unmarshal(userJSON, &user)
	if err != nil {
		return err
	}

	// Update role
	user.Role = role

	// Save the updated user
	updatedUserJSON, err := json.Marshal(user)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(userPrefix+userID, updatedUserJSON)
}

// UpdateUserStatus updates a user's status (active or suspended)
func (s *VotingContract) UpdateUserStatus(ctx contractapi.TransactionContextInterface, userID string, status string, reason string) error {
	// Ensure caller has proper privileges (election_commission or auditor)
	clientID, err := getUserId(ctx)
	if err != nil {
		return err
	}

	callerJSON, err := ctx.GetStub().GetState(userPrefix + clientID)
	if err != nil {
		return fmt.Errorf("failed to read caller from world state: %v", err)
	}
	if callerJSON == nil {
		return fmt.Errorf("caller %s does not exist", clientID)
	}

	var caller User
	err = json.Unmarshal(callerJSON, &caller)
	if err != nil {
		return err
	}

	// Check if caller has the right role
	if caller.Role != "election_commission" && caller.Role != "auditor" {
		return fmt.Errorf("only election commission or auditor can update user status")
	}

	// Validate status
	validStatuses := []string{"active", "suspended"}
	if !slices.Contains(validStatuses, status) {
		return fmt.Errorf("invalid status: %s. Must be one of: %v", status, validStatuses)
	}

	// Get the user
	userJSON, err := ctx.GetStub().GetState(userPrefix + userID)
	if err != nil {
		return fmt.Errorf("failed to read from world state: %v", err)
	}
	if userJSON == nil {
		return fmt.Errorf("user %s does not exist", userID)
	}

	var user User
	err = json.Unmarshal(userJSON, &user)
	if err != nil {
		return err
	}

	// Update status
	user.Status = status

	// Save the updated user
	updatedUserJSON, err := json.Marshal(user)
	if err != nil {
		return err
	}

	// If this is a revocation (status = suspended), record it
	if status == "suspended" {
		if err := s.recordUserRevocation(ctx, userID, reason); err != nil {
			return err
		}
	}

	return ctx.GetStub().PutState(userPrefix+userID, updatedUserJSON)
}

// UserRevocation structure to record when a user is revoked/suspended
type UserRevocation struct {
	UserID    string `json:"user_id"`
	Reason    string `json:"reason"`
	Timestamp string `json:"timestamp"`
	RevokedBy string `json:"revoked_by"`
}

// recordUserRevocation stores a record of a user revocation
func (s *VotingContract) recordUserRevocation(ctx contractapi.TransactionContextInterface, userID string, reason string) error {
	// Get the ID of who is doing the revocation
	revokedBy, err := getUserId(ctx)
	if err != nil {
		return err
	}

	// Create revocation record
	revocation := UserRevocation{
		UserID:    userID,
		Reason:    reason,
		Timestamp: time.Now().Format(time.RFC3339),
		RevokedBy: revokedBy,
	}

	// Create composite key for revocation records
	revocationKey, err := ctx.GetStub().CreateCompositeKey("revocation", []string{userID})
	if err != nil {
		return fmt.Errorf("failed to create composite key: %v", err)
	}

	// Save the revocation record
	revocationJSON, err := json.Marshal(revocation)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(revocationKey, revocationJSON)
}

// GetUserRevocations returns all user revocation records
func (s *VotingContract) GetUserRevocations(ctx contractapi.TransactionContextInterface) ([]*UserRevocation, error) {
	// Ensure caller has proper privileges
	clientID, err := getUserId(ctx)
	if err != nil {
		return nil, err
	}

	callerJSON, err := ctx.GetStub().GetState(userPrefix + clientID)
	if err != nil {
		return nil, fmt.Errorf("failed to read caller from world state: %v", err)
	}
	if callerJSON == nil {
		return nil, fmt.Errorf("caller %s does not exist", clientID)
	}

	var caller User
	err = json.Unmarshal(callerJSON, &caller)
	if err != nil {
		return nil, err
	}

	// Check if caller has the right role
	if caller.Role != "election_commission" && caller.Role != "auditor" {
		return nil, fmt.Errorf("only election commission or auditor can view revocations")
	}

	// Query for revocation records using partial composite key
	resultsIterator, err := ctx.GetStub().GetStateByPartialCompositeKey("revocation", []string{})
	if err != nil {
		return nil, fmt.Errorf("failed to get revocations: %v", err)
	}
	defer resultsIterator.Close()

	var revocations []*UserRevocation
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var revocation UserRevocation
		err = json.Unmarshal(queryResponse.Value, &revocation)
		if err != nil {
			return nil, err
		}
		revocations = append(revocations, &revocation)
	}

	return revocations, nil
}
