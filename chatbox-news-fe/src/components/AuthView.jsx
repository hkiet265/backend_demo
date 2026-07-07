import { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, User, Phone } from 'lucide-react';

function AuthView({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
     
    if (!isLogin) {
      if (!fullName.trim()) {
        setError('Vui lòng nhập họ và tên');
        setLoading(false);
        return;
      }
      if (fullName.trim().length < 2) {
        setError('Họ và tên phải có ít nhất 2 ký tự');
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError('Mật khẩu phải có ít nhất 6 ký tự');
        setLoading(false);
        return;
      }
    }

    console.log('🔍 Submitting form...');

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const payload = isLogin 
        ? { email, password }
        : { email, password, full_name: fullName.trim(), phone: phone.trim() || null };

      console.log('📤 Sending payload:', { ...payload, password: '***' });

      const response = await fetch(`${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      console.log('📥 Response:', data);

      if (!response.ok) {
        if (data.detail) {
          if (typeof data.detail === 'string') {
            throw new Error(data.detail);
          } else if (Array.isArray(data.detail)) {
            const errorMessage = data.detail.map(err => {
              const field = err.loc ? err.loc[err.loc.length - 1] : 'field';
              return `${field}: ${err.msg}`;
            }).join(', ');
            throw new Error(errorMessage);
          }
        }
        throw new Error('Đã xảy ra lỗi khi ' + (isLogin ? 'đăng nhập' : 'đăng ký'));
      }
 
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      console.log('✅ Auth success, calling callback...');
 
      setSuccess(isLogin ? 'Đăng nhập thành công!' : 'Đăng ký thành công!');
 
      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        }
      }, 500);

    } catch (err) {
      console.error('❌ Error:', err);
      setError(err.message || 'Đã xảy ra lỗi không xác định');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setSuccess('');
    setEmail('');
    setPassword('');
    setFullName('');
    setPhone('');
  };

  return (
    <div className="auth-container">
      <div className="auth-card"> 
        <div className="auth-header">
          <div className="auth-logo">
            <img src="/logochatbot.png" alt="Company" className="auth-avatar" />
          </div>
          <h2>{isLogin ? 'Đăng nhập' : 'Đăng ký'}</h2>
          <p>
            {isLogin 
              ? 'chào mừng bạn đến với Company' 
              : 'Tạo tài khoản mới để sử dụng Company'}
          </p>
        </div>
 
        {error && (
          <div className="auth-error">
            ⚠️ {error}
          </div>
        )}
 
        {success && (
          <div className="auth-success">
            ✅ {success}
          </div>
        )}
 
        <form onSubmit={handleSubmit} className="auth-form">         
          <div className="auth-input-group">
            <label>Email</label>
            <div className="auth-input-wrapper">
              <Mail size={20} className="auth-input-icon" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>
          </div>
 
          {!isLogin && (
            <div className="auth-input-group">
              <label>Họ và tên</label>
              <div className="auth-input-wrapper">
                <User size={20} className="auth-input-icon" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="nhập tên của bạn"
                  required
                />
              </div>
            </div>
          )}
 
          {!isLogin && (
            <div className="auth-input-group">
              <label>Số điện thoại (tùy chọn)</label>
              <div className="auth-input-wrapper">
                <Phone size={20} className="auth-input-icon" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="nhập số điện thoại của bạn"
                />
              </div>
            </div>
          )}
 
          <div className="auth-input-group">
            <label>Mật khẩu</label>
            <div className="auth-input-wrapper">
              <Lock size={20} className="auth-input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="auth-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>
 
          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? '⏳ Đang xử lý...' : (isLogin ? 'Đăng nhập' : 'Đăng ký')}
          </button>
        </form>
 
        <div className="auth-footer">
          <p>
            {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
            <button type="button" onClick={toggleMode} className="auth-toggle-btn">
              {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default AuthView;
