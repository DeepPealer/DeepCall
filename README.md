# DeepCall (Python Edition)

High-performance real-time communication platform (Discord-like) built with FastAPI, SQLAlchemy, Redis, and LiveKit.

## Prerequisites

- Python 3.10 or higher
- PostgreSQL (Local or Docker)
- Redis (Local or Docker)

## Setup and Run

### 1. Installation

Install project dependencies in editable mode:

```bash
pip install -e .
```

### 2. Infrastructure

If you have Docker installed, you can start Postgres and Redis using:

```bash
docker-compose up -d
```

Otherwise, ensure you have local instances running and update the `.env` file with your credentials.

### 3. Database Initialization

Create the `deepcall` database and run migrations:

```bash
python init_db.py
alembic upgrade head
```

### 4. Running the Application

Start the FastAPI server:

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.
You can access the interactive Swagger documentation at `http://localhost:8000/docs`.

## Key Features Implemented (MVP)

- **Authentication**: JWT-based login and registration.
- **WebSocket Gateway**: Real-time communication via Redis Pub/Sub.
- **Media Signaling**: LiveKit token generation for voice/video channels.
