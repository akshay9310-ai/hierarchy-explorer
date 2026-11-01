# Hierarchy Explorer — System Architecture

## 1. Project Overview
**Hierarchy Explorer** is an academic Data Structures full-stack application designed to explore, manipulate, and analyze organizational charts and family hierarchies using **Binary Trees** and the three foundational tree traversals: **Preorder, Inorder, and Postorder**.

The system divides responsibilities between:
1. **Frontend (React + TypeScript + Vite):** Interactive visualization, hierarchy mode switching, traversal step-through animations, and user interactions.
2. **Backend (C++14 Engine + Native WinSock2 HTTP Server):** Core data-structure algorithms, separate in-memory organization and family stores, validation, and JSON REST endpoints.

---

## 2. Theoretical Tree Design: Left-Child Right-Sibling (LCRS)

### 2.1 The Modeling Challenge
A classical binary tree node is constrained to at most two child pointers (`left` and `right`).
However, real-world hierarchies are general $N$-ary trees:
* In a corporation, a VP may manage 6 directors or team leads.
* In a family, a parent may have 3 or more children.

### 2.2 The LCRS Solution
We map arbitrary general trees to strict binary trees via the canonical **Left-Child Right-Sibling (LCRS)** transformation (Knuth's transform):
* **`left` pointer:** Represents the **First Child** (Direct subordinate / eldest offspring).
* **`right` pointer:** Represents the **Next Sibling** (Peer colleague at the same level / brother or sister).

```
   Conceptual Multi-way Tree (N-ary)            LCRS Binary Tree Representation
             [ CEO ]                                        [ CEO ]
          /     |     \                                     /
       [VP1]  [VP2]  [VP3]                               [VP1]
       /                                                 /   \
    [DIR1]                                            [DIR1] [VP2]
                                                               \
                                                              [VP3]
```

### 2.3 Traversals on the Binary Representation
All traversals are implemented directly on the binary tree data structure:
1. **Preorder ($\text{Root} \to \text{Left} \to \text{Right}$):**
   * Visits current node $\to$ First Child $\to$ Next Sibling.
   * *Domain Meaning:* Hierarchical top-down outline. Recursively finishes an entire department/sub-branch before moving to adjacent peer branches.
2. **Postorder ($\text{Left} \to \text{Right} \to \text{Root}$):**
   * Visits all children/subordinates $\to$ all sibling peers $\to$ current leader.
   * *Domain Meaning:* Bottom-up aggregation (e.g., headcount summation, recursive subtree deletion).
3. **Inorder ($\text{Left} \to \text{Root} \to \text{Right}$):**
   * Visits first child $\to$ current node $\to$ next sibling.
   * **Crucial Domain Insight:** *Inorder traversal on an LCRS binary tree does NOT correspond to standard organizational rank or natural family generational order.* It interleaves subordinates, parents, and siblings strictly according to the binary tree topology. Visualizing and explaining this exact behavior is a key academic showcase of data structure abstractions.

### 2.4 Family Mode Scoping
Real family genealogies are Directed Acyclic Graphs (DAGs) with multiple parents and intermarriages. In this academic project:
* **Version 1 Scope:** Focused strictly on a **Rooted Descendant Hierarchy** (Ancestral Patriarch/Matriarch with children modeled via LCRS) or a **Binary Pedigree Tree** (Person with Father on left, Mother on right).
* Non-tree cyclic genealogical graphs are intentionally out of scope to preserve binary tree integrity.

---

## 3. Technology Stack & Environment Compatibility

* **Frontend:**
  * React 19 / TypeScript / Vite
  * Custom SVG Canvas for tree rendering (zero heavy 3rd-party dependencies, exact $(x, y)$ coordinate mapping).
  * Proxy configuration via Vite dev server (`/api` $\to$ `http://localhost:8080`).
* **Backend:**
  * C++14 compiled with MinGW.org GCC 6.3.0 (`-std=c++14 -Wall -Wextra -pedantic`).
  * **Networking:** Native Windows Sockets 2 (`<winsock2.h>`, `-lws2_32`).
  * **Threading Model Note:** MinGW.org GCC 6.3 uses the `win32` thread model, which lacks standard `<thread>` support. The HTTP server is therefore engineered with a robust single-threaded, non-blocking I/O loop using `select()`, avoiding external dependencies and guaranteeing 100% build reliability.

---

## 4. Architectural Boundaries

```
[ Browser / React App ]
         │ (HTTP / JSON via Port 5173 / Proxy)
         ▼
[ WinSock2 REST Server ] (Port 8080)
         │ (C++ Function Calls)
         ▼
[ BinaryTree Engine ]
   ├── TreeNode (id, name, role, left, right)
   ├── Preorder, Inorder, Postorder Traversals
   └── Validation (required identity, duplicate ID, known parent)
```
The Binary Tree engine is strictly isolated from the networking layer, allowing it to be compiled, tested, and verified as a standalone C++ library independently of the web server.

## 5. Milestone 2 Data Flow and Lifecycle

1. The HTTP layer parses the request line, query parameters, headers, and optional JSON body.
2. Routes validate `mode` and select either the organization or family `BinaryTree` instance.
3. The engine performs insertion, lookup, traversal, or metric calculation without depending on HTTP or JSON.
4. The HTTP layer serializes engine results into the DTO shapes documented in `api-contract.md`.

Both hierarchies load validated JSON snapshots on startup, falling back to deterministic fixtures when no save exists. Mutations operate on a candidate tree, atomically commit its JSON snapshot, then swap it into memory. Failed validation or storage leaves the active tree unchanged. Deletion detaches the selected member's right-sibling link before destroying its descendant subtree, preserving peer branches.

The React application fetches hierarchy data and statistics together and refreshes both after mutations. It requests traversal sequences from C++, while local state controls animation, speed, and selection. Search is debounced; stale responses are ignored when the mode, query, or hierarchy changes. Mode switching and tree updates reset playback. Import/export uses the same hierarchy DTO as retrieval.

Binary tree height measures the actual LCRS topology, including right-sibling links; it is not the conceptual hierarchy depth.
