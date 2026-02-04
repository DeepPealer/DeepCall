import requests
import asyncio
import websockets
import json
import sys

BASE_URL = "http://127.0.0.1:8002"
WS_URL = "ws://127.0.0.1:8002/ws"

def test_health():
    try:
        r = requests.get(f"{BASE_URL}/")
        print(f"Health Check: {r.status_code} {r.json()}")
    except Exception as e:
        print(f"Health Check Failed: {e}")

def test_auth():
    # Register
    username = "testuser" + str(int(asyncio.get_event_loop().time()))
    email = f"{username}@example.com"
    password = "password123"
    
    print(f"Registering {username}...")
    r = requests.post(f"{BASE_URL}/auth/register", json={
        "username": username,
        "email": email,
        "password": password
    })
    print(f"Register: {r.status_code} {r.text}")
    if r.status_code != 200:
        return None

    # Login
    print("Logging in...")
    r = requests.post(f"{BASE_URL}/auth/login", data={
        "username": email,
        "password": password
    })
    print(f"Login: {r.status_code}")
    if r.status_code != 200:
        return None
    
    token = r.json()["access_token"]
    print(f"Got Token: {token[:10]}...")
    return token

async def test_websocket(token):
    uri = f"{WS_URL}?token={token}"
    print(f"Connecting to WS: {uri}")
    try:
        async with websockets.connect(uri) as websocket:
            print("WS Connected!")
            
            # Send message
            msg = {"channel_id": "test-room", "content": "Hello World"}
            await websocket.send(json.dumps(msg))
            print("Sent message")
            
            # Receive (should get broadcast back ideally if logic holds, or at least no error)
            # Start a timeout
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                print(f"WS Received: {response}")
            except asyncio.TimeoutError:
                print("WS Receive Timeout (Expected if no other listeners, but we are pub/sub)")
                
    except Exception as e:
        print(f"WS Error: {e}")

def test_livekit(token):
    print("Getting LiveKit Token...")
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.post(f"{BASE_URL}/channels/test-room/join", headers=headers)
    print(f"LiveKit: {r.status_code} {r.text}")

async def main():
    test_health()
    token = test_auth()
    if token:
        await test_websocket(token)
        test_livekit(token)

if __name__ == "__main__":
    asyncio.run(main())
