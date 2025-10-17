# LLM Code Deployment — Instructor & Student Tools

This repository implements the **LLM Code Deployment** assignment workflow.

- **Instructors:**  
  - `round1.py` — POST tasks to students' endpoints.  
  - `evaluate.py` — Evaluate submitted repositories.

- **Students:**  
  - Implement a `POST /api-endpoint` API that:
    1. Accepts tasks.
    2. Generates the application (files from brief and attachments).
    3. Creates a public GitHub repository.
    4. Enables GitHub Pages for the repo.
    5. POSTs repo metadata to the provided `evaluation_url`.

## Quickstart

1. Copy `.env.example` to `.env` and fill in the required values:

   ```bash
   cp .env.example .env

## Start the API server

    cd api
    npm install
    node server.js


