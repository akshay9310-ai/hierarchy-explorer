import type {
  ApiErrorPayload,
  ApiState,
  BackendStatus,
  HierarchyData,
  HierarchyMode,
  HierarchyStats,
  InsertMemberRequest,
  InsertMemberResponse,
  UpdateMemberRequest,
  UpdateMemberResponse,
  DeleteMemberResponse,
  TraversalResult,
  TraversalType,
} from './types';

/**
 * Centralized API base URL resolver.
 * Defaults to '/api' in local development to route through the Vite proxy (localhost:8080).
 * In production (e.g. deployed on Vercel), uses VITE_API_BASE_URL (pointing to Render C++ backend).
 */
function resolveApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!envUrl) {
    return '/api';
  }
  const clean = envUrl.replace(/\/+$/, '');
  return clean.endsWith('/api') ? clean : `${clean}/api`;
}

const API_BASE = resolveApiBaseUrl();
const DEFAULT_TIMEOUT_MS = 2500;

/**
 * Custom error class for API failures capturing HTTP status and network diagnostics.
 */
export class ApiError extends Error {
  readonly statusCode: number | null;
  readonly isNetworkError: boolean;
  readonly responseBody: unknown;

  constructor(
    message: string,
    statusCode: number | null = null,
    isNetworkError: boolean = false,
    responseBody?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.isNetworkError = isNetworkError;
    this.responseBody = responseBody;
  }
}

/**
 * Runtime schema validator ensuring the payload strictly conforms to BackendStatus
 * per docs/api-contract.md (GET /api/status).
 */
export function isValidBackendStatus(data: unknown): data is BackendStatus {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.status === 'string' &&
    typeof obj.service === 'string' &&
    typeof obj.version === 'string' &&
    typeof obj.compiler === 'string' &&
    typeof obj.networking === 'string'
  );
}

/**
 * Centralized HTTP request utility.
 * Handles timeouts via AbortController, non-2xx status codes, JSON parsing,
 * and proxy connection failures without swallowing errors.
 */
export async function requestJson<T>(
  path: string,
  options?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE}${cleanPath}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...options?.headers,
      },
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(`Request timed out after ${timeoutMs}ms: ${url}`, null, true);
    }
    const message = err instanceof Error ? err.message : 'Network request failed';
    throw new ApiError(`Network connection failure (${url}): ${message}`, null, true);
  } finally {
    clearTimeout(timeoutId);
  }

  // Handle non-2xx responses (including 502 Bad Gateway from Vite proxy when C++ backend is offline)
  if (!response.ok) {
    let errorDetails: unknown = null;
    let message = `HTTP ${response.status} ${response.statusText}`;

    try {
      const text = await response.text();
      try {
        const json = JSON.parse(text) as ApiErrorPayload;
        errorDetails = json;
        if (json && typeof json === 'object') {
          if (json.message) {
            message = String(json.message);
          } else if (json.error) {
            message = String(json.error);
          }
        }
      } catch {
        // Non-JSON error body (e.g. proxy HTML 502/504)
        if (response.status === 502 || response.status === 504) {
          message = 'Backend server is offline or unreachable via proxy';
        }
      }
    } catch {
      // Ignore text extraction failure
    }

    throw new ApiError(message, response.status, false, errorDetails);
  }

  // Parse JSON response body
  try {
    return (await response.json()) as T;
  } catch (err: unknown) {
    const parseMsg = err instanceof Error ? err.message : 'Invalid JSON';
    throw new ApiError(`Failed to parse response JSON from ${url}: ${parseMsg}`, response.status, false);
  }
}

/**
 * Retrieves the C++ WinSock2 backend health status and diagnostics per docs/api-contract.md.
 * Returns a comprehensive ApiState object with distinct loading, success, and error lifecycles.
 */
