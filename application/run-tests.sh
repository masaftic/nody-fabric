#!/bin/bash
# filepath: /home/masaftic/dev/fabric-project/application/run-tests.sh

# Fail on any error
set -e

# Colors for better output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting Fabric Voting Application Tests${NC}"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Make sure Fabric network is running
echo -e "${YELLOW}NOTE: Tests require a running Fabric network with the appropriate channels and chaincode deployed.${NC}"
echo -e "${YELLOW}If tests fail with connection errors, please ensure your Fabric network is running.${NC}"

# Check for MongoDB
echo -e "${YELLOW}NOTE: Tests require MongoDB to be running.${NC}"
echo -e "${YELLOW}If MongoDB is not running, you can start it with: ./mongo.sh${NC}"

# Build the application
echo -e "${YELLOW}Building TypeScript code...${NC}"
npm run build

# Run the tests with increased timeout
echo -e "${YELLOW}Running tests...${NC}"
# Set global timeout for all tests to 5 minutes
JEST_TIMEOUT=300000 npm test -- --detectOpenHandles --forceExit

# Check test result
if [ $? -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
else
  echo -e "${RED}Tests failed. Please check the output above for errors.${NC}"
  exit 1
fi
