import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/api/client';
import { API_ENDPOINTS } from '@/services/api/endpoints';
import { QUERY_KEYS } from '@/config/queryKeys';

/**
 * Fetch admin statistics
 */
export const useAdminStats = () => {
  return useQuery({
    queryKey: QUERY_KEYS.ADMIN.STATS,
    queryFn: async () => {
      const { data } = await apiClient.get(API_ENDPOINTS.ADMIN_STATS);
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Fetch admin users with filters
 */
export const useAdminUsers = (filters = {}) => {
  return useQuery({
    queryKey: QUERY_KEYS.ADMIN.USERS(filters),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ENDPOINTS.ADMIN_USERS, {
        params: filters,
      });
      return data;
    },
  });
};

/**
 * Fetch admin news with filters
 */
export const useAdminNews = (filters = {}) => {
  return useQuery({
    queryKey: QUERY_KEYS.ADMIN.NEWS(filters),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ENDPOINTS.ADMIN_NEWS, {
        params: filters,
      });
      return data;
    },
  });
};

/**
 * Fetch admin business with filters
 */
export const useAdminBusiness = (filters = {}) => {
  return useQuery({
    queryKey: QUERY_KEYS.ADMIN.BUSINESS(filters),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ENDPOINTS.ADMIN_BUSINESS, {
        params: filters,
      });
      return data;
    },
  });
};

/**
 * Fetch audit log
 */
export const useAuditLog = (filters = {}) => {
  return useQuery({
    queryKey: QUERY_KEYS.ADMIN.AUDIT_LOG(filters),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ENDPOINTS.AUDIT_LOG, {
        params: filters,
      });
      return data;
    },
  });
};

/**
 * Update user (admin)
 */
export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, ...userData }) => {
      const { data } = await apiClient.put(`/admin/users/${userId}`, userData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.USERS() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.STATS });
    },
  });
};

/**
 * Delete user (admin)
 */
export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId) => {
      await apiClient.delete(`/admin/users/${userId}`);
      return userId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.USERS() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.STATS });
    },
  });
};

/**
 * Approve/Reject news (admin)
 */
export const useModerateNews = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ newsId, action }) => {
      const { data } = await apiClient.post(`/admin/news/${newsId}/moderate`, { action });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN.NEWS() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NEWS.ALL });
    },
  });
};

export default {
  useAdminStats,
  useAdminUsers,
  useAdminNews,
  useAdminBusiness,
  useAuditLog,
  useUpdateUser,
  useDeleteUser,
  useModerateNews,
};
