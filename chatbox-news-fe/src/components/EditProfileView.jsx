import { useState } from 'react';
import { X, User, Lock, Eye, EyeOff } from 'lucide-react';

function EditProfileView({ currentUser, onClose, onUpdateSuccess }) {
  const [fullName, setFullName] = useState(currentUser?.full_name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
 
    if (!fullName.trim()) {
      setError('Vui lòng nhập họ và tên');
      return;
    }

    if (fullName.trim().length < 2) {
      setError('Họ và tên phải có ít nhất 2 ký tự');
      return;
    }
 
    if (newPassword || confirmPassword || currentPassword) {
      if (!currentPassword) {
        setError('Vui lòng nhập mật khẩu hiện tại');
        return;
      }
      if (!newPassword) {
        setError('Vui lòng nhập mật khẩu mới');
        return;
      }
      if (newPassword.length < 6) {
        setError('Mật khẩu mới phải có ít nhất 6 ký tự');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Mật khẩu xác nhận không khớp');
        return;
      }
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      
      const payload = {
        full_name: fullName.trim(),
        email: currentUser.email,
      };
 
      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      const response = await fetch('http://127.0.0.1:8000/api/auth/update-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Cập nhật thất bại');
      }
 
      localStorage.setItem('user', JSON.stringify(data.user));

      setSuccess('✅ Cập nhật thành công!');
 
      setTimeout(() => {
        onUpdateSuccess(data.user);
        onClose();
      }, 1000);

    } catch (err) {
      setError(err.message || 'Đã xảy ra lỗi không xác định');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content edit-profile-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <h2 className="modal-title">✏️ Chỉnh sửa thông tin</h2>

        {error && (
          <div className="auth-error" style={{ marginBottom: '16px' }}>
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="auth-success" style={{ marginBottom: '16px' }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="edit-profile-form"> 
          <div className="form-group">
            <label>📧 Email (không thể thay đổi)</label>
            <input
              type="email"
              value={currentUser?.email || ''}
              disabled
              className="form-input disabled"
            />
          </div>
 
          <div className="form-group">
            <label>👤 Họ và tên</label>
            <div className="input-with-icon-inline">
             
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nhập họ và tên mới"
                className="form-input"
                required
              />
            </div>
          </div>

          <div className="divider">
            <span>Đổi mật khẩu (tùy chọn)</span>
          </div>
 
          <div className="form-group">
            <label>🔐 Mật khẩu hiện tại</label>
            <div className="input-with-icon-inline">
              
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Nhập mật khẩu hiện tại"
                className="form-input"
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
 
          <div className="form-group">
            <label>🔑 Mật khẩu mới</label>
            <div className="input-with-icon-inline">
             
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                className="form-input"
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
 
          <div className="form-group">
            <label>✅ Xác nhận mật khẩu mới</label>
            <div className="input-with-icon-inline">
              
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                className="form-input"
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-cancel"
              disabled={loading}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={loading}
            >
              {loading ? '⏳ Đang lưu...' : '💾 Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditProfileView;
