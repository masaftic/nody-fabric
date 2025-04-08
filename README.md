# Hyperledger Fabric Project

Connect to a hyperledger fabric network with gateway, registers and enrolls new identities, invoke chaincode.

## Requirements
1. docker & docker compose
2. fabric images & binaries
3. nodejs
4. tsc
5. go

## Run

### Setup the network & Deploy the chaincode

> ⚠️ **IMPORTANT**: fabric binaries must be in `hyperledger-fabric/bin/`

```bash
$ cd hyperledger-fabric/network

# remove any containers or artifacts from any previous runs 
$ ./network.sh down

# run the network with fabric-ca
$ ./network.sh up createChannel -ca

# deploy the chaincode
$ ./network.sh deployCC -ccn basic -ccp ../../chaincode-go -ccl go
```

### Run the gateway application to interact with the fabric network

```bash
$ cd application

# remove old credentials if there are any from previous runs
$ rm -rf wallet/

# install dependencies
$ npm install

# build the project
$ tsc

$ npm start
```
