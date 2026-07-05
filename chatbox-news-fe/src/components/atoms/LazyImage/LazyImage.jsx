import { memo } from 'react';
import { useImageLazyLoad } from '@/hooks/useImageLazyLoad';
import './LazyImage.css';

/**
 * LazyImage Component
 * Automatically lazy loads images when they come into viewport
 * Shows loading state and handles errors gracefully
 * 
 * @param {Object} props
 * @param {string} props.src - Image source URL
 * @param {string} props.alt - Alt text
 * @param {string} props.placeholder - Placeholder image URL
 * @param {string} props.className - Additional CSS classes
 * @param {Function} props.onLoad - Callback when image loads
 * @param {Function} props.onError - Callback when image fails to load
 */
const LazyImage = memo(({ 
  src, 
  alt = '', 
  placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23f0f0f0" width="400" height="300"/%3E%3C/svg%3E',
  className = '',
  onLoad,
  onError,
  ...props 
}) => {
  const { imageSrc, isLoading, error, imgRef } = useImageLazyLoad(src, placeholder);

  const handleLoad = () => {
    if (onLoad) onLoad();
  };

  const handleError = () => {
    if (onError) onError();
  };

  return (
    <div ref={imgRef} className={`lazy-image-wrapper ${className}`}>
      <img
        src={imageSrc}
        alt={alt}
        className={`lazy-image ${isLoading ? 'loading' : 'loaded'} ${error ? 'error' : ''}`}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
        {...props}
      />
      {isLoading && (
        <div className="lazy-image-spinner">
          <div className="spinner-circle"></div>
        </div>
      )}
      {error && (
        <div className="lazy-image-error">
          <span>❌</span>
        </div>
      )}
    </div>
  );
});

LazyImage.displayName = 'LazyImage';

export default LazyImage;
