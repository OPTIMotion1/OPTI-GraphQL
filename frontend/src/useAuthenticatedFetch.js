import { useAuth } from './AuthContext';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5001' : '';

export function useAuthenticatedFetch() {
  const { token, logout } = useAuth();

  const authenticatedFetch = async (url, options = {}) => {
    if (!token) {
      throw new Error('No authentication token');
    }

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };

    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers,
    });

    // If unauthorized, logout user
    if (response.status === 401) {
      logout();
      throw new Error('Session expired. Please login again.');
    }

    return response;
  };

  return authenticatedFetch;
}
