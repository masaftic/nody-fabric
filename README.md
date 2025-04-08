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
