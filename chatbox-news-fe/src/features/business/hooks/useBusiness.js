import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/api/client';
import { API_ENDPOINTS } from '@/services/api/endpoints';
import { QUERY_KEYS } from '@/config/queryKeys';

/**
 * Fetch all businesses with filters
 */
export const useBusiness = (filters = {}) => {
  return useQuery({
    queryKey: QUERY_KEYS.BUSINESS.LIST(filters),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ENDPOINTS.BUSINESS, { params: filters });
      return data;
    },
  });
};

/**
 * Fetch paginated businesses
 */
export const usePaginatedBusiness = (page = 1, limit = 10, filters = {}) => {
  return useQuery({
    queryKey: QUERY_KEYS.BUSINESS.PAGINATED(page, limit, filters),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ENDPOINTS.BUSINESS, {
        params: { page, limit, ...filters },
      });
      return data;
    },
    keepPreviousData: true,
  });
};

/**
 * Fetch single business by ID
 */
export const useBusinessDetail = (id) => {
  return useQuery({
    queryKey: QUERY_KEYS.BUSINESS.DETAIL(id),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ENDPOINTS.BUSINESS_BY_ID(id));
      return data;
    },
    enabled: !!id,
  });
};

/**
 * Fetch my businesses
 */
export const useMyBusinesses = () => {
  return useQuery({
    queryKey: QUERY_KEYS.BUSINESS.MY,
    queryFn: async () => {
      const { data } = await apiClient.get(API_ENDPOINTS.MY_BUSINESSES);
      return data;
    },
  });
};

/**
 * Create business
 */
export const useCreateBusiness = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (businessData) => {
      const { data } = await apiClient.post(API_ENDPOINTS.BUSINESS, businessData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BUSINESS.ALL });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BUSINESS.MY });
    },
  });
};

/**
 * Update business
 */
export const useUpdateBusiness = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...businessData }) => {
      const { data } = await apiClient.put(API_ENDPOINTS.BUSINESS_BY_ID(id), businessData);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BUSINESS.DETAIL(variables.id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BUSINESS.ALL });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BUSINESS.MY });
    },
  });
};

/**
 * Delete business
 */
export const useDeleteBusiness = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      await apiClient.delete(API_ENDPOINTS.BUSINESS_BY_ID(id));
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BUSINESS.ALL });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BUSINESS.MY });
    },
  });
};

/**
 * Toggle business bookmark
 */
export const useToggleBusinessBookmark = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ businessId, isBookmarked }) => {
      const endpoint = `/favorites/business/${businessId}`;
      const method = isBookmarked ? 'delete' : 'post';
      const { data } = await apiClient[method](endpoint);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FAVORITES.BUSINESS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BUSINESS.ALL });
    },
  });
};

export default {
  useBusiness,
  usePaginatedBusiness,
  useBusinessDetail,
  useMyBusinesses,
  useCreateBusiness,
  useUpdateBusiness,
  useDeleteBusiness,
  useToggleBusinessBookmark,
};
