import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/api/client';
import { API_ENDPOINTS } from '@/services/api/endpoints';
import { QUERY_KEYS } from '@/config/queryKeys';

/**
 * Fetch favorite news
 */
export const useFavoriteNews = () => {
  return useQuery({
    queryKey: QUERY_KEYS.FAVORITES.NEWS,
    queryFn: async () => {
      const { data } = await apiClient.get(API_ENDPOINTS.FAVORITES_NEWS);
      return data;
    },
  });
};

/**
 * Fetch favorite businesses
 */
export const useFavoriteBusiness = () => {
  return useQuery({
    queryKey: QUERY_KEYS.FAVORITES.BUSINESS,
    queryFn: async () => {
      const { data } = await apiClient.get(API_ENDPOINTS.FAVORITES_BUSINESS);
      return data;
    },
  });
};

/**
 * Add news to favorites
 */
export const useAddNewsToFavorites = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newsId) => {
      const { data } = await apiClient.post(`${API_ENDPOINTS.FAVORITES_NEWS}/${newsId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FAVORITES.NEWS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NEWS.ALL });
    },
  });
};

/**
 * Remove news from favorites
 */
export const useRemoveNewsFromFavorites = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newsId) => {
      await apiClient.delete(`${API_ENDPOINTS.FAVORITES_NEWS}/${newsId}`);
      return newsId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FAVORITES.NEWS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NEWS.ALL });
    },
  });
};

/**
 * Add business to favorites
 */
export const useAddBusinessToFavorites = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (businessId) => {
      const { data } = await apiClient.post(`${API_ENDPOINTS.FAVORITES_BUSINESS}/${businessId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FAVORITES.BUSINESS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BUSINESS.ALL });
    },
  });
};

/**
 * Remove business from favorites
 */
export const useRemoveBusinessFromFavorites = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (businessId) => {
      await apiClient.delete(`${API_ENDPOINTS.FAVORITES_BUSINESS}/${businessId}`);
      return businessId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FAVORITES.BUSINESS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BUSINESS.ALL });
    },
  });
};

export default {
  useFavoriteNews,
  useFavoriteBusiness,
  useAddNewsToFavorites,
  useRemoveNewsFromFavorites,
  useAddBusinessToFavorites,
  useRemoveBusinessFromFavorites,
};
