# Hierarchy Explorer

An academic Data Structures project demonstrating **Organization and Family Hierarchy Exploration Using Binary Tree Traversals** with a native **C++14 REST Engine** and an interactive **React 19 + TypeScript + Vite** web interface.

---

## 1. Project Overview

**Hierarchy Explorer** models multi-way human hierarchies (corporate organizational charts and genealogical family lineages) using strict **Binary Trees**. Real-world organizations feature $N$-ary branching (e.g., an executive with multiple direct reports or parents with multiple children), which this project maps onto binary trees using the **Left-Child Right-Sibling (LCRS)** representation.

The project demonstrates the core binary tree traversal algorithms:
* **Preorder Traversal** ($\text{Root} \to \text{Left} \to \text{Right}$): Hierarchical top-down outline.
* **Inorder Traversal** ($\text{Left} \to \text{Root} \to \text{Right}$): Binary tree topological interleaving.
* **Postorder Traversal** ($\text{Left} \to \text{Right} \to \text{Root}$): Bottom-up aggregation and safe memory deallocation.

### Key Features
* **Dual Hierarchy Modes:** Switch between corporate **Organization Mode** (executive leadership, reporting chains, departments) and genealogical **Family Mode** (patriarchal/matriarchal lineage, descendant branches).
* **Step-by-Step Traversal Visualizer:** Step through preorder, inorder, and postorder traversals node-by-node with interactive forward/back controls, visited-node highlighting, and path tracing.
* **Complete Hierarchy Editing (CRUD):**
  * **Add Member:** Insert subordinate members under any parent node (`relation: "child"`).
  * **Edit Member:** Update member names, roles, and departments via live REST endpoints while preserving tree structure.
  * **Delete Member:** Safely remove nodes with automatic cascading deletion of subordinate subtrees and dynamic sibling rewiring.
  * **Root-Deletion Safety Protection:** Prevents deleting the hierarchy root node, ensuring tree stability.
* **Native C++14 HTTP Engine:** Self-contained REST server using Windows Sockets 2 (`ws2_32`) or Linux POSIX sockets with zero external web or JSON framework dependencies.
* **Interactive SVG Canvas:** Custom layout engine mapping tree nodes and parent/child/sibling relationship lines without third-party canvas libraries.
* **Connection Feedback:** Real-time backend status polling, request errors, and retry controls. Hierarchies and traversal results come from the C++ API.

---

## 2. Technology Stack & Architecture

### System Architecture

```text
[ Browser / React App (Port 5173) ]
             │
             │ HTTP / JSON (via Vite Proxy: /api/*)
             ▼
[ C++ WinSock2 REST Server (Port 8080) ]
   ├── HttpServer Routing & JSON Serializer
   └── Mode Isolation Manager (orgTree vs. familyTree)
             │
             │ In-Memory C++ Object Invocations
             ▼
[ BinaryTree Core Engine (C++14 ADT) ]
   ├── TreeNode (id, name, role, department, parentId, left, right)
   ├── LCRS Node Registry (std::unordered_map<std::string, TreeNode*>)
   ├── Traversals (Preorder, Inorder, Postorder)
   └── Validations (Uniqueness, Parent Linkage, Root Protection, Cascade Deletion)
```

### Technology Breakdown

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 + TypeScript | Component-driven UI with strict typing and accessibility attributes |
| **Build & Dev Tooling** | Vite 8 + Oxlint | Ultra-fast HMR dev server, built-in reverse proxy, and fast linting |
| **Visualization Engine**| Custom SVG Canvas | Pure mathematical coordinate layout engine for nodes and LCRS connector lines |
| **Backend Language** | C++14 | Standard C++ compiled with MinGW GCC (`-std=c++14 -Wall -Wextra -pedantic`) |
| **Networking Layer** | Windows Sockets 2 (WinSock2)| Native Winsock API (`ws2_32.lib`) with a non-blocking `select()` event loop |
| **Data Structures** | Custom `BinaryTree` ADT | Pointer-based Left-Child Right-Sibling binary tree with RAII memory management |

---

## 3. Left-Child Right-Sibling (LCRS) Representation

