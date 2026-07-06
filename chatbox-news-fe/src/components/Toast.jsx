import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

/**
 * Toast Notification Component
 * Shows temporary notifications to users
 * 
 * @param {Object} props
 * @param {string} props.message - Toast message
 * @param {string} props.type - Toast type: 'success', 'error', 'info'
 * @param {Function} props.onClose - Callback when toast closes
 * @param {number} props.duration - Auto-close duration in ms (default: 3000)
 */
const Toast = ({ message, type = 'info', onClose, duration = 3000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        if (onClose) onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} />;
      case 'error':
        return <AlertCircle size={20} />;
      case 'info':
      default:
        return <Info size={20} />;
    }
  };

  const getTypeClass = () => {
    switch (type) {
      case 'success':
        return 'toast-success';
      case 'error':
        return 'toast-error';
      case 'info':
      default:
        return 'toast-info';
    }
  };

  return (
    <div className={`toast ${getTypeClass()}`}>
      <div className="toast-icon">
        {getIcon()}
      </div>
      <div className="toast-message">
        {message}
      </div>
      {onClose && (
        <button 
          className="toast-close" 
          onClick={onClose}
          aria-label="Close notification"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export default Toast;
