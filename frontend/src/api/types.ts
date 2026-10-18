export type HierarchyMode = 'org' | 'family';

export type TraversalType = 'preorder' | 'inorder' | 'postorder';

/**
 * Health & Backend Status Response per docs/api-contract.md (GET /api/status)
 */
export interface BackendStatus {
  status: string;
  service: string;
  version: string;
  compiler: string;
  networking: string;
}

/**
 * Structured error payload returned by C++ backend per HttpServer.cpp
 */
export interface ApiErrorPayload {
  error: string;
  message?: string;
  path?: string;
}

/**
 * Common state lifecycle for asynchronous API requests
 */
export type ApiStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export interface ApiState<T> {
  status: ApiStatus;
  data: T | null;
  error: string | null;
  statusCode: number | null;
}

export interface TreeNodeDto {
  id: string;
  name: string;
  role: string;
  department?: string;
  parentId?: string | null;
  leftChildId?: string | null;
  rightSiblingId?: string | null;
}

export interface HierarchyData {
  mode: HierarchyMode;
  rootId: string | null;
  nodes: TreeNodeDto[];
}

export interface HierarchyStats {
  totalMembers: number;
  binaryTreeHeight: number;
  rootId: string | null;
}

export interface TraversalStep {
  step: number;
  id: string;
  name: string;
  role: string;
}

export interface TraversalResult {
  mode: HierarchyMode;
  type: TraversalType;
  order: TraversalStep[];
  totalNodes: number;
}

/**
 * Member insertion payload per docs/api-contract.md (POST /api/hierarchy/member)
 * Note: C++ backend strictly supports relation: "child".
 */
export interface InsertMemberRequest {
  mode: HierarchyMode;
  id: string;
  name: string;
  role: string;
  department?: string;
  parentId: string | null;
  relation: 'child' | 'sibling';
}

/**
 * Structured member insertion response returned by C++ backend
 * per docs/api-contract.md (POST /api/hierarchy/member).
 */
export interface InsertMemberResponse {
  member: TreeNodeDto;
  mode: HierarchyMode;
  totalMembers: number;
}

/**
 * Member update payload per docs/api-contract.md (PUT /api/hierarchy/member)
 */
export interface UpdateMemberRequest {
  mode: HierarchyMode;
  id: string;
  name: string;
  role: string;
  department?: string;
}

/**
 * Structured member update response returned by C++ backend (PUT /api/hierarchy/member)
 */
export interface UpdateMemberResponse {
  member: TreeNodeDto;
  mode: HierarchyMode;
  totalMembers: number;
}

/**
 * Structured member deletion response returned by C++ backend (DELETE /api/hierarchy/member)
 */
export interface DeleteMemberResponse {
  deletedMemberId: string;
  deletedCount: number;
  deletedNodeIds: string[];
  mode: HierarchyMode;
  totalMembers: number;
}

/**
 * Impact summary for node deletion confirmation
 */
export interface DescendantImpact {
  targetNode: TreeNodeDto;
  descendantCount: number;
  descendants: TreeNodeDto[];
  isRoot: boolean;
}
