import type { BackendStatus, HierarchyMode, TraversalResult, TraversalType } from './types';

const API_BASE = '/api';

/**
 * Checks connectivity with the C++ WinSock2 backend.
 * Never fakes connection: returns the payload if healthy, or throws/returns null if offline.
 */
export async function checkBackendStatus(): Promise<BackendStatus | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${API_BASE}/status`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Attempts to retrieve traversal order from the C++ backend if active.
 * Per docs/api-contract.md: GET /api/hierarchy/traverse?mode=org&type=preorder|inorder|postorder
 * Returns null if the backend is offline or endpoint is not yet implemented (404),
 * allowing the frontend to fall back to the isolated client-side traversal utility.
 */
export async function fetchBackendTraversal(
  mode: HierarchyMode,
  type: TraversalType
): Promise<TraversalResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const response = await fetch(`${API_BASE}/hierarchy/traverse?mode=${mode}&type=${type}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}
