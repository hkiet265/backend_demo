import { useEffect } from 'react';

/**
 * Hook for tracking Web Vitals performance metrics
 * Tracks: LCP, FID, CLS, FCP, TTFB
 */
export const usePerformanceMonitoring = () => {
  useEffect(() => {
    // Check if browser supports Performance API
    if (!window.performance || !window.PerformanceObserver) {
      console.warn('Performance API not supported');
      return;
    }

    // Track Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      console.log('LCP (Largest Contentful Paint):', lastEntry.renderTime || lastEntry.loadTime);
    });

    try {
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      console.warn('LCP observation not supported');
    }

    // Track First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        console.log('FID (First Input Delay):', entry.processingStart - entry.startTime);
      });
    });

    try {
      fidObserver.observe({ type: 'first-input', buffered: true });
    } catch (e) {
      console.warn('FID observation not supported');
    }

    // Track Cumulative Layout Shift (CLS)
    let clsScore = 0;
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (!entry.hadRecentInput) {
          clsScore += entry.value;
        }
      });
      console.log('CLS (Cumulative Layout Shift):', clsScore);
    });

    try {
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      console.warn('CLS observation not supported');
    }

    // Cleanup
    return () => {
      lcpObserver.disconnect();
      fidObserver.disconnect();
      clsObserver.disconnect();
    };
  }, []);
};

/**
 * Hook for measuring component render time
 * 
 * @param {string} componentName - Name of the component being measured
 */
export const useRenderPerformance = (componentName) => {
  useEffect(() => {
    const startTime = performance.now();

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      if (renderTime > 16) { // More than 1 frame (60fps)
        console.warn(`[Performance] ${componentName} took ${renderTime.toFixed(2)}ms to render`);
      }
    };
  });
};

/**
 * Hook for tracking API call performance
 * 
 * @param {string} apiName - Name of the API endpoint
 * @param {number} duration - Duration in milliseconds
 */
export const useAPIPerformance = (apiName, duration) => {
  useEffect(() => {
    if (duration) {
      if (duration > 3000) {
        console.warn(`[API Performance] ${apiName} took ${duration}ms (SLOW)`);
      } else if (duration > 1000) {
        console.log(`[API Performance] ${apiName} took ${duration}ms (OK)`);
      }
    }
  }, [apiName, duration]);
};

/**
 * Track memory usage (Chrome only)
 */
export const useMemoryMonitoring = () => {
  useEffect(() => {
    if (!performance.memory) {
      return;
    }

    const interval = setInterval(() => {
      const memoryInfo = performance.memory;
      const usedMB = (memoryInfo.usedJSHeapSize / 1048576).toFixed(2);
      const limitMB = (memoryInfo.jsHeapSizeLimit / 1048576).toFixed(2);
      const percentage = ((memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100).toFixed(2);

      if (percentage > 90) {
        console.warn(`[Memory] High memory usage: ${usedMB}MB / ${limitMB}MB (${percentage}%)`);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);
};

export default {
  usePerformanceMonitoring,
  useRenderPerformance,
  useAPIPerformance,
  useMemoryMonitoring,
};
