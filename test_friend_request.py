import requests
import json

# Use a valid token from your login
TOKEN = input("Paste your JWT token: ")

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

# Test friend request
friend_username = input("Enter friend username to add: ")

try:
    response = requests.post(
        "http://localhost:8002/friends/request",
        headers=headers,
        json={"friend_username": friend_username}
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