export async function getBackendStatus(): Promise<ApiState<BackendStatus>> {
  try {
    const data = await requestJson<unknown>('/status');

    if (!isValidBackendStatus(data)) {
      throw new ApiError('Unexpected response format: Missing required BackendStatus fields', 200, false, data);
    }

    return {
      status: 'success',
      data,
      error: null,
      statusCode: 200,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to connect to backend';
    const statusCode = err instanceof ApiError ? err.statusCode : null;

    return {
      status: 'error',
      data: null,
      error: message,
      statusCode,
    };
  }
}

/**
 * Checks connectivity with the C++ WinSock2 backend.
 * Never fakes connection: returns the payload if healthy, or null if offline.
 * Preserved for backward compatibility across the frontend UI.
 */
export async function checkBackendStatus(): Promise<BackendStatus | null> {
  const result = await getBackendStatus();
  return result.data;
}

/**
 * Retrieves the full hierarchy tree data for the specified mode from the C++ backend
 * per docs/api-contract.md (GET /api/hierarchy?mode=org|family).
 */
export async function getHierarchy(mode: HierarchyMode): Promise<ApiState<HierarchyData>> {
  try {
    const data = await requestJson<HierarchyData>(`/hierarchy?mode=${encodeURIComponent(mode)}`);
    return {
      status: 'success',
      data,
      error: null,
      statusCode: 200,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve hierarchy';
    const statusCode = err instanceof ApiError ? err.statusCode : null;
    return {
      status: 'error',
      data: null,
      error: message,
      statusCode,
    };
  }
}

/**
 * Executes a binary tree traversal (preorder, inorder, postorder) on the C++ backend
 * per docs/api-contract.md (GET /api/hierarchy/traverse?mode=org&type=preorder).
 */
export async function getHierarchyTraversal(
  mode: HierarchyMode,
  type: TraversalType
): Promise<ApiState<TraversalResult>> {
  try {
    const data = await requestJson<TraversalResult>(
      `/hierarchy/traverse?mode=${encodeURIComponent(mode)}&type=${encodeURIComponent(type)}`
    );
    return {
      status: 'success',
      data,
      error: null,
      statusCode: 200,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve traversal';
    const statusCode = err instanceof ApiError ? err.statusCode : null;
    return {
      status: 'error',
      data: null,
      error: message,
      statusCode,
    };
  }
}

/**
 * Retrieves aggregate hierarchy statistics and LCRS binary tree height from the C++ backend
 * per docs/api-contract.md (GET /api/hierarchy/stats?mode=org|family).
 */
export async function getHierarchyStats(mode: HierarchyMode): Promise<ApiState<HierarchyStats>> {
  try {
    const data = await requestJson<HierarchyStats>(`/hierarchy/stats?mode=${encodeURIComponent(mode)}`);
    return {
      status: 'success',
      data,
      error: null,
      statusCode: 200,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve stats';
    const statusCode = err instanceof ApiError ? err.statusCode : null;
    return {
      status: 'error',
      data: null,
      error: message,
      statusCode,
    };
  }
}

/**
 * Submits member creation to the C++ backend per docs/api-contract.md (POST /api/hierarchy/member).
 * Correctly parses the wrapper response: { member, mode, totalMembers }.
 */
export async function createBackendMember(
  request: InsertMemberRequest
): Promise<ApiState<InsertMemberResponse>> {
  try {
    const data = await requestJson<InsertMemberResponse>('/hierarchy/member', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    return {
      status: 'success',
      data,
      error: null,
      statusCode: 201,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create member';
    const statusCode = err instanceof ApiError ? err.statusCode : null;

    return {
      status: 'error',
      data: null,
      error: message,
      statusCode,
    };
  }
}

/**
 * Submits member updates to the C++ backend per docs/api-contract.md (PUT /api/hierarchy/member).
 * Parses the wrapper response: { member, mode, totalMembers }.
 */
export async function updateBackendMember(
  request: UpdateMemberRequest
): Promise<ApiState<UpdateMemberResponse>> {
  try {
    const data = await requestJson<UpdateMemberResponse>('/hierarchy/member', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    return {
      status: 'success',
      data,
      error: null,
      statusCode: 200,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update member';
    const statusCode = err instanceof ApiError ? err.statusCode : null;

    return {
      status: 'error',
      data: null,
      error: message,
      statusCode,
    };
  }
}

/**
 * Submits member deletion to the C++ backend per docs/api-contract.md (DELETE /api/hierarchy/member).
 * Safely cascades to all subordinates and rewires LCRS sibling pointers.
 * Parses response: { deletedMemberId, deletedCount, deletedNodeIds, mode, totalMembers }.
 */
export async function deleteBackendMember(
  mode: HierarchyMode,
  id: string
): Promise<ApiState<DeleteMemberResponse>> {
  try {
    const data = await requestJson<DeleteMemberResponse>(
      `/hierarchy/member?mode=${encodeURIComponent(mode)}&id=${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    );

    return {
      status: 'success',
      data,
      error: null,
      statusCode: 200,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete member';
    const statusCode = err instanceof ApiError ? err.statusCode : null;

    return {
      status: 'error',
      data: null,
      error: message,
      statusCode,
    };
  }
}

