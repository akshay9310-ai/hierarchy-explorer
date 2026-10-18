# Hierarchy Explorer — REST API Contract

## Overview
All endpoints exchange UTF-8 encoded JSON over HTTP.
Default Base URL: `http://localhost:8080/api`

---

## Implemented in Milestone 2

### 1. Health & Server Status
* **Endpoint:** `GET /api/status`
* **Purpose:** Allows frontend and tests to verify backend connectivity.
* **Response `200 OK`:**
```json
{
  "status": "ok",
  "service": "Hierarchy Explorer Backend",
  "version": "2.0.0-m2",
  "compiler": "C++14",
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
* **Response `201 Created`:**
```json
{
  "member": {
    "id": "node-3",
    "name": "Alex Mercer",
    "role": "Lead Architect",
    "department": "Engineering",
    "parentId": "node-2",
    "leftChildId": null,
    "rightSiblingId": null
  },
  "mode": "org",
  "totalMembers": 3
}
```

Only `relation: "child"` is supported. Data is stored in memory and resets when the server restarts.

### 5. Update Member
* **Endpoint:** `PUT /api/hierarchy/member`
* **Request Body:**
```json
{
  "mode": "org",
  "id": "node-3",
  "name": "Alex Mercer",
  "role": "Principal Architect",
  "department": "Infrastructure"
}
```
* **Response `200 OK`:**
```json
{
  "member": {
    "id": "node-3",
    "name": "Alex Mercer",
    "role": "Principal Architect",
    "department": "Infrastructure",
    "parentId": "node-2",
    "leftChildId": null,
    "rightSiblingId": null
  },
  "mode": "org",
  "totalMembers": 3
}
```
Preserves structural parent, child, and sibling relationships while updating node attributes.

### 6. Delete Member
* **Endpoint:** `DELETE /api/hierarchy/member?mode=org|family&id=<memberId>` or `DELETE /api/hierarchy/member` with JSON body `{"mode": "org", "id": "<memberId>"}`
* **Response `200 OK`:**
```json
{
  "deletedMemberId": "node-3",
  "deletedCount": 1,
  "deletedNodeIds": ["node-3"],
  "mode": "org",
  "totalMembers": 2
}
```
* Note: Deleting a node with subordinates safely cascades to all its descendants, re-wiring parent and sibling pointers to prevent orphaned nodes. Root node deletion is structurally rejected with `400 Bad Request`.

### 7. Execute Traversals
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

### 8. Hierarchy Statistics
* **Endpoint:** `GET /api/hierarchy/stats?mode=org`
* **Response `200 OK`:**
```json
{
  "totalMembers": 1,
  "binaryTreeHeight": 1,
  "rootId": "node-1"
}
```

---

## Validation and Errors

All errors use the same JSON shape:
```json
{
  "error": "Invalid Request",
  "message": "mode must be org or family",
  "path": "/api/hierarchy"
}
```

* `400 Bad Request`: malformed JSON, missing fields, invalid `mode`, invalid traversal `type`, or unsupported relation.
* `404 Not Found`: unknown endpoint or insertion parent.
* `405 Method Not Allowed`: known endpoint called with an unsupported method.
* `409 Conflict`: duplicate member ID or insertion conflict.
* `500 Internal Server Error`: unexpected server failure.

`binaryTreeHeight` is the height of the LCRS binary representation, including right-sibling links.
