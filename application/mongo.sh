#!/bin/bash
# filepath: /home/masaftic/dev/fabric-project/application/mongo.sh
set -ex

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