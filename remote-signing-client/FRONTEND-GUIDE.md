# Remote Signing Client - Frontend Developer Guide

This document provides a simple explanation of the WebSocket flow for remote signing in our Hyperledger Fabric application.

## Overview

The remote signing process allows users to sign Hyperledger Fabric blockchain transactions using a client application (like a web or mobile app) without storing their private keys on the server. This approach is more secure because:

1. The private key never leaves the user's device
2. The server never has access to the private key
3. The user has full control over their signing operations

## WebSocket Flow

```
┌──────────────┐                       ┌──────────────┐
│              │                       │              │
│  Front-end   │                       │    Server    │
│  Application │                       │              │
│              │                       │              │
└──────┬───────┘                       └──────┬───────┘
       │                                      │
       │         1. Connect                   │
       │─────────────────────────────────────>│
       │                                      │
       │         2. Registration              │
       │─────────────────────────────────────>│
       │                                      │
       │     3. Registration Confirmation     │
       │<─────────────────────────────────────│
       │                                      │
       │         4. Signing Request           │
       │<─────────────────────────────────────│
       │                                      │
       │         5. Signing Response          │
       │─────────────────────────────────────>│
       │                                      │
```

## Implementation Steps

### 1. Connect to the WebSocket Server

```javascript
// Using Socket.IO client
const socket = io(SERVER_URL, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
});

// Connection event
socket.on('connect', () => {
    console.log('Connected to server');
    // Register after connection
    registerUser();
});
```

### 2. Register the User

```javascript
function registerUser() {
    // Send user ID to server
    socket.emit('register', { userId: 'user-id' });
}
```

### 3. Handle Registration Confirmation

```javascript
socket.on('registration-success', (data) => {
    console.log(`Registration successful: ${data.message}`);
    // Now ready to receive signing requests
});
```

### 4. Handle Signing Requests

```javascript
socket.on('signing-request', async (data) => {
    console.log(`Received signing request ${data.requestId} for user ${data.userId}`);
    
    try {
        // The digest is the hash that needs to be signed
        const digest = Uint8Array.from(Buffer.from(data.digest, 'base64'));
        
        // Sign the digest using the user's private key
        const signature = await signDigest(digest); // Your signing function
        
        // Prepare response
        const response = {
            userId: data.userId,
            requestId: data.requestId,
            signature: Buffer.from(signature).toString('base64')
        };
        
        // Send response back to server
        socket.emit('signing-response', response);
        
    } catch (error) {
        // Send error response
        socket.emit('signing-response', {
            userId: data.userId,
            requestId: data.requestId,
            error: `Signing failed: ${error.message}`
        });
    }
});
```

### 5. Implement the Signing Function

```javascript
// This is where you implement the actual signing logic using:

// Note: You'll need to import the private key into the browser's key store
// You must use this algorithm to match the server's expectations
// Try to implement it in the browser
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
```

## Data Structures

### Signing Request
```javascript
{
    userId: "user1",         // The ID of the user who needs to sign
    requestId: "uuid-here",  // A unique identifier for this signing request
    digest: "base64-string"  // The digest to be signed, encoded as base64
}
```

### Signing Response
```javascript
{
    userId: "user1",         // The ID of the user who signed
    requestId: "uuid-here",  // The same ID from the signing request
    signature: "base64-string" // The signature, encoded as base64
}
```

### Error Response
```javascript
{
    userId: "user1",         // The ID of the user
    requestId: "uuid-here",  // The same ID from the signing request
    error: "Error message"   // Description of what went wrong
}
```

## Transactions & Signing Counts

When submitting a transaction to the blockchain:
- Evaluation (query) operations require 1 signature
- Commit (write) operations require 3 signatures:
  1. For endorsement
  2. For transaction submission
  3. For commit status verification

This is handled automatically by the server, but it explains why you might see multiple signing requests for a single user action.


## Testing

First register a user with the server. on /api/v1/users/register endpoint.
Get the user-id of the registered user.

navigate to the `remote-signing-client` directory and type into terminal:

```bash
export USER_ID=<user-id>
```

Then run the client application and ensure it connects to the WebSocket server with.

```bash
npm start
```

## Todo

- [ ] Implement transaction info about the signing request (what the user is actually signing).
