from livekit import api
import os

API_KEY = "devkey"
API_SECRET = "secret"

def debug_livekit():
    grants = [x for x in dir(api) if "Grant" in x]
    print(f"Grant related: {grants}")
    print("Testing LiveKit Token...")
    try:
        grant = api.VideoGrants(room_join=True, room="test-room")
        token = (
            api.AccessToken(API_KEY, API_SECRET)
            .with_grants(grant)
            .with_identity("user-123")
            .with_name("Test User")
        )
        
        jwt = token.to_jwt()
        print(f"JWT Generated: {jwt}")
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_livekit()
