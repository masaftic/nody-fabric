# API Test Scripts

This directory contains scripts for testing the election system API.

## Scripts

- `index.js` - K6 performance testing script for making many concurrent votes
- `generate-test-data.js` - Script for creating test users, casting votes, and submitting feedback

## How to Use

### Data Generation Script

The `generate-test-data.js` script will:

1. Register n users (configurable)
2. Login each user (if needed)
3. Cast votes for a specified election
4. Submit random feedback for those votes

To use the script:

1. Install dependencies:
   ```
   npm install
   ```

2. Update the configuration at the top of the script:
   - `NUM_USERS`: Number of users to create
   - `ELECTION_ID`: ID of the election to vote in
   - `API_BASE_URL`: Base URL of your API endpoints

3. Run the script:
   ```
   npm run generate-data
   ```

4. Check the console output and the generated `generated_users.json` file for results

### Performance Testing Script

The K6 script in `index.js` is for performance testing with many concurrent users:

1. Run with:
   ```
   npm start
   ```

## Notes

- Make sure your API server is running before executing these scripts
- The election ID needs to be valid and active
- Change the configuration settings as needed for your specific testing requirements
