import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/api/client';
import { API_ENDPOINTS } from '@/services/api/endpoints';
import { QUERY_KEYS } from '@/config/queryKeys';

/**
 * Fetch all news with filters
 */
export const useNews = (filters = {}) => {
  return useQuery({
    queryKey: QUERY_KEYS.NEWS.LIST(filters),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ENDPOINTS.NEWS, { params: filters });
      return data;
    },
  });
};

/**
 * Fetch paginated news
 */
export const usePaginatedNews = (page = 1, limit = 10, filters = {}) => {
  return useQuery({
    queryKey: QUERY_KEYS.NEWS.PAGINATED(page, limit, filters),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ENDPOINTS.NEWS, {
        params: { page, limit, ...filters },
      });
      return data;
    },
    keepPreviousData: true, // Keep previous data while fetching new page
  });
};

/**
 * Fetch single news by ID
 */
export const useNewsDetail = (id) => {
  return useQuery({
    queryKey: QUERY_KEYS.NEWS.DETAIL(id),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ENDPOINTS.NEWS_BY_ID(id));
      return data;
    },
    enabled: !!id, // Only run if ID exists
  });
};

/**
 * Search news
 */
export const useNewsSearch = (query) => {
  return useQuery({
    queryKey: QUERY_KEYS.NEWS.SEARCH(query),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ENDPOINTS.NEWS_SEARCH, {
        params: { q: query },
      });
      return data;
    },
    enabled: query.length >= 2, // Only search if query has at least 2 characters
    staleTime: 30 * 1000, // 30 seconds
  });
};

/**
 * Create news (admin only)
 */
export const useCreateNews = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newsData) => {
      const { data } = await apiClient.post(API_ENDPOINTS.NEWS, newsData);
      return data;
    },
    onSuccess: () => {
      // Invalidate all news queries to refetch
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NEWS.ALL });
    },
  });
};

/**
 * Update news
 */
export const useUpdateNews = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...newsData }) => {
      const { data } = await apiClient.put(API_ENDPOINTS.NEWS_BY_ID(id), newsData);
      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate specific news and list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NEWS.DETAIL(variables.id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NEWS.ALL });
    },
  });
};

/**
 * Delete news
 */
export const useDeleteNews = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      await apiClient.delete(API_ENDPOINTS.NEWS_BY_ID(id));
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NEWS.ALL });
    },
  });
};

/**
 * Bookmark/Unbookmark news
 */
export const useToggleNewsBookmark = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ newsId, isBookmarked }) => {
      const endpoint = isBookmarked
        ? `/favorites/news/${newsId}`
        : `/favorites/news/${newsId}`;
      const method = isBookmarked ? 'delete' : 'post';
      const { data } = await apiClient[method](endpoint);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FAVORITES.NEWS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NEWS.ALL });
    },
  });
};

export default {
  useNews,
  usePaginatedNews,
  useNewsDetail,
  useNewsSearch,
  useCreateNews,
  useUpdateNews,
  useDeleteNews,
  useToggleNewsBookmark,
};
