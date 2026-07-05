import { useRef, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import './VirtualNewsList.css';

/**
 * Virtual News List Component
 * Efficiently renders large lists by only rendering visible items
 * Perfect for lists with 100+ items
 * 
 * @param {Object} props
 * @param {Array} props.items - News items array
 * @param {Function} props.renderItem - Function to render each item
 * @param {number} props.estimatedItemSize - Estimated height of each item (default: 200)
 * @param {string} props.height - Container height (default: '600px')
 * @param {Function} props.onLoadMore - Callback when reaching end (infinite scroll)
 */
const VirtualNewsList = memo(({
  items = [],
  renderItem,
  estimatedItemSize = 200,
  height = '600px',
  onLoadMore,
}) => {
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedItemSize,
    overscan: 5, // Render 5 extra items outside viewport
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Infinite scroll - load more when near bottom
  const lastItem = virtualItems[virtualItems.length - 1];
  if (lastItem && lastItem.index >= items.length - 5 && onLoadMore) {
    onLoadMore();
  }

  return (
    <div
      ref={parentRef}
      className="virtual-list-container"
      style={{ height, overflow: 'auto' }}
    >
      <div
        className="virtual-list-inner"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          
          return (
            <div
              key={virtualItem.key}
              className="virtual-list-item"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
});

VirtualNewsList.displayName = 'VirtualNewsList';

export default VirtualNewsList;
