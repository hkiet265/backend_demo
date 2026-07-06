/**
 * Centralized query keys for React Query
 * Helps with cache invalidation and organization
 */

export const QUERY_KEYS = {
  // Auth
  AUTH: {
    ME: ['auth', 'me'],
    USER: (id) => ['auth', 'user', id],
  },

  // News
  NEWS: {
    ALL: ['news'],
    LIST: (filters) => ['news', 'list', filters],
    DETAIL: (id) => ['news', 'detail', id],
    SEARCH: (query) => ['news', 'search', query],
    PAGINATED: (page, limit, filters) => ['news', 'paginated', { page, limit, ...filters }],
  },

  // Business
  BUSINESS: {
    ALL: ['business'],
    LIST: (filters) => ['business', 'list', filters],
    DETAIL: (id) => ['business', 'detail', id],
    MY: ['business', 'my'],
    PAGINATED: (page, limit, filters) => ['business', 'paginated', { page, limit, ...filters }],
  },

  // Favorites
  FAVORITES: {
    NEWS: ['favorites', 'news'],
    BUSINESS: ['favorites', 'business'],
  },

  // Chat
  CHAT: {
    MESSAGES: (chatId) => ['chat', 'messages', chatId],
    HISTORY: ['chat', 'history'],
  },

  // Notifications
  NOTIFICATIONS: {
    ALL: ['notifications'],
    UNREAD_COUNT: ['notifications', 'unread-count'],
  },

  // Alerts
  ALERTS: {
    ALL: ['alerts'],
    UNREAD_COUNT: ['alerts', 'unread-count'],
  },

  // Admin
  ADMIN: {
    STATS: ['admin', 'stats'],
    USERS: (filters) => ['admin', 'users', filters],
    NEWS: (filters) => ['admin', 'news', filters],
    BUSINESS: (filters) => ['admin', 'business', filters],
    AUDIT_LOG: (filters) => ['admin', 'audit-log', filters],
  },
};

export default QUERY_KEYS;
