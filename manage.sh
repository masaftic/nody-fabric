#!/bin/bash

set -e

function build() {
    # Navigate to the hyperledger-fabric network directory
    cd hyperledger-fabric/network

    # Bring down any existing network
    ./network.sh down

    # Bring up the network with fabric-ca and create a channel
    ./network.sh up createChannel -ca

    # Deploy the chaincode
    ./network.sh deployCC -ccn basic -ccp ../../chaincode-go -ccl go

    # Navigate to the application directory
    cd ../../application

    # Remove old credentials if there are any from previous runs
    rm -rf wallet/

    # Build the project
    tsc

    # Start the application
    npm start
}

function clean() {
    # Navigate to the hyperledger-fabric network directory
    cd hyperledger-fabric/network

    # Bring down the network
    ./network.sh down

    # Navigate to the application directory
    cd ../../application

    # Remove old credentials and build artifacts
    rm -rf wallet/
    rm -rf dist/
}

if [ "$1" == "build" ]; then
    build
elif [ "$1" == "clean" ]; then
    clean
else
    echo "Usage: $0 {build|clean}"
    exit 1
fi
