const axios = require('axios');
const fs = require('fs');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api/v1';
const NUM_USERS = 1000; // Increased number of users to create
const BATCH_SIZE = 20; // Process users in batches of this size
const ELECTION_ID = 'e9b7b06c-186e-48e1-b4df-a34a851915b8'; // Replace with a valid election ID from your system
const GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'البحر الأحمر',
  'البحيرة', 'الفيوم', 'الغربية', 'الإسماعيلية', 'المنوفية'
];

// Storage for generated data
const users = [];

// Helper function to generate random data
function generateRandomData() {
  // Generate a random 14-digit national ID
  const nationalId = Math.floor(10000000000000 + Math.random() * 90000000000000).toString();
  if (Math.random() < 0.5) {
    nationalId[0] = '3';
    nationalId[1] = '0';
  } else {
    nationalId[0] = '2';
  }

  // Generate a random 11-digit phone number starting with 01
  const phone = '01' + Math.floor(100000000 + Math.random() * 900000000).toString();

  // Pick a random governorate
  const governorate = GOVERNORATES[Math.floor(Math.random() * GOVERNORATES.length)];

  return {
    national_id: nationalId,
    phone,
    governorate
  };
}

// Function to register a user
async function registerUser(userData) {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/register`, userData);
    // console.log(`Successfully registered user with phone ${userData.phone}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to register user: ${error.message}`);
    if (error.response) {
      console.error(`Server response: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

// Function to login a user
async function loginUser(phone) {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, { phone });
    // console.log(`Successfully logged in user with phone ${phone}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to login user: ${error.message}`);
    return null;
  }
}

// Function to cast a vote
async function castVote(token, electionId, candidateId) {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/votes`,
      { election_id: electionId, candidate_id: candidateId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    // console.log(`Successfully cast vote for election ${electionId}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to cast vote: ${error.message}`);
    return null;
  }
}

// Function to submit feedback
async function submitFeedback(token, electionId, receipt, rating, comments = '') {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/votes/feedback`,
      { election_id: electionId, receipt, rating, comments },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    // console.log(`Successfully submitted feedback for receipt ${receipt}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to submit feedback: ${error.message}`);
    console.error(`Server response: ${JSON.stringify(error.response.data)}`);
    console.error(`Request data: ${JSON.stringify({ election_id: electionId, receipt, rating, comments })}`);
    return null;
  }
}

// Get available candidates for an election
async function getCandidates(token, electionId) {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/elections/${electionId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    // console.log(`Successfully retrieved election details for ${electionId}`);
    return response.data.candidates.map(candidate => candidate.candidate_id);
  } catch (error) {
    console.error(`Failed to get election candidates: ${error.message}`);
    return [];
  }
}

