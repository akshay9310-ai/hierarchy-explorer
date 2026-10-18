import type {
  HierarchyData,
  TreeNodeDto,
  InsertMemberRequest,
  UpdateMemberRequest,
  DescendantImpact,
} from '../api/types';

/**
 * Returns all descendant IDs of a target node in the LCRS binary tree representation.
 * In Left-Child Right-Sibling trees, descendants are all nodes reachable by descending
 * into targetNode.leftChildId and following all leftChild and rightSibling pointers.
 * The targetNode's own rightSibling is NOT included as it is a peer, not a descendant.
 */
export function getDescendantIds(nodes: TreeNodeDto[], targetNodeId: string): string[] {
  const nodeMap = new Map<string, TreeNodeDto>(nodes.map(n => [n.id, n]));
  const target = nodeMap.get(targetNodeId);
  if (!target || !target.leftChildId) {
    return [];
  }

  const descendantIds: string[] = [];
  const queue: string[] = [target.leftChildId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currId = queue.shift()!;
    if (visited.has(currId)) continue;
    visited.add(currId);
    descendantIds.push(currId);

    const currNode = nodeMap.get(currId);
    if (currNode) {
      if (currNode.leftChildId && nodeMap.has(currNode.leftChildId)) queue.push(currNode.leftChildId);
      if (currNode.rightSiblingId && nodeMap.has(currNode.rightSiblingId)) queue.push(currNode.rightSiblingId);
    }
  }

  return descendantIds;
}

/**
 * Returns full TreeNodeDto records for all descendants of a target node.
 */
export function getDescendantNodes(nodes: TreeNodeDto[], targetNodeId: string): TreeNodeDto[] {
  const ids = new Set(getDescendantIds(nodes, targetNodeId));
  return nodes.filter(n => ids.has(n.id));
}

/**
 * Computes descendant impact analysis for node deletion confirmation.
 */
export function getDescendantImpact(
  nodes: TreeNodeDto[],
  targetNodeId: string,
  rootId: string | null
): DescendantImpact | null {
  const target = nodes.find(n => n.id === targetNodeId);
  if (!target) return null;

  const descendants = getDescendantNodes(nodes, targetNodeId);
  const isRoot = targetNodeId === rootId;

  return {
    targetNode: target,
    descendantCount: descendants.length,
    descendants,
    isRoot,
  };
}

/**
 * Pure function: Inserts a member into an LCRS hierarchy according to the API contract.
 */
export function insertMemberIntoHierarchy(
  hierarchy: HierarchyData,
  request: InsertMemberRequest
): HierarchyData {
  const newNode: TreeNodeDto = {
    id: request.id,
    name: request.name.trim(),
    role: request.role.trim(),
    department: request.department ? request.department.trim() : undefined,
    parentId: request.parentId,
    leftChildId: null,
    rightSiblingId: null,
  };

  // If hierarchy is empty, new node becomes the root
  if (!hierarchy.rootId || hierarchy.nodes.length === 0) {
    return {
      mode: hierarchy.mode,
      rootId: newNode.id,
      nodes: [{ ...newNode, parentId: null }],
    };
  }

  // Deep clone nodes to prevent mutation of existing state
  const clonedNodes: TreeNodeDto[] = hierarchy.nodes.map(n => ({ ...n }));

  if (request.relation === 'child' && request.parentId) {
    const parent = clonedNodes.find(n => n.id === request.parentId);
    if (!parent) {
      throw new Error(`Parent node '${request.parentId}' not found in hierarchy`);
    }

    if (!parent.leftChildId) {
      // First child
      parent.leftChildId = newNode.id;
    } else {
      // Traverse to end of sibling chain
      let curr = clonedNodes.find(n => n.id === parent.leftChildId)!;
      while (curr.rightSiblingId) {
        const next = clonedNodes.find(n => n.id === curr.rightSiblingId);
        if (!next) break;
        curr = next;
      }
      curr.rightSiblingId = newNode.id;
    }
  } else if (request.relation === 'sibling' && request.parentId) {
    // Treat parentId as the reference peer node
    const peerNode = clonedNodes.find(n => n.id === request.parentId);
    if (!peerNode) {
      throw new Error(`Reference node '${request.parentId}' not found in hierarchy`);
    }

    newNode.parentId = peerNode.parentId;
    newNode.rightSiblingId = peerNode.rightSiblingId;
    peerNode.rightSiblingId = newNode.id;
  } else {
    // Default fallback: attach as sibling to root if no parent
    const root = clonedNodes.find(n => n.id === hierarchy.rootId);
    if (root) {
      if (!root.leftChildId) {
        root.leftChildId = newNode.id;
        newNode.parentId = root.id;
      } else {
        let curr = clonedNodes.find(n => n.id === root.leftChildId)!;
        while (curr.rightSiblingId) {
          const next = clonedNodes.find(n => n.id === curr.rightSiblingId);
          if (!next) break;
          curr = next;
        }
        curr.rightSiblingId = newNode.id;
        newNode.parentId = root.id;
      }
    }
  }

  clonedNodes.push(newNode);

  return {
    mode: hierarchy.mode,
    rootId: hierarchy.rootId,
    nodes: clonedNodes,
  };
}

