export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  LOGOUT: '/auth/logout',
  ME: '/auth/me',

  // News
  NEWS: '/news',
  NEWS_BY_ID: (id) => `/news/${id}`,
  NEWS_SEARCH: '/news/search',

  // Business
  BUSINESS: '/business',
  BUSINESS_BY_ID: (id) => `/business/${id}`,
  MY_BUSINESSES: '/business/my',

  // Chat
  CHAT: '/chat',
  CHAT_MESSAGES: '/chat/messages',

  // Favorites
  FAVORITES_NEWS: '/favorites/news',
  FAVORITES_BUSINESS: '/favorites/business',

  // Notifications
  NOTIFICATIONS: '/notifications',
  ALERTS: '/alerts',

  // Admin
  ADMIN_STATS: '/admin/stats',
  ADMIN_USERS: '/admin/users',
  ADMIN_NEWS: '/admin/news',
  ADMIN_BUSINESS: '/admin/business',
  AUDIT_LOG: '/admin/audit-log',
};

export default API_ENDPOINTS;
