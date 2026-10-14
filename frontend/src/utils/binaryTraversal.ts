import type { HierarchyData, TraversalResult, TraversalStep, TraversalType, TreeNodeDto } from '../api/types';

/**
 * Isolated Client-Side LCRS Binary Traversal Utility
 *
 * Implements the exact Left-Child Right-Sibling binary tree traversal algorithms:
 * - Preorder (N -> L -> R): Node -> Left Subtree -> Right Subtree
 * - Inorder (L -> N -> R): Left Subtree -> Node -> Right Subtree
 * - Postorder (L -> R -> N): Left Subtree -> Right Subtree -> Node
 *
 * NOTE: In LCRS representation, leftChild is the first direct child (subordinate),
 * and rightSibling is the next sibling (peer colleague).
 *
 * Inorder traversal on an LCRS binary tree does NOT correspond to natural hierarchical rank.
 * It strictly follows binary tree topology, interleaving children, parents, and siblings.
 */
export function computeBinaryTraversal(
  hierarchy: HierarchyData | null | undefined,
  type: TraversalType
): TraversalResult {
  const emptyResult: TraversalResult = {
    mode: hierarchy?.mode ?? 'org',
    type,
    order: [],
    totalNodes: 0,
  };

  if (!hierarchy || !hierarchy.rootId || !hierarchy.nodes || hierarchy.nodes.length === 0) {
    return emptyResult;
  }

  // Index nodes by id for O(1) lookup
  const nodeMap = new Map<string, TreeNodeDto>();
  for (const n of hierarchy.nodes) {
    nodeMap.set(n.id, n);
  }

  if (!nodeMap.has(hierarchy.rootId)) {
    return emptyResult;
  }

  const result: TraversalStep[] = [];
  const visited = new Set<string>();

  function preorderHelper(nodeId: string | null | undefined): void {
    if (!nodeId || !nodeMap.has(nodeId) || visited.has(nodeId)) {
      return;
    }
    visited.add(nodeId);
    const node = nodeMap.get(nodeId)!;

    result.push({
      step: result.length + 1,
      id: node.id,
      name: node.name,
      role: node.role,
    });

    preorderHelper(node.leftChildId);
    preorderHelper(node.rightSiblingId);
  }

  function inorderHelper(nodeId: string | null | undefined): void {
    if (!nodeId || !nodeMap.has(nodeId) || visited.has(nodeId)) {
      return;
    }
    visited.add(nodeId);
    const node = nodeMap.get(nodeId)!;

    inorderHelper(node.leftChildId);

    result.push({
      step: result.length + 1,
      id: node.id,
      name: node.name,
      role: node.role,
    });

    inorderHelper(node.rightSiblingId);
  }

  function postorderHelper(nodeId: string | null | undefined): void {
    if (!nodeId || !nodeMap.has(nodeId) || visited.has(nodeId)) {
      return;
    }
    visited.add(nodeId);
    const node = nodeMap.get(nodeId)!;

    postorderHelper(node.leftChildId);
    postorderHelper(node.rightSiblingId);

    result.push({
      step: result.length + 1,
      id: node.id,
      name: node.name,
      role: node.role,
    });
  }

  switch (type) {
    case 'preorder':
      preorderHelper(hierarchy.rootId);
      break;
    case 'inorder':
      inorderHelper(hierarchy.rootId);
      break;
    case 'postorder':
      postorderHelper(hierarchy.rootId);
      break;
  }

  return {
    mode: hierarchy.mode,
    type,
    order: result,
    totalNodes: result.length,
  };
}
