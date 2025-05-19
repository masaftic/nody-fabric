package chaincode

import (
	"encoding/json"
	"fmt"

	"slices"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// RegisterUser registers a new user in the system
func (s *VotingContract) RegisterUser(ctx contractapi.TransactionContextInterface, userId string, governorate string) error {
	// Check if user already exists
	userJSON, err := ctx.GetStub().GetState(userPrefix + userId)
	if err != nil {
		return fmt.Errorf("failed to read from world state: %v", err)
	}
	if userJSON != nil {
		return fmt.Errorf("user already exists with ID: %s", userId)
	}

	// Create new user
	user := User{
		ID:               userId,
		Governorate:      governorate,
		VotedElectionIds: []string{},
		Role:             "voter", // Default role
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
	validRoles := []string{"voter", "admin", "auditor"}
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
