#!/bin/bash

echo "🚀 Running Integration Test..."

# AWS CLI version (for logging)
aws --version

# Get public IP of EC2 instance tagged with Name = "Deployment-server"
URL=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=Deployment-server" "Name=instance-state-name,Values=running" \
  --query "Reservations[].Instances[].PublicIpAddress" \
  --output text)

echo "🛰️  EC2 Public IP: $URL"

# Check if URL is not empty
if [[ "$URL" != '' ]]; then
    # Ping the /live endpoint to check if the app is up
    http_code=$(curl -s -o /dev/null -w "%{http_code}" http://$URL:3000/live)
    echo "📶 HTTP status code from /live: $http_code"

    # POST request to /planet endpoint
    planet_data=$(curl -s -XPOST http://$URL:3000/planet \
      -H "Content-Type: application/json" \
      -d '{"id": "3"}')

    echo "🌐 Planet Data: $planet_data"

    # Extract planet name using jq
    planet_name=$(echo "$planet_data" | jq .name -r)
    echo "🪐 Planet Name: $planet_name"

    # Validate both status code and expected result
    if [[ "$http_code" -eq 200 && "$planet_name" == "Earth" ]]; then
        echo "✅ Integration Test Passed"
        exit 0
    else
        echo "❌ One or more test(s) failed"
        exit 1
    fi
else
    echo "❌ Could not retrieve EC2 Public IP. Integration test aborted."
    exit 1
fi