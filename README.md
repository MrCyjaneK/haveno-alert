# Haveno Alert

> Simple haveno notifications for telegram

## Setup

1. `./build-havenod.sh` and wait for completion
2. `./run-havenod.sh` in a new terminal window
3. Clone `.env.example` and fill it with your data
4. `npm install`
5. `npm start`

## Docker

docker run -d \
  --name haveno-alert \
  --restart unless-stopped \
  -v $(pwd):$(pwd) -w $(pwd) \
  ghcr.io/MrCyjaneK/haveno-alert:latest \
  bash -c "./build-havenod.sh && ./run-havenod.sh & npm install && npm start"