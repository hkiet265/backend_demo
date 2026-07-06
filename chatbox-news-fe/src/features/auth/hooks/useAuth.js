import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/api/client';
import { API_ENDPOINTS } from '@/services/api/endpoints';
import { QUERY_KEYS } from '@/config/queryKeys';

/**
 * Get current user
 */
export const useMe = () => {
  return useQuery({
    queryKey: QUERY_KEYS.AUTH.ME,
    queryFn: async () => {
      const { data } = await apiClient.get(API_ENDPOINTS.ME);
      return data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: false, // Don't retry if unauthorized
  });
};

/**
 * Login mutation
 */
export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials) => {
      const { data } = await apiClient.post(API_ENDPOINTS.LOGIN, credentials);
      return data;
    },
    onSuccess: (data) => {
      // Store token
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Set user data in cache
      queryClient.setQueryData(QUERY_KEYS.AUTH.ME, data.user);
    },
  });
};

/**
 * Register mutation
 */
export const useRegister = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData) => {
      const { data } = await apiClient.post(API_ENDPOINTS.REGISTER, userData);
      return data;
    },
    onSuccess: (data) => {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      queryClient.setQueryData(QUERY_KEYS.AUTH.ME, data.user);
    },
  });
};

/**
 * Logout mutation
 */
export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await apiClient.post(API_ENDPOINTS.LOGOUT);
    },
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
      
      // Clear localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
  });
};

/**
 * Check if user is authenticated
 */
export const useIsAuthenticated = () => {
  const { data: user } = useMe();
  return !!user;
};

export default {
  useMe,
  useLogin,
  useRegister,
  useLogout,
  useIsAuthenticated,
};