### The Modeling Challenge
A classical binary tree allows at most two children per node (`left` and `right`). However, real-world organizational and family trees are general $N$-ary structures where any person may have an arbitrary number of direct subordinates or offspring.

### The LCRS Transformation
The system applies **Knuth's Left-Child Right-Sibling (LCRS) transformation** to map any general tree into an isomorphic binary tree:
* **`left` pointer $\to$ First Direct Child:** Links a parent to their eldest or first direct subordinate.
* **`right` pointer $\to$ Next Sibling:** Links a node to its immediate peer on the same organizational tier under the same parent.

```text
Conceptual Multi-Way Hierarchy (N-ary)           LCRS Binary Tree Topology
            [ Sarah (CEO) ]                               [ Sarah (CEO) ]
           /       |       \                                    /
    [ John (VP) ] [ Kyle ] [ Lisa ]                     [ John (VP) ]
         /                                                /         \
    [ Miles ]                                        [ Miles ]   [ Kyle ]
                                                                     \
                                                                  [ Lisa ]
```

* **Left Branch:** Represents vertical descent (reporting lines / children).
* **Right Branch:** Represents horizontal peer relationships (colleagues / siblings).

---

## 4. Binary Tree Traversals & Theoretical Insights

All traversals execute directly upon the underlying LCRS binary tree:

### 1. Preorder Traversal ($\text{Root} \to \text{Left} \to \text{Right}$)
* **Algorithm:** Process current node, recursively traverse left child (first subordinate), then recursively traverse right child (next sibling).
* **Domain Significance:** Produces a **top-down reporting outline**. An executive is visited first, followed completely by their entire division before proceeding to neighboring peers.

### 2. Postorder Traversal ($\text{Left} \to \text{Right} \to \text{Root}$)
* **Algorithm:** Recursively traverse left child, then right child, and finally process the current node.
* **Domain Significance:** Represents **bottom-up aggregation**. Subordinates and peers are evaluated before leaders. This matches the exact order used internally by `destroySubtreeAndUnregister()` for safe recursive memory deallocation and cascading deletions.

### 3. Inorder Traversal ($\text{Left} \to \text{Root} \to \text{Right}$)
* **Algorithm:** Recursively traverse left child, process current node, then recursively traverse right child.
* **Crucial Domain Insight:**
  > ⚠️ **Important Domain Note:** In an LCRS binary tree, **Inorder traversal does NOT correspond to natural organizational rank or generational seniority.**
  >
  > Because the binary tree maps siblings as right children and subordinates as left children, an Inorder traversal visits the first child's sub-tree, then the current node, and then the sibling chain. The resulting order is an interleaving determined strictly by the binary tree topology rather than intuitive corporate hierarchy levels. Visualizing, stepping through, and explaining this exact divergence is a primary learning objective of this project.

---

## 5. Organization and Family Hierarchy Modes

The application provides two pre-configured, independent hierarchy modes:

| Mode | Root Node | Domain Meaning | Example Initial Members |
| :--- | :--- | :--- | :--- |
| **Organization (`org`)** | `org-ceo` (Sarah Connor) | Corporate reporting structure with divisions and leadership levels | CEO, VP Technology, VP Operations, Lead Architect |
| **Family (`family`)** | `fam-patriarch` (Arthur Pendragon) | Rooted genealogical descent tracking lineages and offspring | Patriarch, Eldest Child, Second Child, Grandchild |

### Domain Scoping & Data Integrity
* **Mode Isolation:** The C++ backend maintains two separate, concurrent `BinaryTree` instances (`orgTree` and `familyTree`). Mutations in one mode never affect the other.
* **Family Tree DAG Scope:** Real genealogies form Directed Acyclic Graphs (DAGs) due to multiple parents, intermarriages, and complex ancestry. Hierarchy Explorer models a **rooted descendant tree** (Patriarch/Matriarch with children branching via LCRS). Cyclic genealogical networks are excluded by design to preserve binary tree integrity.

---

## 6. Member Mutation, Validation & Integrity Protection

The backend engine enforces strict data validation and pointer integrity rules:

### 1. Member Insertion (`POST /api/hierarchy/member`)
* Attaches a new member as a direct subordinate under an existing parent node (`relation: "child"`).
* Sibling chains are linked automatically by the LCRS engine (first child becomes `left`; subsequent children are appended to the sibling's `right` chain).
* **Validation:** Rejects empty identifiers, duplicate IDs (`409 Conflict`), or non-existent parent IDs (`404 Not Found`).

### 2. Member Updates (`PUT /api/hierarchy/member`)
* Updates member attributes (`name`, `role`, `department`) in-place.
* **Pointer Preservation:** Modifies node metadata while guaranteeing that `parentId`, `left`, and `right` structural pointers remain untouched.
* **Validation:** String length limits (ID $\le 64$ characters, name/role/dept $\le 100$ characters) and rejection of empty names or roles (`400 Bad Request`).

### 3. Member Deletion & Root Protection (`DELETE /api/hierarchy/member`)
* **Subtree Cascading Deletion:** When a member with subordinates is deleted, all descendant subtrees are recursively unlinked and deallocated via postorder traversal, preventing memory leaks or orphaned nodes.
* **Pointer Rewiring:** Sibling chains and parent pointers are automatically rewired around the deleted node to preserve hierarchy continuity.
* **Root-Deletion Safety Protection:** Deletion of the root node (`org-ceo` or `fam-patriarch`) is structurally rejected with `400 Bad Request` (`"Root member cannot be deleted"`), preventing accidental collapse of the hierarchy.

---

## 7. REST API Reference

The backend communicates via UTF-8 JSON over HTTP. The default base URL is `http://localhost:8080/api`.

| Method | Endpoint | Parameters / Body | Status Codes | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/status` | None | `200 OK` | Backend health check, compiler, and networking metadata |
| `GET` | `/api/health` | None | `200 OK` | Alias for `/api/status` |
| `OPTIONS` | `*` | None | `204 No Content` | CORS preflight handler returning allowed headers and methods |
| `GET` | `/api/hierarchy` | `mode=org\|family` | `200 OK`<br>`400 Bad Request` | Retrieves the complete hierarchy tree, node list, and `rootId` |
| `POST` | `/api/hierarchy/member` | JSON: `{mode, id, name, role, department, parentId, relation: "child"}` | `201 Created`<br>`400 Bad Request`<br>`404 Not Found`<br>`409 Conflict` | Inserts a new member as a subordinate child of `parentId` |
| `PUT` | `/api/hierarchy/member` | JSON: `{mode, id, name, role, department}` | `200 OK`<br>`400 Bad Request`<br>`404 Not Found` | Updates member details while preserving structural tree pointers |
| `DELETE` | `/api/hierarchy/member` | Query: `?mode=org\|family&id=<id>`<br>or JSON: `{"mode": "...", "id": "..."}` | `200 OK`<br>`400 Bad Request`<br>`404 Not Found`<br>`500 Internal Error` | Deletes member, cascades to descendants, and rewires siblings. Rejects root deletion |
| `GET` | `/api/hierarchy/traverse` | `mode=org\|family&type=preorder\|inorder\|postorder` | `200 OK`<br>`400 Bad Request` | Computes step-by-step traversal order on the binary tree |
| `GET` | `/api/hierarchy/stats` | `mode=org\|family` | `200 OK`<br>`400 Bad Request` | Returns member count, LCRS binary tree height, and root ID |

### Uniform Error Response Format
All failed requests return a structured JSON error body:
```json
{
  "error": "Bad Request",
  "message": "Root member cannot be deleted",
  "path": "/api/hierarchy/member"
}
```

---

## 8. Prerequisites & Installation

### Prerequisites
* **Operating System:** Windows 10 or 11 (uses native `ws2_32.lib` for socket networking).
* **C++ Compiler:** MinGW GCC with C++14 support (tested with MinGW.org GCC 6.3.0 and MinGW-w64).
* **Make Tool:** `mingw32-make` or GNU `make`.
* **Node.js & npm:** Node.js v18+ or v24+ (tested on Node v24.20.0 with npm 11.19.0).

---

## 9. Build, Run, and Launch Instructions

### Option A: Running with Make from Root

Open PowerShell in the project root directory:

```powershell
# 1. Build the C++ server and test binaries
mingw32-make all

# 2. Run backend and API verification tests
mingw32-make test

# 3. Start the C++ backend server (runs on port 8080)
mingw32-make run
```

In a second PowerShell window, start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

### Option B: Step-by-Step Manual Launch

#### Terminal 1 — Backend (C++ REST Server)
```powershell
cd backend

# Build the server executable (hierarchy_server.exe)
mingw32-make server

# Launch the server
mingw32-make run
```
*The backend server starts listening on `http://localhost:8080`.*

#### Terminal 2 — Frontend (React + Vite)
```powershell
cd frontend

# Install npm dependencies (first time only)
npm install

# Start Vite dev server with proxy to port 8080
npm run dev
```
*The web client opens at `http://localhost:5173`.*

---

## API Integration and Persistence

The frontend loads both hierarchy data and statistics from the API. Select a node to add children, edit its details, or delete its descendant branch. Search matches names, roles, departments, and IDs and highlights matching nodes. Export creates a JSON backup; Import replaces the selected mode after confirmation and server validation.

Preorder, inorder, and postorder sequences come from the C++ API. Use Play/Pause, speed selection, Previous/Next, and Reset to follow the sequence on the canvas. Mutations refresh hierarchy data, statistics, and any active traversal. Loading failures show a retry action rather than demo data.

Changes persist in `backend/data/org.json` and `backend/data/family.json` when the server is launched from `backend/`. Keep these files to retain your data between runs. They are excluded from Git. Deletion is permanent unless you have an exported backup; sibling branches are preserved. The inspector's delete dialog protects the root; the explicit Clear hierarchy action clears a whole tree after confirmation and allows creating a new root.

### Windows toolchain shortcut

If MinGW is installed under `C:\msys64\ucrt64\bin` but is not on PATH, use:

```powershell
$env:Path = 'C:\msys64\ucrt64\bin;' + $env:Path
mingw32-make server
.\hierarchy_server.exe
```

In the frontend terminal use `npm.cmd run dev` if PowerShell blocks `npm.ps1`.

## Current Implementation Limitations

* **Toolchain Constraints:** MinGW.org GCC 6.3 uses the `win32` thread model, which does not provide `std::thread`. To ensure 100% build compatibility without altering the host environment, the backend uses a native single-threaded WinSock2 event loop with `select()`.
* **JSON Serialization:** Milestone 2 uses lightweight, safely escaped JSON responses without pulling in heavy external JSON libraries.
* **Persistence:** Local JSON snapshots support a single server process; concurrent writers and database transactions are outside the current scope.
* **Scope:** Editing covers member details. Moving branches and undo history are not implemented. Hierarchies are limited to 1000 members; member text fields allow up to 200 UTF-8 bytes.

---

## 10. Cloud Deployment (Render & Vercel)

The application is structured for cloud hosting with the **C++ REST Backend deployed on Render** (via Docker) and the **React + Vite Frontend deployed on Vercel**.

### A. Backend Deployment on Render

The backend includes a cross-platform socket layer that compiles into a lightweight Linux container.

1. **Create Web Service:** In the [Render Dashboard](https://dashboard.render.com/), choose **New +** $\to$ **Web Service** and connect the `hierarchy-explorer` repository.
2. **Configure Settings:**
   * **Name:** `hierarchy-explorer-backend`
   * **Region:** Any (e.g., Oregon or Frankfurt)
   * **Root Directory:** `backend`
   * **Environment:** `Docker`
   * **Dockerfile Path:** `Dockerfile` *(or `./Dockerfile`, relative to `backend` root)*
3. **Configure Environment Variables:**
   * `PORT`: `8080` *(Render sets this automatically; the server reads `PORT` from environment)*
   * `FRONTEND_ORIGIN`: `https://<your-app>.vercel.app` *(Optional: restricts CORS to your Vercel domain; by default `.vercel.app` and localhost origins are permitted)*
   * `DATA_DIR`: Path to a mounted persistent disk for saved hierarchies (for example `/var/data`). The default `data/` directory is local to the container and is lost when an ephemeral container is replaced. Configure a persistent disk if data must survive redeployments.
4. **Health Check:** Set Health Check Path to `/api/status` (returns `200 OK` with JSON metadata).
5. **Deploy:** Render builds `backend/Dockerfile` using GCC 12, runs unit/API tests during build, and starts the container on `0.0.0.0:${PORT}`.

### B. Frontend Deployment on Vercel

1. **Import Project:** In the [Vercel Dashboard](https://vercel.com/), import the repository.
2. **Configure Build Settings:**
   * **Framework Preset:** Vite
   * **Root Directory:** `frontend`
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
3. **Configure Environment Variables:**
   * `VITE_API_BASE_URL`: `https://<your-backend>.onrender.com`
   *(In local development, leave this unset to automatically route through the local Vite proxy).*
4. **Deploy:** The frontend builds and connects directly to the cloud C++ backend.

---

## 11. Verification and Testing Commands

All verification commands are tested and verified on Windows PowerShell:

### 1. C++ Binary Tree Engine & API Contract Tests
Runs both `test_tree.exe` (data structure unit tests) and `test_api.exe` (HTTP routing, CORS, validation, CRUD, and isolation tests):
```powershell
# From repository root:
mingw32-make test

# Or directly in backend/:
cd backend
mingw32-make test
```

### 2. Frontend Linting (Oxlint)
Checks code quality, accessibility, and syntax rules across all TypeScript and React files:
```powershell
cd frontend
npx oxlint
# Alternatively:
npm run lint
```

### 3. Frontend TypeScript Static Typecheck
Performs strict type analysis without emitting build files:
```powershell
cd frontend
npx tsc -p tsconfig.app.json --noEmit
```

### 4. Frontend Production Build
Validates bundle compilation and packaging:
```powershell
cd frontend
npm run build
```
*(Or from project root: `mingw32-make frontend-build`)*

---

## 12. Project Directory Structure

```text
hierarchy-explorer/
├── Makefile                         # Root build orchestrator (server, test, run, frontend-build)
├── README.md                        # Master project documentation
├── package-lock.json                # Root package lock (excluded from commits)
├── backend/
│   ├── Dockerfile                   # Multi-stage Linux Docker build for Render deployment
│   ├── Makefile                     # Cross-platform Makefile (MinGW Windows & Linux POSIX)
│   ├── include/
│   │   ├── BinaryTree.hpp           # BinaryTree ADT class interface & mutation enums
│   │   ├── HttpServer.hpp           # Cross-platform HTTP server class interface
│   │   └── TreeNode.hpp             # LCRS TreeNode structure definition
│   ├── src/
│   │   ├── BinaryTree.cpp           # Tree traversals, LCRS wiring, update & cascade delete logic
│   │   ├── HttpServer.cpp           # Socket event loop, HTTP request routing & JSON serialization
│   │   └── main.cpp                 # Backend entry point (reads PORT env & binds to 0.0.0.0)
│   └── tests/
│       ├── test_tree.cpp            # Unit tests for binary tree traversals, height, and mutations
│       └── test_api.cpp             # Integration tests for REST endpoints, CORS, errors, and CRUD
├── docs/
│   ├── api-contract.md              # REST API specification and JSON schemas
│   └── architecture.md              # In-depth architectural blueprint and theoretical notes
└── frontend/
    ├── index.html                   # HTML entry point
    ├── package.json                 # React 19, TypeScript, Vite & Oxlint scripts
    ├── tsconfig.json                # TypeScript project references
    ├── tsconfig.app.json            # TypeScript frontend configuration
    ├── vite.config.ts               # Vite configuration with /api proxy to localhost:8080
    ├── public/                      # Static assets and SVG icons
    └── src/
        ├── App.tsx                  # Main application orchestrator & live state lifecycle
        ├── App.css                  # UI workspace, sidebar, modals, and canvas styling
        ├── index.css                # Base design tokens and typography
        ├── main.tsx                 # React DOM mount point
        ├── api/
        │   ├── client.ts            # Typed HTTP client supporting VITE_API_BASE_URL & proxy
        │   └── types.ts             # TypeScript interfaces for API schemas and DTOs
        ├── components/
        │   ├── editor/              # Node Inspector, Add/Edit/Delete modals, QuickInfoBar
        │   ├── layout/              # Responsive Navigation Bar with live status pill
        │   ├── traversal/           # Preorder/Inorder/Postorder stepper controls & summary
        │   └── tree/                # Custom SVG TreeCanvas layout renderer
        └── utils/
            ├── binaryTraversal.ts   # Client-side traversal calculator for offline fallback
            ├── layoutEngine.ts      # Mathematical coordinate layout engine for SVG canvas
            └── treeMutation.ts      # Client-side tree update algorithms and impact analyzer
```

---

## 13. Known Limitations

* **File-Based Backend Storage:** JSON snapshots persist changes across process restarts. Cloud redeployments require a mounted persistent disk configured through `DATA_DIR`; database and concurrent-writer support are not implemented.
* **Root-Deletion Protection:** The compatibility `DELETE /api/hierarchy/member` route and its inspector dialog reject root deletion. The newer `DELETE /api/hierarchy/nodes/:id` route permits it for the explicit Clear hierarchy workflow.
* **No Automated Browser Testing:** The repository does not include automated end-to-end browser test suites (e.g., Playwright or Cypress). The frontend UI is verified through interactive manual browser testing, complemented by automated C++ engine unit tests, REST contract tests, Oxlint linting, and TypeScript compilation checks.
* **Single-Threaded Architecture:** On Windows, MinGW.org GCC 6.3 operates on the `win32` threading model and does not provide standard `<thread>`. The backend HTTP server is purposefully implemented with a portable single-threaded, non-blocking `select()` event loop to ensure clean, identical execution across both local MinGW Windows environments and Render Linux container environments without external runtime dependencies.
* **LCRS Child Insertion:** Member creation adds nodes exclusively as direct subordinate children (`relation: "child"`). Sibling relationships are maintained and linked internally by the LCRS data structure.
* **Binary Tree Height:** The metric `binaryTreeHeight` reported by the `/api/hierarchy/stats` endpoint measures the height of the binary tree representation (including right-sibling links), which is distinct from the conceptual tier depth of the $N$-ary hierarchy.

---

## 14. Troubleshooting & FAQ

### 1. Vite Proxy Error (`502 Bad Gateway` / `ECONNREFUSED`)
* **Symptom:** Terminal displays `[vite] http proxy error: /api/status -> ECONNREFUSED`, or the frontend reports a backend connection error.
* **Cause:** The C++ backend server is not running on port 8080.
* **Solution:** Open a terminal and run `mingw32-make run` in `backend/`. The frontend polls backend health every 10 seconds. Use Retry loading or Refresh to reload hierarchy data after the backend becomes available.

### 2. Port 8080 Already in Use (`WSAEADDRINUSE` / Bind Error 10048)
* **Symptom:** Backend outputs `[HttpServer] bind failed: 10048`.
* **Cause:** A previous server instance or another program is occupying port 8080.
* **Solution:** In PowerShell, identify and terminate the process holding the port:
  ```powershell
  # Find the process ID (PID) using port 8080
  netstat -ano | findstr :8080

  # Terminate the process (replace <PID> with the actual process ID)
  Stop-Process -Id <PID> -Force
  ```

### 3. `mingw32-make` or `g++` Not Recognized
* **Symptom:** PowerShell reports `'mingw32-make' is not recognized as the name of a cmdlet...`
* **Cause:** MinGW's `bin` folder is not in your system's `PATH` environment variable.
* **Solution:** Add MinGW to your current PowerShell session (adjusting path to your installation):
  ```powershell
  $env:Path += ";C:\MinGW\bin"
  ```
  Or add `C:\MinGW\bin` permanently to your Windows Environment Variables under System Settings.

### 4. How to Reset Tree Data to Defaults
* **Solution:** Export a backup, stop the backend, and move the selected mode's save file (`data/org.json` or `data/family.json`, or its equivalent under `DATA_DIR`) to a backup location. Restart the backend to load that mode's default fixtures.