// Main function to execute the script
async function main() {
  console.log(`Starting test data generation: Creating ${NUM_USERS} users in batches of ${BATCH_SIZE}...`);

  // Generate all user data first
  const userDataArray = Array.from({ length: NUM_USERS }, () => generateRandomData());
  let allRegisteredUsers = [];
  let candidates = [];
  
  // Process users in batches
  for (let i = 0; i < userDataArray.length; i += BATCH_SIZE) {
    const batchStartIndex = i;
    const batchEndIndex = Math.min(i + BATCH_SIZE, userDataArray.length);
    const currentBatch = userDataArray.slice(batchStartIndex, batchEndIndex);
    
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(userDataArray.length / BATCH_SIZE)} (users ${batchStartIndex + 1}-${batchEndIndex})...`);
    
    // Register users in this batch
    const registrationPromises = currentBatch.map(userData =>
      registerUser(userData).then(registeredUser => {
        if (registeredUser) {
          return {
            ...userData,
            user_id: registeredUser.user_id,
            access_token: registeredUser.access_token
          };
        }
        return null;
      })
    );

    const batchRegisteredUsers = (await Promise.all(registrationPromises)).filter(user => user !== null);
    allRegisteredUsers = [...allRegisteredUsers, ...batchRegisteredUsers];
    
    console.log(`Successfully registered ${batchRegisteredUsers.length}/${currentBatch.length} users in this batch`);
    
    // Get election candidates once (using the first user's token)
    if (candidates.length === 0 && batchRegisteredUsers.length > 0) {
      const firstUserToken = batchRegisteredUsers[0].access_token;
      candidates = await getCandidates(firstUserToken, ELECTION_ID);

      if (candidates.length === 0) {
        console.log(`No candidates found for election ${ELECTION_ID}. Cannot proceed with voting.`);
        return;
      }
      console.log(`Found ${candidates.length} candidates for election ${ELECTION_ID}`);
    }
    
    // Proceed with voting for registered users in this batch
    if (batchRegisteredUsers.length > 0 && candidates.length > 0) {
      const voteAndFeedbackPromises = batchRegisteredUsers.map(async (user) => {
        // First ensure we have a valid token, either from registration or by logging in
        let token = user.access_token;
        if (!token) {
          const loginResult = await loginUser(user.phone);
          if (loginResult) {
            token = loginResult.access_token;
          } else {
            console.log(`Skipping user with phone ${user.phone} due to login failure`);
            return null;
          }
        }

        // Pick a random candidate to vote for
        const randomCandidateId = candidates[Math.floor(Math.random() * candidates.length)];

        // Cast a vote
        const voteResult = await castVote(token, ELECTION_ID, randomCandidateId);
        await new Promise(resolve => setTimeout(resolve, 500)); // Reduced wait time before submitting feedback
        if (voteResult && voteResult.receipt) {
          // Generate a random rating (1-5)
          const rating = Math.floor(1 + Math.random() * 5);

          // Generate a random comment
          const comments = [
            "Great voting experience!",
            "The system was easy to use.",
            "Had some issues with the interface.",
            "Very smooth process, thank you!",
            "Could be more user-friendly."
          ];
          const randomComment = comments[Math.floor(Math.random() * comments.length)];

          // Submit feedback
          await submitFeedback(token, ELECTION_ID, voteResult.receipt, rating, randomComment);
          return {
            user_id: user.user_id,
            phone: user.phone,
            voted: true,
            feedback_submitted: true
          };
        }
        return {
          user_id: user.user_id,
          phone: user.phone,
          voted: false,
          feedback_submitted: false
        };
      });

      const batchResults = await Promise.all(voteAndFeedbackPromises);
      const batchSuccessfulVotes = batchResults.filter(r => r && r.voted).length;
      const batchSuccessfulFeedbacks = batchResults.filter(r => r && r.feedback_submitted).length;

      console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} completed! Results: ${batchSuccessfulVotes}/${batchRegisteredUsers.length} votes cast, ${batchSuccessfulFeedbacks}/${batchRegisteredUsers.length} feedbacks submitted.`);
      
      // Add a small delay between batches to avoid overwhelming the server
      if (i + BATCH_SIZE < userDataArray.length) {
        console.log("Waiting before processing next batch...");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  // Save all registered user data to file (useful for later use)
  fs.writeFileSync('generated_users.json', JSON.stringify(allRegisteredUsers, null, 2));

  // Collect all results for final statistics
  let totalSuccessfulVotes = 0;
  let totalSuccessfulFeedbacks = 0;
  
  // Count the successful operations from each batch
  allRegisteredUsers.forEach(user => {
    if (user.voted) totalSuccessfulVotes++;
    if (user.feedback_submitted) totalSuccessfulFeedbacks++;
  });

  console.log(`Test data generation completed! Overall results: ${totalSuccessfulVotes}/${allRegisteredUsers.length} votes cast, ${totalSuccessfulFeedbacks}/${allRegisteredUsers.length} feedbacks submitted.`);
}

// Run the script
main().catch(error => {
  console.error("Error in main execution:", error);
});
