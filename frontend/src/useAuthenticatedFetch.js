import { useCallback } from 'react';
import { useAuth } from './AuthContext';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5001' : '';

export function useAuthenticatedFetch() {
  const { token, logout } = useAuth();

  const authenticatedFetch = useCallback(async (url, options = {}) => {
    if (!token) {
      throw new Error('No authentication token');
    }

    // Add cache-busting query parameter to prevent browser caching
    const cacheBuster = `_t=${Date.now()}`;
    const separator = url.includes('?') ? '&' : '?';
    const urlWithCacheBuster = `${url}${separator}${cacheBuster}`;

    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };

    const response = await fetch(`${API_BASE}${urlWithCacheBuster}`, {
      ...options,
      headers,
      cache: 'no-store', // Prevent browser caching
    });

    // If unauthorized, logout user
    if (response.status === 401) {
      logout();
      throw new Error('Session expired. Please login again.');
    }

    return response;
  }, [token, logout]);

  return authenticatedFetch;
}
