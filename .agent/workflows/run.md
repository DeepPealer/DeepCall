---
description: How to run the DeepCall application
---

1. Ensure dependencies are installed:
   // turbo

```bash
pip install -e .
```

2. Initialize the database (if not already done):
   // turbo

```bash
python init_db.py
```

3. Run database migrations:
   // turbo

```bash
alembic upgrade head
```

4. Run the application:
   // turbo

```bash
uvicorn app.main:app --reload
```
