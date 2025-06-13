#!/bin/bash

set -e

function build() {
    # Navigate to the hyperledger-fabric network directory
    cd hyperledger-fabric/network

    # Bring up the network with fabric-ca and create a channel
    ./network.sh up createChannel -ca -s couchdb

    # Deploy the chaincode
    ./network.sh deployCC -ccn basic -ccp ../../chaincode-go -ccl go

    cd ../../application
    ./mongo.sh start
    npm install
    npm run build
    
    cd ../
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

    ./mongo.sh clean

    cd ../
}

function deploy() {
    # Navigate to the hyperledger-fabric network directory
    cd hyperledger-fabric/network

    # Deploy the chaincode
    ./network.sh deployCC -ccn basic -ccp ../../chaincode-go -ccl go
}

function upgrade() {
    # Navigate to the hyperledger-fabric network directory
    cd hyperledger-fabric/network

    # Upgrade the chaincode
    ./network.sh deployCC -ccn basic -ccp ../../chaincode-go -ccl go -ccv 2.0
}

function restart() {
    clean
    build
}

function start() {
    # Navigate to the hyperledger-fabric network directory
    cd hyperledger-fabric/network

    # Start the network
    ./network.sh up

    cd ../../application
    ./mongo.sh start
}

if [ "$1" == "start" ]; then
    start
elif [ "$1" == "build" ]; then
    build
elif [ "$1" == "clean" ]; then
    clean
elif [ "$1" == "deploy" ]; then
    deploy
elif [ "$1" == "upgrade" ]; then
    upgrade
elif [ "$1" == "restart" ]; then
    restart
else
    echo "Usage: $0 {build|clean|deploy|upgrade|restart}"
    exit 1
fi
