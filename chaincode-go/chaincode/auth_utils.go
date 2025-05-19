package chaincode

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// IsUserAdmin checks if the calling user is an admin
func (s *VotingContract) IsUserAdmin(ctx contractapi.TransactionContextInterface) (bool, error) {
	id, err := extractCN(ctx)
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

// Helper function to extract CN value from client identity
func extractCN(ctx contractapi.TransactionContextInterface) (string, error) {
	// Get the full identity string
	identity, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return "", fmt.Errorf("failed to get identity: %v", err)
	}

	fullID, err := base64.StdEncoding.DecodeString(identity)
	if err != nil {
		return "", fmt.Errorf("failed to decode identity: %v", err)
	}

	// The format is typically x509::{subject}::{issuer}
	// We need to extract just the CN value from the subject part
	parts := strings.Split(string(fullID), "::")
	if len(parts) < 2 {
		return "", fmt.Errorf("invalid identity format: %s", fullID)
	}

	// Get the subject part
	subjectPart := parts[1]

	// Parse out the CN
	cnPrefix := "CN="
	cnStartIndex := strings.Index(subjectPart, cnPrefix)
	if cnStartIndex == -1 {
		return "", fmt.Errorf("CN not found in identity: %s", fullID)
	}

	// Move past the "CN=" prefix
	cnStartIndex += len(cnPrefix)

	// Find the end of the CN value (either comma or end of string)
	cnEndIndex := strings.Index(subjectPart[cnStartIndex:], ",")
	if cnEndIndex == -1 {
		// No comma found, CN is the rest of the subject
		return subjectPart[cnStartIndex:], nil
	} else {
		// Comma found, extract just the CN value
		return subjectPart[cnStartIndex : cnStartIndex+cnEndIndex], nil
	}
}
