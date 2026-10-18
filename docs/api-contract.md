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
    * `Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS`
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

Only `relation: "child"` is supported. In an empty hierarchy, send `parentId: ""` to create its root. Successful writes are persisted before the response is sent.

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
Preserves structural parent, child, and sibling relationships while updating node attributes. This compatibility endpoint retains limits of 64 UTF-8 bytes for ID and 100 bytes for name, role, and department. Use PATCH for the newer 200-byte limit. Updates and deletions through these compatibility endpoints are also persisted atomically.

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

### 9. Edit Member

`PATCH /api/hierarchy/nodes/:id?mode=org|family`

Send one or more editable fields, for example:

```json
{ "name": "Alex Mercer", "role": "Director", "department": "Engineering" }
```

IDs and relationships cannot be changed through this endpoint. Blank names/roles and unknown fields are rejected. An empty department is allowed. Returns the updated full hierarchy with `200 OK`.

### 10. Delete Member and Descendants

`DELETE /api/hierarchy/nodes/:id?mode=org|family`

Removes the member and their conceptual descendants, preserving the member's next siblings. Deleting the root clears that mode only. Returns the updated hierarchy with `200 OK`; unknown IDs return `404`. URL-encode member IDs in paths.

### 11. Search

`GET /api/hierarchy/search?mode=org|family&q=alex`

Returns `{ "ids": ["node-3"] }`. Matches substrings in ID, name, role, and department; ASCII matching is case-insensitive. Empty queries return no results. Results retain binary preorder.

### 12. Import and Export

- `GET /api/hierarchy/export?mode=org|family` returns the same JSON shape as hierarchy retrieval.
- `POST /api/hierarchy/import?mode=org|family` replaces that mode with a hierarchy JSON body and returns the stored hierarchy.

Import requires `mode`, `rootId`, and `nodes`. Each node requires string `id`, `name`, `role`, and `parentId` (null for the root). `department` is optional. Sibling order follows node array order. Optional `leftChildId` and `rightSiblingId` must agree with the reconstructed tree; exported files round-trip unchanged. Use the exported preorder array when retaining explicit binary pointers.

Files must match the selected mode. Duplicate IDs, missing parents, cycles, disconnected components, malformed JSON, and contradictory pointers are rejected before applying any changes. An empty tree is `{ "mode": "org", "rootId": null, "nodes": [] }`. The UI limits files to 512 KB. The backend permits at most 1000 members, and ID/name/role/department fields are limited to 200 UTF-8 bytes.

### Persistence

The executable loads `data/org.json` and `data/family.json` relative to its working directory, using fixtures only when a save is absent. Set `DATA_DIR` to use another existing parent directory or a cloud persistent-disk mount. Each mutation writes a temporary JSON file and atomically replaces the selected mode's save before updating memory, using Windows file replacement or POSIX rename. A failed disk commit returns `500` and leaves memory unchanged. Invalid existing saves are preserved and disable writes; check the backend console and repair or restore the save file before restarting. Contract tests use isolated in-memory servers or a temporary test directory.

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
* `500 Internal Server Error`: unexpected server failure or storage commit failure; storage failures use `error: "Storage Error"`.

`binaryTreeHeight` is the height of the LCRS binary representation, including right-sibling links.
