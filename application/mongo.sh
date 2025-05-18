set -x

docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -v /home/masaftic/mongodb:/data/db:z \
  mongo:latest

docker exec -it mongodb mongo --eval 'db.runCommand({ ping: 1 })'

