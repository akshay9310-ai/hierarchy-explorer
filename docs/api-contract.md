# Hierarchy Explorer — REST API Contract

## Overview
All endpoints exchange UTF-8 encoded JSON over HTTP.
Default Base URL: `http://localhost:8080/api`

---

## Implemented in Milestone 1

### 1. Health & Server Status
* **Endpoint:** `GET /api/status`
* **Purpose:** Allows frontend and tests to verify backend connectivity.
* **Response `200 OK`:**
```json
{
  "status": "ok",
  "service": "Hierarchy Explorer Backend",
  "version": "1.0.0-m1",
  "compiler": "GCC 6.3.0 C++14",
  "networking": "WinSock2"
}
```

### 2. CORS Preflight
* **Method:** `OPTIONS *`
* **Response `204 No Content`:**
  * Headers:
    * `Access-Control-Allow-Origin: *`
    * `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
    * `Access-Control-Allow-Headers: Content-Type, Authorization`

---

## Planned Endpoints (Milestones 2 & Beyond)

*The endpoints below represent the agreed API contract for upcoming milestones. They are not yet active in Milestone 1.*

### 3. Retrieve Hierarchy
* **Endpoint:** `GET /api/hierarchy?mode=org|family`
* **Response `200 OK`:**
```json
{
  "mode": "org",
  "rootId": "node-1",
  "nodes": [
    {
      "id": "node-1",
      "name": "Sarah Connor",
      "role": "CEO",
      "department": "Executive",
      "parentId": null,
      "leftChildId": "node-2",
      "rightSiblingId": null
    }
  ]
}
```

### 4. Insert Member
* **Endpoint:** `POST /api/hierarchy/member`
* **Request Body:**
```json
{
  "mode": "org",
  "id": "node-3",
  "name": "Alex Mercer",
  "role": "Lead Architect",
  "department": "Engineering",
  "parentId": "node-2",
  "relation": "child"
}
```
* **Response `201 Created` / `400 Bad Request` / `409 Conflict` (cycle or duplicate)**

### 5. Execute Traversals
* **Endpoint:** `GET /api/hierarchy/traverse?mode=org&type=preorder|inorder|postorder`
* **Response `200 OK`:**
```json
{
  "mode": "org",
  "type": "preorder",
  "order": [
    { "step": 1, "id": "node-1", "name": "Sarah Connor", "role": "CEO" }
  ],
  "totalNodes": 1
}
```

### 6. Hierarchy Statistics
* **Endpoint:** `GET /api/hierarchy/stats?mode=org`
* **Response `200 OK`:**
```json
{
  "totalMembers": 1,
  "binaryTreeHeight": 1,
  "rootId": "node-1"
}
```
