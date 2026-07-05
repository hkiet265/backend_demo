import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook for Intersection Observer
 * Perfect for lazy loading images, infinite scroll, and tracking visibility
 * 
 * @param {Object} options - Intersection Observer options
 * @param {number} options.threshold - Visibility threshold (0-1)
 * @param {string} options.root - Root element selector
 * @param {string} options.rootMargin - Root margin (e.g., "100px")
 * @returns {[React.RefObject, boolean]} - [ref, isIntersecting]
 */
export const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const targetRef = useRef(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
      
      // Track if element has ever been visible (useful for lazy loading)
      if (entry.isIntersecting && !hasIntersected) {
        setHasIntersected(true);
      }
    }, {
      threshold: options.threshold || 0,
      root: options.root || null,
      rootMargin: options.rootMargin || '0px',
    });

    observer.observe(target);

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [options.threshold, options.root, options.rootMargin, hasIntersected]);

  return [targetRef, isIntersecting, hasIntersected];
};

/**
 * Hook for infinite scroll implementation
 * 
 * @param {Function} callback - Function to call when reaching bottom
 * @param {boolean} hasMore - Whether there are more items to load
 * @param {boolean} isLoading - Whether currently loading
 * @returns {React.RefObject} - Ref to attach to sentinel element
 */
export const useInfiniteScroll = (callback, hasMore, isLoading) => {
  const [sentinelRef, isIntersecting] = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '100px',
  });

  useEffect(() => {
    if (isIntersecting && hasMore && !isLoading) {
      callback();
    }
  }, [isIntersecting, hasMore, isLoading, callback]);

  return sentinelRef;
};

export default useIntersectionObserver;
