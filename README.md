# Payload Utility - Dashboard

This is the production-ready setup for the Payload Utility Dashboard. 

**This application allows you to:**
1. Connect directly to your Payload Sandbox or Live environment.
2. Manage Customers, Payments, and Ledger entries.
3. Visualize your data.

## Architecture Explained

**You DO have a Backend and Database:**
1.  **Database (Remote):** All your data (Customers, Transactions, custom Metadata, Ledger entries) is stored securely in **Payload's Cloud Database** (accessed via `api.sandbox.payload.co`). We do not need a local SQL database because Payload provides the persistence layer.
2.  **Backend (Node.js/Express):** The "Dashboard" container runs a full **Node.js Server**. This server:
    *   Holds your API Secrets securely.
    *   Runs the **Business Logic** (the SDK).
    *   Calculates Splits, generates Ledger double-entries, and validates logic *before* sending data to Payload.
    *   Serves the frontend UI to your browser.

## Quick Start (Docker)

1.  **Configure Environment**
    Create a `.env` file in the root directory:

    ```bash
    # Your Payload API Secret Key (from Payload Dashboard)
    PAYLOAD_API_KEY=pl_test_...

    # Use Sandbox or Production URL
    PAYLOAD_API_URL=https://api.sandbox.payload.co
    ```

2.  **Start Application**
    ```bash
    docker-compose up --build
    ```

3.  **Access**
    Go to: [http://localhost:3000](http://localhost:3000)

## Features
*   **Ledger Management:** Double-entry bookkeeping records are created by this backend and stored as immutable objects in Payload.
*   **Split Payments:** Configured logic runs in this Node.js backend.
*   **Custom Metadata:** Saved as JSON attributes on Payload objects.
