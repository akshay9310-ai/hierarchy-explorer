export type HierarchyMode = 'org' | 'family';

export type TraversalType = 'preorder' | 'inorder' | 'postorder';

export interface BackendStatus {
  status: string;
  service: string;
  version: string;
  compiler: string;
  networking: string;
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
