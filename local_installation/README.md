# Local / Mock Installation Guide

This folder contains instructions and files for running the project locally with a **Mock Server**. This is useful if you do not have internet access or want to test without connecting to the real Payload Sandbox.

## Files
- `Dockerfile.mock`: Builds a mock API server simulating the Payload API.
- Use the instructions below to run locally.

## Option 1: Run Mock Server with npm

1.  **Install Dependencies**
    From the project root:
    ```bash
    npm install
    ```

2.  **Start Mock Server**
    ```bash
    npm run start:mock-server
    ```
    - Runs on: `http://localhost:3100`

3.  **Run Dashboard (in a separate terminal)**
    ```bash
    cd dashboard
    npm install
    
    # Point Dashboard to Local Mock Server
    export PAYLOAD_API_URL=http://localhost:3100
    export PAYLOAD_API_KEY=test-key
    
    npm start
    ```
    - Runs on: `http://localhost:3000`

## Option 2: Run Mock Server with Docker

You can use the moved `Dockerfile.mock` to build a dockerized mock server.

1.  **Build and Run**
    You would need a custom `docker-compose.mock.yml` (not in root anymore) or run manually:
    
    ```bash
    # Build Backend
    docker build -f local_installation/Dockerfile.mock -t payload-mock .
    docker run -p 3100:3100 payload-mock
    
    # Build Dashboard (standard)
    docker build -f dashboard/Dockerfile -t payload-dash .
    docker run -p 3000:3000 -e PAYLOAD_API_URL=http://host.docker.internal:3100 payload-dash
    ```
