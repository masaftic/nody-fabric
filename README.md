# Using Fabric-ca-client in nodejs

simple example that registers and enrolls new identities in a hyperledger fabric network using an admin identity.

## Requirements
1. docker
2. fabric images & binaries
3. nodejs
4. tsc
5. go

## Run

### Setup the network & Deploy the chaincode

fabric binaries must be in hyperledger-fabric/bin/

```bash
$ cd hyperledger-fabric/network

# remove any containers or artifacts from any previous runs 
$ ./network.sh down

# run the network with fabric-ca
$ ./network.sh up createChannel -ca

# deploy the chaindcode
$ ./network.sh deployCC -ccn basic -ccp ../../chaincode-go -ccl go
```

### Run the gateway application to interact with the fabric network

```bash
$ cd application

# remove old credentials if there are any from previous runs
$ rm -rf wallet/

# build the project
$ tsc

$ npm start
```
