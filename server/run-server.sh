#!/bin/bash

cd "$(dirname "$0")" || exit 1
rm -f /home/nginx/upstream/webchat.sock
screen -dmS webchat node server.js || echo "Failed to start service!"
echo "Done"
