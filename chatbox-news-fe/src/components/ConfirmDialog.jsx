import { AlertTriangle, X } from 'lucide-react';

const ConfirmDialog = ({ 
  title = 'Xác nhận', 
  message, 
  confirmText = 'OK', 
  cancelText = 'Hủy',
  onConfirm, 
  onCancel,
  type = 'warning'
}) => {
  const icons = {
    warning: <AlertTriangle size={48} style={{ color: '#f59e0b' }} />,
    danger: <AlertTriangle size={48} style={{ color: '#ef4444' }} />,
    info: <AlertTriangle size={48} style={{ color: '#3b82f6' }} />
  };

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="confirm-close" onClick={onCancel}>
          <X size={20} />
        </button>
        
        <div className="confirm-icon">
          {icons[type]}
        </div>
        
        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>
        
        <div className="confirm-actions">
          <button className="confirm-btn confirm-btn-cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button className="confirm-btn confirm-btn-confirm" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
