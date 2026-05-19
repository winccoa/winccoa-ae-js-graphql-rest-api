#!/bin/bash

# Find and kill the winccoa-graphql-server/index.js process

PROCESS_NAME="winccoa-graphql-server/index.js"

# Find the PID
PID=$(ps aux | grep "$PROCESS_NAME" | grep -v grep | awk '{print $2}')

if [ -z "$PID" ]; then
  echo "No process found matching: $PROCESS_NAME"
  exit 1
fi

echo "Found process $PROCESS_NAME with PID: $PID"
echo "Killing process..."

kill "$PID"

# Check if process was killed
sleep 1
if ps -p "$PID" > /dev/null 2>&1; then
  echo "Process still running, forcing kill..."
  kill -9 "$PID"
  sleep 1
  if ps -p "$PID" > /dev/null 2>&1; then
    echo "Failed to kill process $PID"
    exit 1
  fi
fi

echo "Process killed successfully"
