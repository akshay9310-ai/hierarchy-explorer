import type { BackendStatus } from './types';

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
