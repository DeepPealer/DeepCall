import requests
import json
import random
import string

BASE_URL = "http://localhost:8002"

def random_username():
    return 'test_' + ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

print("=== Testing Friend System ===\n")

# Step 1: Register User A
username_a = random_username()
email_a = f"{username_a}@test.com"
password = "password123"

print(f"1. Registering User A: {username_a}")
try:
    r = requests.post(f"{BASE_URL}/auth/register", json={
        "username": username_a,
        "email": email_a,
        "password": password
    })
    print(f"   Status: {r.status_code}")
    if r.status_code != 200:
        print(f"   Error: {r.text}")
        exit(1)
    print(f"   ✓ User A registered")
except Exception as e:
    print(f"   ✗ Error: {e}")
    exit(1)

# Step 2: Login User A
print(f"\n2. Logging in as User A")
try:
    r = requests.post(f"{BASE_URL}/auth/login", data={
        "username": email_a,
        "password": password
    })
    print(f"   Status: {r.status_code}")
    if r.status_code != 200:
        print(f"   Error: {r.text}")
        exit(1)
    token_a = r.json()["access_token"]
    print(f"   ✓ Logged in, got token")
except Exception as e:
    print(f"   ✗ Error: {e}")
    exit(1)

# Step 3: Register User B
username_b = random_username()
email_b = f"{username_b}@test.com"

print(f"\n3. Registering User B: {username_b}")
try:
    r = requests.post(f"{BASE_URL}/auth/register", json={
        "username": username_b,
        "email": email_b,
        "password": password
    })
    print(f"   Status: {r.status_code}")
    if r.status_code != 200:
        print(f"   Error: {r.text}")
        exit(1)
    print(f"   ✓ User B registered")
except Exception as e:
    print(f"   ✗ Error: {e}")
    exit(1)

# Step 4: User A sends friend request to User B
print(f"\n4. User A sending friend request to User B")
try:
    headers = {"Authorization": f"Bearer {token_a}"}
    r = requests.post(f"{BASE_URL}/friends/request", 
                     headers=headers,
                     json={"friend_username": username_b})
    print(f"   Status: {r.status_code}")
    print(f"   Response: {r.text}")
    if r.status_code == 201:
        print(f"   ✓ Friend request sent!")
    else:
        print(f"   ✗ Failed to send friend request")
        exit(1)
except Exception as e:
    print(f"   ✗ Error: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

# Step 5: Login User B
print(f"\n5. Logging in as User B")
try:
    r = requests.post(f"{BASE_URL}/auth/login", data={
        "username": email_b,
        "password": password
    })
    token_b = r.json()["access_token"]
    print(f"   ✓ Logged in")
except Exception as e:
    print(f"   ✗ Error: {e}")
    exit(1)

# Step 6: User B checks pending requests
print(f"\n6. User B checking pending requests")
try:
    headers = {"Authorization": f"Bearer {token_b}"}
    r = requests.get(f"{BASE_URL}/friends/pending", headers=headers)
    print(f"   Status: {r.status_code}")
    print(f"   Response: {r.text}")
    if r.status_code == 200:
        pending = r.json()
        if len(pending) > 0:
            print(f"   ✓ Found {len(pending)} pending request(s)")
        else:
            print(f"   ✗ No pending requests found!")
    else:
        print(f"   ✗ Failed to get pending requests")
except Exception as e:
    print(f"   ✗ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n=== Test Complete ===")
