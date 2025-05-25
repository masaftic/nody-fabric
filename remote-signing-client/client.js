const { io } = require('socket.io-client');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { buffer } = require('stream/consumers');
const p256 = require('@noble/curves/p256').p256;

// Server URL - change to your actual server URL
const SERVER_URL = 'http://localhost:3000';

// Create Express app for simple UI
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// User ID to simulate (should be a valid user ID in your system)
let userId = process.env.USER_ID || 'user1';

// Optional path to private key for testing (usually this would be securely stored)
const keyPath = process.env.KEY_PATH || '../application/wallet/users/' + userId + '/key.pem';
const key = fs.readFileSync(keyPath, 'utf8');

function ecdsaSign(digest) { // Uint8Array -> Uint8Array | null
    try {
        // Create a key object from the PEM
        if (!fs.existsSync(keyPath)) {
            throw new Error(`Private key file not found at: ${keyPath}`);
        }

        const privateKey = crypto.createPrivateKey(key);

        // Extract the key in JWK format
        const jwk = privateKey.export({ format: 'jwk' });

        if (!jwk.d) throw new Error('Invalid key format');

        // Convert the base64url-encoded private key to raw bytes
        const privateKeyBytes = Buffer.from(jwk.d, 'base64');

        // Sign using noble/curves library with lowS option like in the Hyperledger implementation
        return p256.sign(digest, privateKeyBytes, { lowS: true }).toDERRawBytes();
    } catch (err) {
        console.error('Error in ecdsa signer:', err);
        return null;
    }
}

console.log(`Starting remote signing client for user: ${userId}`);
console.log(`Using key path: ${keyPath}`);

// Socket.IO client
const socket = io(SERVER_URL, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
});

// Connect event
socket.on('connect', () => {
    console.log(`Connected to server with socket ID: ${socket.id}`);

    // Register with the server
    socket.emit('register', { userId });
});

// Registration success event
socket.on('registration-success', (data) => {
    console.log(`Registration successful: ${data.message}`);
});

// Signing request event with ultra-simplified logic
socket.on('signing-request', async (data) => {
    console.log(`Received signing request ${data.requestId} for user ${data.userId}`);

    try {
        // Auto-sign immediately
        if (fs.existsSync(keyPath)) {
            // Convert base64 digest to Buffer
            const digest = Uint8Array.from(Buffer.from(data.digest, 'base64'));

            // Sign the digest
            const signature = ecdsaSign(digest);

            // Create response including the responseEvent if present
            const response = {
                userId: data.userId,
                requestId: data.requestId,
                signature: Buffer.from(signature).toString('base64'), // Convert signature to base64 string
                responseEvent: data.responseEvent // Include the responseEvent if server provided it
            };

            console.log(`Sending signing response for request: signing-response:${response.requestId}`);

            // Emit response
            socket.emit(`signing-response:${response.requestId}`, response);

            console.log(`Automatically signed request ${data.requestId}`);
        } else {
            console.error(`Key not found at ${keyPath}, cannot sign request`);
        }
    } catch (error) {
        console.error('Error during signing:', error);

        // Send error response
        socket.emit('signing-response', {
            userId: data.userId,
            requestId: data.requestId,
            responseEvent: data.responseEvent,
            error: `Signing failed: ${error.message}`
        });
    }
});

// Disconnection event
socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

// Error event
socket.on('error', (error) => {
    console.error('Socket error:', error);
});

// Simple API for status
app.get('/api/status', (req, res) => {
    res.json({
        connected: socket.connected,
        userId
    });
});

// Start the Express server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Remote signing client UI available at http://localhost:${PORT}`);
});

console.log(`Remote signing client started for user: ${userId}`);
console.log(`Looking for private key at: ${keyPath}`);
console.log(`Connecting to server at: ${SERVER_URL}`);
