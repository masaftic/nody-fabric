# API documentation

This document provides an overview of the Fabric Blockchain e-Voting System API and links to detailed documentation for each section.

## API Documentation Sections

- [Elections API](./elections-api.md) - Endpoints for creating, retrieving, and managing elections
- [Users API](./users-api.md) - Endpoints for user management and authentication
- [Votes API](./votes-api.md) - Endpoints for casting votes and retrieving voting results
- [Audits API](./audits-api.md) - Endpoints for audit-related operations
- [Auth API](./auth-api.md) - Endpoints for authentication and authorization

Note: Image uploads api endpoints not yet implemented.

## Remote Signing with Socket.IO

The system uses Socket.IO for client-side signing of blockchain transactions, which provides several security benefits:

### Overview

Remote signing allows users to sign Hyperledger Fabric blockchain transactions using their own devices without exposing private keys to the server. The private key remains on the client device at all times.

### Authentication and Connection Flow

1. Client establishes a Socket.IO connection to the server
2. Client registers with the server by providing their user ID
3. Server validates the user and confirms successful registration
4. Server can now send signing requests to the client

### Signing Process

```plain-text
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

### Socket.IO Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `register` | Client → Server | Client sends user ID to register for signing |
| `registration-success` | Server → Client | Server confirms successful registration |
| `signing-request` | Server → Client | Server sends a digest to be signed |
| `signing-response` | Client → Server | Client returns the signed digest |

### Security Benefits

1. **Private Key Protection**: Private keys never leave the client device
2. **Non-custodial**: Server never has access to users' private keys
3. **User Control**: Users explicitly approve each signature request
4. **Transparency**: Users can see exactly what they're signing

### Signing Count Information

When submitting a transaction to the blockchain:

- Evaluation (query) operations require 1 signature
- Commit (write) operations require 3 signatures:
  1. For endorsement
  2. For transaction submission
  3. For commit status verification

For more detailed implementation guidelines, please refer to the [Frontend Developer Guide](../remote-signing-client/FRONTEND-GUIDE.md).

