#!/bin/bash
set -e

function start() {
    # Check if container exists
    if docker ps -a --format '{{.Names}}' | grep -q "^mongodb$"; then
        # Container exists, check if it's running
        if docker ps --format '{{.Names}}' | grep -q "^mongodb$"; then
            echo "MongoDB container is already running"
        else
            echo "Starting existing MongoDB container"
            docker start mongodb
        fi
    else
        # Container doesn't exist, create a new one
        echo "Creating new MongoDB container"
        docker run -d \
          --name mongodb \
          -p 27017:27017 \
          -v /home/masaftic/mongodb:/data/db:z \
          mongo:latest
    fi

    # Test connection (using mongosh instead of mongo for newer versions)
    echo "Testing MongoDB connection"
    docker exec -it mongodb mongosh --eval 'db.runCommand({ ping: 1 })' || echo "Connection test failed"

    echo "MongoDB is ready"
}

function stop() {
    echo "Shutting down MongoDB container..."
    docker stop mongodb && echo "MongoDB container stopped successfully" || echo "Failed to stop MongoDB container"
}

function status() {
    if docker ps --format '{{.Names}}' | grep -q "^mongodb$"; then
        echo "MongoDB container is running"
        docker ps -a -f name=mongodb --format "ID: {{.ID}}, Status: {{.Status}}, Ports: {{.Ports}}"
    elif docker ps -a --format '{{.Names}}' | grep -q "^mongodb$"; then
        echo "MongoDB container exists but is not running"
        docker ps -a -f name=mongodb --format "ID: {{.ID}}, Status: {{.Status}}"
    else
        echo "MongoDB container does not exist"
    fi
}

function remove() {
    echo "Removing MongoDB container..."
    docker stop mongodb 2>/dev/null || true
    docker rm mongodb && echo "MongoDB container removed successfully" || echo "Failed to remove MongoDB container"
}

function clean() {
    # First remove the container
    remove
    
    # Then remove the volume data
    echo "Removing MongoDB data volume..."
    if [ -d "/home/masaftic/mongodb" ]; then
        sudo rm -rf /home/masaftic/mongodb/* && echo "MongoDB data volume cleaned successfully" || echo "Failed to clean MongoDB data volume"
    else
        echo "MongoDB data volume not found at /home/masaftic/mongodb"
    fi
}

# Main execution
if [ "$1" == "start" ] || [ -z "$1" ]; then
    start
elif [ "$1" == "stop" ]; then
    stop
elif [ "$1" == "status" ]; then
    status
elif [ "$1" == "remove" ]; then
    remove
elif [ "$1" == "clean" ]; then
    clean
else
    echo "Usage: $0 {start|stop|status|remove|clean}"
    exit 1
fi