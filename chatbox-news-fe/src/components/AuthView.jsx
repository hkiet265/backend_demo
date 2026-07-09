import { useState, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock, User, Phone } from 'lucide-react';

const REMEMBER_KEY = 'remembered_credentials';

function AuthView({ onLoginSuccess, initialMode }) {
  const [mode, setMode] = useState(initialMode || 'login'); // login | register | forgot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Prefill from a previous "remember me" login
  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      try {
        const { email: savedEmail, password: savedPassword } = JSON.parse(saved);
        setEmail(savedEmail || '');
        setPassword(savedPassword || '');
        setRememberMe(true);
      } catch (e) { /* ignore malformed saved data */ }
    }
  }, []);

  const isLogin = mode === 'login';
  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';

  const resetFields = () => {
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setPhone('');
    setAgreedToTerms(false);
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    resetFields();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isForgot) {
      try {
        const response = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Có lỗi xảy ra');
        setSuccess(data.message || 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (isRegister) {
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
      if (password !== confirmPassword) {
        setError('Xác nhận mật khẩu không khớp');
        setLoading(false);
        return;
      }
      if (!agreedToTerms) {
        setError('Vui lòng đồng ý với điều khoản sử dụng');
        setLoading(false);
        return;
      }
    }

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const payload = isLogin
        ? { email, password }
        : { email, password, full_name: fullName.trim(), phone: phone.trim() || null };

      const response = await fetch(`${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

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

      // "Ghi nhớ đăng nhập": only login mode saves credentials for autofill next time
      if (isLogin) {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email, password }));
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
      }

      setSuccess(isLogin ? 'Đăng nhập thành công!' : 'Đăng ký thành công!');

      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        }
      }, 500);

    } catch (err) {
      setError(err.message || 'Đã xảy ra lỗi không xác định');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: isRegister ? '680px' : '420px' }}>
        <div className="auth-header">
          <div className="auth-logo">
            <img src="/logochatbot.png" alt="Company" className="auth-avatar" />
          </div>
          <h2>{isLogin ? 'Đăng nhập' : isRegister ? 'Đăng ký' : 'Quên mật khẩu'}</h2>
          <p>
            {isLogin
              ? 'Chào mừng bạn trở lại với Company'
              : isRegister
                ? 'Tạo tài khoản mới để sử dụng Company'
                : 'Nhập email để nhận hướng dẫn đặt lại mật khẩu'}
          </p>
        </div>

        {error && <div className="auth-error">⚠️ {error}</div>}
        {success && <div className="auth-success">✅ {success}</div>}

        {!(isForgot && success) && (
          <form onSubmit={handleSubmit} className="auth-form">
            {isRegister ? (
              <div className="auth-form-row">
                <div className="auth-input-group">
                  <label>Email</label>
                  <div className="auth-input-wrapper">
                    <Mail size={20} className="auth-input-icon" />
                    <input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required />
                  </div>
                </div>
                <div className="auth-input-group">
                  <label>Họ và tên</label>
                  <div className="auth-input-wrapper">
                    <User size={20} className="auth-input-icon" />
                    <input type="text" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Họ và tên" required />
                  </div>
                </div>
              </div>
            ) : (
              <div className="auth-input-group">
                <label>Email</label>
                <div className="auth-input-wrapper">
                  <Mail size={20} className="auth-input-icon" />
                  <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required />
                </div>
              </div>
            )}

            {isRegister && (
              <div className="auth-form-row">
                <div className="auth-input-group">
                  <label>Số điện thoại (tùy chọn)</label>
                  <div className="auth-input-wrapper">
                    <Phone size={20} className="auth-input-icon" />
                    <input type="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Số điện thoại" />
                  </div>
                </div>
                <div className="auth-input-group">
                  <label>Mật khẩu</label>
                  <div className="auth-input-wrapper">
                    <Lock size={20} className="auth-input-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mật khẩu"
                      required
                    />
                    <button type="button" className="auth-toggle-password" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isRegister && (
              <div className="auth-input-group">
                <label>Xác nhận mật khẩu</label>
                <div className="auth-input-wrapper">
                  <Lock size={20} className="auth-input-icon" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    required
                  />
                  <button type="button" className="auth-toggle-password" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            )}

            {isLogin && (
              <div className="auth-input-group">
                <label>Mật khẩu</label>
                <div className="auth-input-wrapper">
                  <Lock size={20} className="auth-input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" className="auth-toggle-password" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            )}

            {isLogin && (
              <div className="auth-row-between">
                <label className="auth-checkbox-label">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                  Ghi nhớ đăng nhập
                </label>
                <button type="button" className="auth-forgot-link" onClick={() => switchMode('forgot')}>
                  Quên mật khẩu?
                </button>
              </div>
            )}

            {isRegister && (
              <label className="auth-checkbox-label">
                <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
                Tôi đồng ý với <strong>&nbsp;điều khoản sử dụng</strong>
              </label>
            )}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? '⏳ Đang xử lý...' : isLogin ? 'Đăng nhập' : isRegister ? 'Đăng ký' : 'Gửi hướng dẫn đặt lại mật khẩu'}
            </button>
          </form>
        )}

        {isLogin && (
          <>
            <div className="auth-divider">hoặc</div>
            <div className="auth-footer" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
              <p>
                Chưa có tài khoản?
                <button type="button" onClick={() => switchMode('register')} className="auth-toggle-btn">Đăng ký ngay</button>
              </p>
            </div>
          </>
        )}

        {isRegister && (
          <div className="auth-footer">
            <p>
              Đã có tài khoản?
              <button type="button" onClick={() => switchMode('login')} className="auth-toggle-btn">Đăng nhập</button>
            </p>
          </div>
        )}

        {isForgot && (
          <div className="auth-footer">
            <p>
              Đã nhớ mật khẩu?
              <button type="button" onClick={() => switchMode('login')} className="auth-toggle-btn">Đăng nhập</button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuthView;
