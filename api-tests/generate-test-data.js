const axios = require('axios');
const fs = require('fs');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api/v1';
const NUM_USERS = 100; // Number of users to create
const ELECTION_ID = 'c0d36d86-c41f-498d-99d8-18b7e3fb8266'; // Replace with a valid election ID from your system
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
    console.log(`Successfully registered user with phone ${userData.phone}`);
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
    console.log(`Successfully logged in user with phone ${phone}`);
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
    console.log(`Successfully cast vote for election ${electionId}`);
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
    console.log(`Successfully submitted feedback for receipt ${receipt}`);
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
    console.log(`Successfully retrieved election details for ${electionId}`);
    return response.data.candidates.map(candidate => candidate.candidate_id);
  } catch (error) {
    console.error(`Failed to get election candidates: ${error.message}`);
    return [];
  }
}

// Main function to execute the script
async function main() {
  console.log(`Starting test data generation: Creating ${NUM_USERS} users in parallel...`);
  
  // 1. Register users in parallel
  const userDataArray = Array.from({ length: NUM_USERS }, () => generateRandomData());
  
  const registrationPromises = userDataArray.map(userData => 
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
  
  const registeredUsers = (await Promise.all(registrationPromises)).filter(user => user !== null);
  
  console.log(`Successfully registered ${registeredUsers.length} users`);
  
  // Save user data to file (useful for later use)
  fs.writeFileSync('generated_users.json', JSON.stringify(registeredUsers, null, 2));
  
  // Get election candidates once (using the first user's token)
  let candidates = [];
  if (registeredUsers.length > 0) {
    const firstUserToken = registeredUsers[0].access_token;
    candidates = await getCandidates(firstUserToken, ELECTION_ID);
    
    if (candidates.length === 0) {
      console.log(`No candidates found for election ${ELECTION_ID}. Cannot proceed with voting.`);
      return;
    }
    console.log(`Found ${candidates.length} candidates for election ${ELECTION_ID}`);
  } else {
    console.log('No users registered successfully. Cannot proceed with voting.');
    return;
  }
  
  // 2. For each registered user with token, vote and submit feedback in parallel
  const voteAndFeedbackPromises = registeredUsers.map(async (user) => {
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
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second before submitting feedback
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
  
  const results = await Promise.all(voteAndFeedbackPromises);
  const successfulVotes = results.filter(r => r && r.voted).length;
  const successfulFeedbacks = results.filter(r => r && r.feedback_submitted).length;
  
  console.log(`Test data generation completed! Results: ${successfulVotes}/${registeredUsers.length} votes cast, ${successfulFeedbacks}/${registeredUsers.length} feedbacks submitted.`);
}

// Run the script
main().catch(error => {
  console.error("Error in main execution:", error);
});
