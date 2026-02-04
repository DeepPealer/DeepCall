import requests
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_URL = "http://127.0.0.1:8002"

def test_cors():
    try:
        logger.info("Testing CORS...")
        headers = {
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        }
        r = requests.options(f"{BASE_URL}/auth/register", headers=headers)
        logger.info(f"CORS Status: {r.status_code}")
        logger.info(f"CORS Headers: {r.headers}")
        
        if r.status_code == 200 and 'Access-Control-Allow-Origin' in r.headers:
            logger.info("CORS seems OK ✅")
        else:
            logger.warning("CORS might be failing ❌")
            
    except Exception as e:
        logger.error(f"CORS Test Failed: {e}")

def test_register():
    try:
        username = "debug_cors_user"
        email = f"{username}@test.com"
        password = "password123"
        
        logger.info(f"Attempting register for {username}...")
        r = requests.post(f"{BASE_URL}/auth/register", json={
            "username": username,
            "email": email,
            "password": password
        }, headers={"Origin": "http://localhost:5173"})
        
        logger.info(f"Register Status: {r.status_code}")
        logger.info(f"Register Response: {r.text}")
        
    except Exception as e:
        logger.error(f"Register Failed: {e}")

if __name__ == "__main__":
    test_cors()
    test_register()
