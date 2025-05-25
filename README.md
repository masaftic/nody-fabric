# Blockchain based E-Voting System

This project implements a blockchain-based e-voting system using Hyperledger Fabric. It includes a chaincode for managing elections and votes, and a gateway application for interacting with the blockchain network.
node backend acts as a proxy between the frontend and the blockchain network, handling user requests and responses.

## Api documentation

Api documentation is available in the [API.md](./docs/API.md) file. It provides details on the endpoints, request and response formats, and error handling.

## Requirements

1. docker & docker compose
2. fabric images & binaries
3. nodejs
4. tsc
5. go

## Run

### Setup the network & Deploy the chaincode

> ⚠️ **IMPORTANT**: fabric binaries must be in `hyperledger-fabric/bin/`

First, ensure the script is executable:

```bash
$ chmod +x manage.sh
```

To set up the network and deploy the chaincode:

```bash
# Build and start the network
$ ./manage.sh build

# If you need to clean up previous runs
$ ./manage.sh clean

# To redeploy the chaincode and run the application
$ ./manage.sh deploy

# To upgrade the chaincode
$ ./manage.sh upgrade

# To restart everything
$ ./manage.sh restart
```

### Run the gateway application to interact with the fabric network

```bash
$ cd application

$ npm start
```
