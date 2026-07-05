/**
 * Performance utilities for optimization
 */

/**
 * Debounce function
 * Delays execution until after wait time has elapsed since last call
 * 
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function
 * Ensures function is called at most once per specified time period
 * 
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} - Throttled function
 */
export const throttle = (func, limit = 300) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
};

/**
 * RequestIdleCallback wrapper with fallback
 * Executes callback when browser is idle
 * 
 * @param {Function} callback - Function to execute
 * @param {Object} options - Options for requestIdleCallback
 */
export const idleCallback = (callback, options = {}) => {
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, options);
  }
  // Fallback for browsers that don't support requestIdleCallback
  return setTimeout(callback, 1);
};

/**
 * Cancel idle callback
 * 
 * @param {number} id - ID returned from idleCallback
 */
export const cancelIdleCallback = (id) => {
  if ('cancelIdleCallback' in window) {
    window.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
};

/**
 * Preload image
 * 
 * @param {string} src - Image source URL
 * @returns {Promise} - Resolves when image is loaded
 */
export const preloadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * Preload multiple images
 * 
 * @param {string[]} srcs - Array of image URLs
 * @returns {Promise} - Resolves when all images are loaded
 */
export const preloadImages = (srcs) => {
  return Promise.all(srcs.map(preloadImage));
};

/**
 * Prefetch resource
 * Hints browser to fetch resource in background
 * 
 * @param {string} url - URL to prefetch
 * @param {string} as - Resource type (script, style, image, document)
 */
export const prefetchResource = (url, as = 'fetch') => {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  link.as = as;
  document.head.appendChild(link);
};

/**
 * Preload resource
 * Loads resource with high priority
 * 
 * @param {string} url - URL to preload
 * @param {string} as - Resource type
 */
export const preloadResource = (url, as = 'fetch') => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = url;
  link.as = as;
  document.head.appendChild(link);
};

/**
 * Lazy load script
 * 
 * @param {string} src - Script source URL
 * @returns {Promise} - Resolves when script is loaded
 */
export const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
};

/**
 * Get performance metrics
 * 
 * @returns {Object} - Performance metrics
 */
export const getPerformanceMetrics = () => {
  if (!window.performance) {
    return null;
  }

  const navigation = performance.getEntriesByType('navigation')[0];
  
  return {
    // Page load time
    pageLoad: navigation?.loadEventEnd - navigation?.fetchStart,
    
    // DNS lookup time
    dns: navigation?.domainLookupEnd - navigation?.domainLookupStart,
    
    // TCP connection time
    tcp: navigation?.connectEnd - navigation?.connectStart,
    
    // Time to first byte
    ttfb: navigation?.responseStart - navigation?.requestStart,
    
    // Response time
    response: navigation?.responseEnd - navigation?.responseStart,
    
    // DOM processing time
    domProcessing: navigation?.domComplete - navigation?.domLoading,
    
    // DOM content loaded
    domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.fetchStart,
    
    // Total resources
    resources: performance.getEntriesByType('resource').length,
  };
};

/**
 * Log performance metrics to console
 */
export const logPerformanceMetrics = () => {
  const metrics = getPerformanceMetrics();
  if (!metrics) return;

  console.group('⚡ Performance Metrics');
  console.log('Page Load:', `${metrics.pageLoad?.toFixed(2)}ms`);
  console.log('DNS Lookup:', `${metrics.dns?.toFixed(2)}ms`);
  console.log('TCP Connection:', `${metrics.tcp?.toFixed(2)}ms`);
  console.log('TTFB:', `${metrics.ttfb?.toFixed(2)}ms`);
  console.log('Response:', `${metrics.response?.toFixed(2)}ms`);
  console.log('DOM Processing:', `${metrics.domProcessing?.toFixed(2)}ms`);
  console.log('DOM Content Loaded:', `${metrics.domContentLoaded?.toFixed(2)}ms`);
  console.log('Total Resources:', metrics.resources);
  console.groupEnd();
};

/**
 * Memoize function results
 * Caches function results based on arguments
 * 
 * @param {Function} fn - Function to memoize
 * @returns {Function} - Memoized function
 */
export const memoize = (fn) => {
  const cache = new Map();
  
  return (...args) => {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

/**
 * Check if connection is slow (2G/3G)
 * 
 * @returns {boolean} - True if connection is slow
 */
export const isSlowConnection = () => {
  if (!navigator.connection) {
    return false;
  }
  
  const connection = navigator.connection;
  const slowTypes = ['slow-2g', '2g', '3g'];
  
  return slowTypes.includes(connection.effectiveType);
};

/**
 * Check if user prefers reduced data
 * 
 * @returns {boolean} - True if data saver is enabled
 */
export const isDataSaverEnabled = () => {
  return navigator.connection?.saveData || false;
};

/**
 * Get optimal image quality based on connection
 * 
 * @returns {string} - Quality level (low, medium, high)
 */
export const getOptimalImageQuality = () => {
  if (isDataSaverEnabled() || isSlowConnection()) {
    return 'low';
  }
  
  const connection = navigator.connection;
  if (connection?.effectiveType === '4g') {
    return 'high';
  }
  
  return 'medium';
};

export default {
  debounce,
  throttle,
  idleCallback,
  cancelIdleCallback,
  preloadImage,
  preloadImages,
  prefetchResource,
  preloadResource,
  loadScript,
  getPerformanceMetrics,
  logPerformanceMetrics,
  memoize,
  isSlowConnection,
  isDataSaverEnabled,
  getOptimalImageQuality,
};
