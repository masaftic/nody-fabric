#!/bin/bash
# filepath: /home/masaftic/dev/fabric-project/chaincode-go/test.sh

# Fail on any error
set -e

# Colors for better output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Running Go Chaincode Tests${NC}"

# Navigate to chaincode directory
cd "$(dirname "$0")"

# Run unit tests with verbose output and code coverage
echo -e "${YELLOW}Running unit tests...${NC}"
go test -v ./chaincode/... -cover

# Verify that chaincode builds correctly
echo -e "${YELLOW}Verifying chaincode builds...${NC}"
go build -v .

echo -e "${GREEN}All tests completed successfully!${NC}"
