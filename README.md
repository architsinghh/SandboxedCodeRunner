# Sandboxed Code Runner

A web-based code execution sandbox with a React frontend and FastAPI backend. Write and run Python, C++, Java, and JavaScript code in isolated Docker containers with judge mode for automated test case evaluation.

**Live Demo:** [sandboxed-code-runner.vercel.app](https://sandboxed-code-runner.vercel.app)

## Architecture

```
frontend/          React + Vite + Monaco Editor (deployed on Vercel)
backend/           FastAPI + Docker SDK (deployed on AWS EC2)
  app/
    main.py        FastAPI app entry point
    routes.py      API endpoints
    models.py      Request/response schemas
    executor.py    Docker container executor
```

## Features

- Monaco Editor with syntax highlighting for Python, C++, Java, and JavaScript
- Isolated Docker container execution per request
- Memory limit (128MB), timeout (10s), no network access
- Stdin input support in Run mode
- Judge mode with custom test cases (input + expected output)
- Runtime error highlighting in the editor
- Real-time stdout/stderr output and execution time

## API Endpoints

| Method | Path       | Description                                  |
|--------|------------|----------------------------------------------|
| POST   | `/execute` | Execute code in a sandboxed container        |
| POST   | `/judge`   | Run code against multiple test cases         |
| GET    | `/health`  | Health check                                 |

**POST /execute** request body:
```json
{
  "code": "print(input())",
  "language": "python",
  "stdin": "hello"
}
```

**Response:**
```json
{
  "stdout": "hello\n",
  "stderr": "",
  "execution_time": 0.523,
  "exit_code": 0
}
```

**POST /judge** request body:
```json
{
  "code": "a, b = map(int, input().split())\nprint(a + b)",
  "language": "python",
  "test_cases": [
    { "input": "1 2", "expected_output": "3" },
    { "input": "0 0", "expected_output": "0" }
  ]
}
```

**Response:**
```json
{
  "results": [
    {
      "test_number": 1,
      "passed": true,
      "actual_output": "3\n",
      "expected_output": "3",
      "stderr": "",
      "execution_time": 0.142
    }
  ],
  "total_passed": 2,
  "total_cases": 2
}
```

## Local Development

### Prerequisites

- Docker installed and running
- Python 3.12+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`. Create a `.env` file to point at the backend:
```
VITE_API_URL=http://localhost:8000
```

## Deployment

### Backend (AWS EC2)

1. Launch a free-tier EC2 instance (t3.micro, Ubuntu 24.04)
2. Open ports 22 (SSH) and 8000 (API) in the security group
3. SSH in and install Docker:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   ```
4. Clone the repo, pull runtime images, build and run:
   ```bash
   git clone https://github.com/architsinghh/SandboxedCodeRunner.git
   cd SandboxedCodeRunner/backend

   docker pull python:3.12-slim
   docker pull node:20-slim
   docker pull gcc:13
   docker pull eclipse-temurin:21-jdk

   docker build -t sandbox-api .
   docker run -d \
     --name sandbox-api \
     -p 8000:8000 \
     --restart unless-stopped \
     -v /var/run/docker.sock:/var/run/docker.sock \
     -e CORS_ORIGINS="*" \
     sandbox-api
   ```

### Frontend (Vercel)

1. Import the repo on [Vercel](https://vercel.com), set root directory to `frontend`
2. API requests are proxied to the backend via `vercel.json` rewrites — no environment variables needed
3. Deploy

## Supported Languages

| Language   | Runtime                | File        |
|------------|------------------------|-------------|
| Python     | Python 3.12            | `main.py`   |
| C++        | GCC 13                 | `main.cpp`  |
| Java       | Eclipse Temurin JDK 21 | `Main.java` |
| JavaScript | Node.js 20             | `main.js`   |

## Security

Each code execution runs in an isolated Docker container with:
- **Memory limit:** 128MB
- **Timeout:** 10 seconds
- **Network:** Disabled
- **Filesystem:** Ephemeral (destroyed after execution)
