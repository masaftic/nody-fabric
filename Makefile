
.PHONY: all test test-api test-chaincode clean

all: test

# Run all tests
test: test-api test-chaincode

# Run API tests
test-api:
	@echo "Running API tests..."
	cd application && ./run-tests.sh

# Run chaincode tests
test-chaincode:
	@echo "Running chaincode tests..."
	cd chaincode-go && ./test.sh

# Run chaincode unit tests only
test-chaincode-unit:
	@echo "Running chaincode unit tests..."
	cd chaincode-go && go test -v ./chaincode/...

# Run API unit tests only
test-api-unit:
	@echo "Running API unit tests..."
	cd application && npm test -- --testMatch '**/*.test.ts' --testPathIgnorePatterns 'integration'

# Start test environment
start-test-env:
	@echo "Starting test environment..."
	cd hyperledger-fabric/network && ./network.sh up createChannel
	cd application && ./mongo.sh

# Stop test environment
stop-test-env:
	@echo "Stopping test environment..."
	docker stop mongodb || true
	docker rm mongodb || true
	cd hyperledger-fabric/network && ./network.sh down

# Clean up test artifacts
clean:
	@echo "Cleaning up test artifacts..."
	cd application && rm -rf coverage .nyc_output
	cd chaincode-go && go clean -testcache
	docker system prune -f

# Generate test coverage reports
coverage:
	@echo "Generating test coverage reports..."
	cd application && npm test -- --coverage
	cd chaincode-go && go test -coverprofile=coverage.out ./chaincode/...
	cd chaincode-go && go tool cover -html=coverage.out -o coverage.html
