# Hierarchy Explorer

An academic Data Structures project demonstrating **Organization and Family Hierarchy Exploration Using Binary Tree Traversals** in C++14 and React.

---

## 1. Project Overview

**Hierarchy Explorer** models hierarchical human organizations (corporations, teams, and genealogical lineages) using strict **Binary Trees** and demonstrates the core traversal algorithms:
* **Preorder Traversal** ($\text{Root} \to \text{Left} \to \text{Right}$)
* **Inorder Traversal** ($\text{Left} \to \text{Root} \to \text{Right}$)
* **Postorder Traversal** ($\text{Left} \to \text{Right} \to \text{Root}$)

The system features:
* **C++14 Backend Engine:** Custom binary tree data structure with Left-Child Right-Sibling (LCRS) representation and a native Windows Sockets 2 (WinSock2) HTTP REST server.
* **React + TypeScript + Vite Frontend:** Interactive SVG visualization canvas displaying node relationships, live mode switching, and traversal controls.

---

## 2. Tree Representation & Theoretical Insights

### Left-Child Right-Sibling (LCRS) Mapping
Real-world organizations and families have $N$-ary branching (e.g., a CEO with 5 direct VPs, or parents with multiple children). To satisfy the academic requirement of using a **Binary Tree**:
* **`left` pointer:** Points to the **First Direct Child** (Subordinate / eldest offspring).
* **`right` pointer:** Points to the **Next Sibling** (Peer colleague at the same level / brother or sister).

### Traversal Semantics on the Binary Tree
1. **Preorder:** Top-down reporting order. Traverses a leader, their entire subordinate branch, and then the leader's siblings.
2. **Postorder:** Bottom-up aggregation order. Processes all subordinates and peers before the leader (ideal for budget/headcount summaries and memory deallocation).
3. **Inorder:**
   > ⚠️ **Important Domain Note:** In an LCRS binary tree, **Inorder traversal does NOT correspond to natural organizational rank or generational ordering.** Because it visits the first child's sub-tree, then the current node, then the sibling chain, the resulting sequence is an interleaving determined strictly by the binary tree topology. Explaining and visualizing this behavior is a core learning objective of this project.

### Family Mode Scope
Real family genealogies are Directed Acyclic Graphs (DAGs) with multiple parents and intermarriages. Version 1 explicitly models a **Rooted Descendant Hierarchy** (Patriarch/Matriarch with children modeled via LCRS) or a **Binary Ancestry Pedigree Tree** (Father on left, Mother on right). Full cyclic genealogy graphs are excluded to preserve binary tree integrity.

---

## 3. Prerequisites

* **C++ Compiler:** MinGW GCC (tested on MinGW.org GCC 6.3.0, 32-bit `i686-pc-mingw32`).
* **Make Utility:** `mingw32-make` or GNU `make`.
* **Node.js & npm:** Node.js v18+ (tested on Node v24.20.0 with npm 11.19.0).
* **OS:** Windows (uses native `ws2_32.lib` for socket networking).

---

## 4. Build and Run Instructions

### A. Backend (C++ REST Server)

Open a terminal in `backend/`:
```powershell
cd backend

# 1. Run unit tests verifying binary tree traversals and constraints
mingw32-make test

# 2. Build the server executable
mingw32-make server

# 3. Start the server (runs on port 8080)
mingw32-make run
```
*The backend starts at `http://localhost:8080/api/status`.*

### B. Frontend (React + Vite)

Open a separate terminal in `frontend/`:
```powershell
cd frontend

# 1. Install dependencies (only needed once)
npm install

# 2. Start the Vite development server with proxy to backend
npm run dev
```
*The web application opens at `http://localhost:5173`.*

---

## 5. API Integration and Persistence

The frontend loads both hierarchy data and statistics from the API. Select a node to add children, edit its details, or delete its descendant branch. Search matches names, roles, departments, and IDs and highlights matching nodes. Export creates a JSON backup; Import replaces the selected mode after confirmation and server validation.

Preorder, inorder, and postorder sequences come from the C++ API. Use Play/Pause, speed selection, Previous/Next, and Reset to follow the sequence on the canvas. Mutations refresh hierarchy data, statistics, and any active traversal. Loading failures show a retry action rather than demo data.

Changes persist in `backend/data/org.json` and `backend/data/family.json` when the server is launched from `backend/`. Keep these files to retain your data between runs. They are excluded from Git. Deletion is permanent unless you have an exported backup; sibling branches are preserved. Deleting the root allows creating a new root through the member form.

### Windows toolchain shortcut

If MinGW is installed under `C:\msys64\ucrt64\bin` but is not on PATH, use:

```powershell
$env:Path = 'C:\msys64\ucrt64\bin;' + $env:Path
mingw32-make server
.\hierarchy_server.exe
```

In the frontend terminal use `npm.cmd run dev` if PowerShell blocks `npm.ps1`.

## 6. Current Implementation Limitations

* **Toolchain Constraints:** MinGW.org GCC 6.3 uses the `win32` thread model, which does not provide `std::thread`. To ensure 100% build compatibility without altering the host environment, the backend uses a native single-threaded WinSock2 event loop with `select()`.
* **JSON Serialization:** Milestone 2 uses lightweight, safely escaped JSON responses without pulling in heavy external JSON libraries.
* **Persistence:** Local JSON snapshots support a single server process; concurrent writers and database transactions are outside the current scope.
* **Scope:** Editing covers member details. Moving branches and undo history are not implemented. Hierarchies are limited to 1000 members; member text fields allow up to 200 UTF-8 bytes.

---

## 7. Project Documentation

* [System Architecture](docs/architecture.md)
* [REST API Contract](docs/api-contract.md)
