import type { ApiErrorPayload, ApiState, BackendStatus, HierarchyData, HierarchyMode, HierarchyStats, TraversalResult, TraversalType } from './types';

export const getHierarchy = (mode: HierarchyMode) => requestJson<HierarchyData>(`/hierarchy?mode=${mode}`);
export const getStats = (mode: HierarchyMode) => requestJson<HierarchyStats>(`/hierarchy/stats?mode=${mode}`);
export const getTraversal = (mode: HierarchyMode, type: TraversalType) => requestJson<TraversalResult>(`/hierarchy/traverse?mode=${mode}&type=${type}`);
export const searchMembers = (mode: HierarchyMode, query: string) => requestJson<{ ids: string[] }>(`/hierarchy/search?mode=${mode}&q=${encodeURIComponent(query)}`);
export const exportHierarchy = (mode: HierarchyMode) => requestJson<HierarchyData>(`/hierarchy/export?mode=${mode}`);
export const importHierarchy = (mode: HierarchyMode, body: string) => requestJson<HierarchyData>(`/hierarchy/import?mode=${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, timeoutMs: 10000 });
export const addMember = (mode: HierarchyMode, member: { id: string; name: string; role: string; department: string; parentId: string }) => requestJson('/hierarchy/member', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...member, mode, relation: 'child' }) });
export const editMember = (mode: HierarchyMode, id: string, fields: { name: string; role: string; department: string }) => requestJson<HierarchyData>(`/hierarchy/nodes/${encodeURIComponent(id)}?mode=${mode}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) });
export const deleteMember = (mode: HierarchyMode, id: string) => requestJson<HierarchyData>(`/hierarchy/nodes/${encodeURIComponent(id)}?mode=${mode}`, { method: 'DELETE' });

// Centralized relative base path per Vite proxy configuration
const API_BASE = '/api';
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
