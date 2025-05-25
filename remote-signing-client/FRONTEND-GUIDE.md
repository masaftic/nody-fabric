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
async function signDigest(digest) {
    // This is where you implement the actual signing logic using:
    // - A hardware wallet
    // - Browser/app cryptography APIs
    // - A secure enclave
    // - Or any other secure key storage and signing method
    
    // Sample implementation using WebCrypto (browser)
    // Note: You'll need to import the private key into the browser's key store
    const signature = await window.crypto.subtle.sign(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        privateKey, // This should be securely stored/accessed
        digest
    );
    
    return new Uint8Array(signature);
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

## Security Considerations

1. Never transmit the private key over the network
2. Implement proper authentication before enabling signing
3. Verify that the signing requests are legitimate
4. Consider adding a visual confirmation for users before signing
5. In production, implement proper TLS/SSL for all WebSocket connections

## Testing Your Implementation

You can test your implementation using the provided test script:

```bash
npm start
```

This will start a simple WebSocket client that simulates the signing process.

## Need Help?

If you encounter any issues or have questions about the WebSocket flow, please contact the blockchain team for assistance.