/**
 * Pure function: Updates metadata (name, role, department) of an existing member.
 * Preserves all LCRS structural pointers.
 */
export function updateMemberInHierarchy(
  hierarchy: HierarchyData,
  updates: UpdateMemberRequest
): HierarchyData {
  const clonedNodes: TreeNodeDto[] = hierarchy.nodes.map(node => {
    if (node.id === updates.id) {
      return {
        ...node,
        name: updates.name.trim(),
        role: updates.role.trim(),
        department: updates.department !== undefined ? updates.department.trim() : node.department,
      };
    }
    return { ...node };
  });

  return {
    mode: hierarchy.mode,
    rootId: hierarchy.rootId,
    nodes: clonedNodes,
  };
}

/**
 * Pure function: Deletes a target member and all its descendants from an LCRS hierarchy.
 * Rewires parent leftChild pointers and sibling rightSibling pointers cleanly.
 */
export function deleteMemberFromHierarchy(
  hierarchy: HierarchyData,
  targetNodeId: string
): { updatedHierarchy: HierarchyData; deletedNodeIds: string[] } {
  const targetNode = hierarchy.nodes.find(n => n.id === targetNodeId);
  if (!targetNode) {
    return { updatedHierarchy: hierarchy, deletedNodeIds: [] };
  }

  const descendantIds = getDescendantIds(hierarchy.nodes, targetNodeId);
  const allDeletedSet = new Set<string>([targetNodeId, ...descendantIds]);
  const deletedNodeIds = Array.from(allDeletedSet);

  // If root node is deleted, the entire tree is deleted
  if (targetNodeId === hierarchy.rootId) {
    return {
      updatedHierarchy: {
        mode: hierarchy.mode,
        rootId: null,
        nodes: [],
      },
      deletedNodeIds,
    };
  }

  // Filter out deleted nodes and clone remaining
  const remainingNodes: TreeNodeDto[] = hierarchy.nodes
    .filter(n => !allDeletedSet.has(n.id))
    .map(n => ({ ...n }));

  // Pointer rewiring:
  // 1. If targetNode was a parent's leftChildId, rewire parent.leftChildId to targetNode.rightSiblingId
  for (const node of remainingNodes) {
    if (node.leftChildId === targetNodeId) {
      node.leftChildId = targetNode.rightSiblingId ?? null;
    }
  }

  // 2. If targetNode was another node's rightSiblingId, rewire that node.rightSiblingId to targetNode.rightSiblingId
  for (const node of remainingNodes) {
    if (node.rightSiblingId === targetNodeId) {
      node.rightSiblingId = targetNode.rightSiblingId ?? null;
    }
  }

  return {
    updatedHierarchy: {
      mode: hierarchy.mode,
      rootId: hierarchy.rootId,
      nodes: remainingNodes,
    },
    deletedNodeIds,
  };
}
