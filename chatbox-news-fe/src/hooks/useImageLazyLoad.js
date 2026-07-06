import { useState, useEffect } from 'react';
import { useIntersectionObserver } from './useIntersectionObserver';

/**
 * Hook for lazy loading images
 * Only loads image when it's visible in viewport
 * 
 * @param {string} src - Image source URL
 * @param {string} placeholder - Placeholder image URL (optional)
 * @returns {Object} - { imageSrc, isLoading, error, imgRef }
 */
export const useImageLazyLoad = (src, placeholder = '') => {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [imgRef, isIntersecting, hasIntersected] = useIntersectionObserver({
    threshold: 0.01,
    rootMargin: '200px', // Start loading 200px before visible
  });

  useEffect(() => {
    // Only load image when it has been visible
    if (!hasIntersected || !src) return;

    setIsLoading(true);
    setError(null);

    const img = new Image();
    
    img.onload = () => {
      setImageSrc(src);
      setIsLoading(false);
    };

    img.onerror = () => {
      setError('Failed to load image');
      setIsLoading(false);
    };

    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, hasIntersected]);

  return { imageSrc, isLoading, error, imgRef };
};

export default useImageLazyLoad;
