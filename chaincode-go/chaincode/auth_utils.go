package chaincode

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// IsUserAdmin checks if the calling user is an admin
func (s *VotingContract) IsUserAdmin(ctx contractapi.TransactionContextInterface) (bool, error) {
	id, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return false, fmt.Errorf("failed to get client identity: %v", err)
	}

	userJSON, err := ctx.GetStub().GetState(userPrefix + id)
	if err != nil {
		return false, fmt.Errorf("failed to read user from world state: %v", err)
	}
	if userJSON == nil {
		return false, fmt.Errorf("user does not exist")
	}

	var user User
	err = json.Unmarshal(userJSON, &user)
	if err != nil {
		return false, err
	}

	return user.Role == "admin", nil
}

// ensureAdmin validates that the calling client is an admin
func (s *VotingContract) ensureAdmin(ctx contractapi.TransactionContextInterface) error {
	isAdmin, err := s.IsUserAdmin(ctx)
	if err != nil {
		return err
	}
	if !isAdmin {
		return fmt.Errorf("operation requires admin privileges")
	}
	return nil
}
