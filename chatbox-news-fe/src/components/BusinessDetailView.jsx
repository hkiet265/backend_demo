import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Heart, MapPin, Phone, Globe, Mail, Users, Briefcase,
  ShieldCheck, Building2, Trash2
} from 'lucide-react';
import Spinner from './atoms/Spinner';
import CountUp from './CountUp';

const CARD_STYLE = { background: 'var(--bg-panel)', border: '2px solid var(--border-neon)', borderRadius: 'var(--radius-md)' };

// Real trust_score tops out at 60 today (no business has address/social
// filled in yet). Threshold matches the baseline used across the app so
// the "verified" badge isn't an impossible bar.
const VERIFIED_THRESHOLD = 60;

function formatRegionDisplay(region) {
  if (!region) return '';
  const r = region.toLowerCase();
  if (r.includes('bac') || r.includes('bắc')) return 'Bắc';
  if (r.includes('nam')) return 'Nam';
  if (r.includes('trung')) return 'Trung';
  if (r.includes('toan')) return 'Toàn quốc';
  return region;
}

const STATUS_LABEL = { Hoat_dong: 'Đang hoạt động', Cho_xac_minh: 'Chờ xác minh', Tam_ngung: 'Tạm ngưng' };

function DetailRow({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border-neon)', fontSize: '13px' }}>
      <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function StatCard({ icon, color, bg, value, label }) {
  return (
    <div style={{ ...CARD_STYLE, padding: '14px 16px', flex: 1, minWidth: '120px' }}>
      <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
        {icon}
      </div>
      <div style={{ fontSize: '19px', fontWeight: 800 }}>{typeof value === 'number' ? <CountUp value={value} /> : value}</div>
      <div style={{ fontSize: '11.5px', color: 'var(--text-dim)' }}>{label}</div>
    </div>
  );
}

function BusinessDetailView({ businessId, currentUser, onClose, onShowAuth, onDeleted }) {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 900);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/businesses/${businessId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => setBusiness(data?.data || null))
      .catch(() => setBusiness(null))
      .finally(() => setLoading(false));

    fetch(`/api/bookmarks/businesses/${businessId}/count`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => setFavoriteCount(data?.favorite_count || 0))
      .catch(() => setFavoriteCount(0));

    const token = localStorage.getItem('token');
    if (token) {
      fetch(`/api/bookmarks/businesses/check/${businessId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => (r.ok ? r.json() : null))
        .then(data => setIsBookmarked(!!data?.bookmarked))
        .catch(() => {});
    } else {
      setIsBookmarked(false);
    }
  }, [businessId]);

  const handleDelete = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa doanh nghiệp này không?')) return;
    const token = localStorage.getItem('token');
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/businesses/${businessId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Xóa thất bại');
      }
      if (onDeleted) onDeleted(businessId);
      onClose();
    } catch (err) {
      alert('❌ ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleBookmark = async () => {
    const token = localStorage.getItem('token');
    if (!token) { onShowAuth ? onShowAuth('login') : alert('Vui lòng đăng nhập để lưu doanh nghiệp yêu thích'); return; }
    try {
      if (isBookmarked) {
        await fetch(`/api/bookmarks/businesses/${businessId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        setIsBookmarked(false);
        setFavoriteCount(c => Math.max(0, c - 1));
      } else {
        await fetch('/api/bookmarks/businesses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ business_id: businessId })
        });
        setIsBookmarked(true);
        setFavoriteCount(c => c + 1);
      }
    } catch (err) { console.error(err); }
  };

  const modalShellStyle = { maxWidth: '980px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 0, position: 'relative' };

  if (loading) {
    return createPortal(
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" style={modalShellStyle} onClick={(e) => e.stopPropagation()}>
          <div style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Spinner />
            <p style={{ marginTop: '16px', color: 'var(--text-dim)' }}>Đang tải thông tin doanh nghiệp...</p>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (!business) {
    return createPortal(
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" style={modalShellStyle} onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-dim)' }}>Không tìm thấy doanh nghiệp.</p>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const isVerified = (business.trust_score ?? 0) >= VERIFIED_THRESHOLD;
  const tagList = (business.tags || '').split(',').map(t => t.trim()).filter(Boolean);

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={modalShellStyle} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 2 }}><X size={20} /></button>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

      <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
        <div style={{ padding: isMobile ? '16px' : '24px 24px 20px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: '16px' }}>
          <div style={{
            width: isMobile ? '80px' : '96px', height: isMobile ? '80px' : '96px', borderRadius: '16px', background: 'white',
            border: '4px solid white', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0
          }}>
            {business.logo_url ? (
              <img src={business.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              <Building2 size={36} color="var(--color-primary)" />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: isMobile ? '18px' : '22px', fontWeight: 800 }}>{business.name}</h2>
                {isVerified && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: 700, color: '#16A34A', background: '#DCFCE7', padding: '3px 10px', borderRadius: '20px' }}>
                    <ShieldCheck size={12} /> Tin cậy
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                {business.industry && <span style={{ fontSize: '11.5px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: '#DBEAFE', color: '#2563EB' }}>{business.industry}</span>}
                {business.region && <span style={{ fontSize: '11.5px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: 'var(--bg-input)', color: 'var(--text-dim)' }}>{formatRegionDisplay(business.region)}</span>}
              </div>
            </div>
            <button
              onClick={toggleBookmark}
              title={isBookmarked ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
              style={{
                width: '42px', height: '42px', borderRadius: '50%', border: '2px solid var(--border-neon)', background: 'var(--bg-panel)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                color: isBookmarked ? '#EC4899' : 'var(--text-dim)'
              }}
            >
              <Heart size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        <div style={{ padding: isMobile ? '0 16px 16px' : '0 24px 20px', display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px' }}>
          {(business.address || business.location) && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)' }}>
              <MapPin size={14} /> {business.address || business.location}
            </span>
          )}
          {business.phone && (
            <a href={`tel:${business.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)', textDecoration: 'none' }}>
              <Phone size={14} /> {business.phone}
            </a>
          )}
          {business.website && (
            <a href={business.website.startsWith('http') ? business.website : `https://${business.website}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)', textDecoration: 'none' }}>
              <Globe size={14} /> {business.website}
            </a>
          )}
          {business.email && (
            <a href={`mailto:${business.email}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)', textDecoration: 'none' }}>
              <Mail size={14} /> {business.email}
            </a>
          )}
        </div>

        {business.description && (
          <p style={{ margin: 0, padding: isMobile ? '0 16px 20px' : '0 24px 24px', fontSize: '13.5px', lineHeight: 1.6, color: 'var(--text-main)' }}>
            {business.description}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <StatCard icon={<Users size={17} />} color="#2563EB" bg="rgba(37,99,235,0.1)" value={business.nhan_su ?? '—'} label="Nhân sự" />
        <StatCard icon={<Briefcase size={17} />} color="#16A34A" bg="rgba(22,163,74,0.1)" value={business.dang_tuyen ?? 0} label="Đang tuyển dụng" />
        <StatCard icon={<Heart size={17} />} color="#DC2626" bg="rgba(220,38,38,0.1)" value={favoriteCount} label="Lượt yêu thích" />
      </div>

      <div style={{ ...CARD_STYLE, padding: '18px 20px' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 800 }}>Thông tin chi tiết</h3>
          <DetailRow label="Tên doanh nghiệp" value={business.name} />
          <DetailRow label="Số điện thoại" value={business.phone} />
          <DetailRow label="Tỉnh/Thành phố" value={business.location} />
          <DetailRow label="Vùng miền" value={formatRegionDisplay(business.region)} />
          <DetailRow label="Ngành nghề" value={business.industry} />
          <DetailRow label="Quy mô" value={business.scale} />
          <DetailRow label="Website" value={business.website} />
          <DetailRow label="Email" value={business.email} />
          <DetailRow label="Facebook" value={business.facebook} />
          <DetailRow label="Zalo" value={business.zalo} />
          <DetailRow label="LinkedIn" value={business.linkedin} />
          <DetailRow label="Địa chỉ" value={business.address} />
          <DetailRow label="Mã số thuế" value={business.tax_code} />
          <DetailRow label="Ngày thành lập" value={business.founded_date ? new Date(business.founded_date).toLocaleDateString('vi-VN') : null} />
          <DetailRow label="Trạng thái" value={STATUS_LABEL[business.status] || business.status} />
          <DetailRow label="Nguồn dữ liệu" value={business.source} />

          <div style={{ padding: '12px 0 6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-dim)' }}>Độ tin cậy</span>
              <strong>{business.trust_score ?? 0}%</strong>
            </div>
            <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-input)', overflow: 'hidden' }}>
              <div style={{ width: `${business.trust_score ?? 0}%`, height: '100%', background: isVerified ? '#16A34A' : '#D97706', borderRadius: '4px' }} />
            </div>
          </div>

          {tagList.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
              {tagList.map(tag => (
                <span key={tag} style={{ fontSize: '11.5px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', background: 'var(--bg-input)', color: 'var(--text-dim)' }}>{tag}</span>
              ))}
            </div>
          )}

          {currentUser && business.created_by_user_id === currentUser.id && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-neon)' }}>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px',
                  border: 'none', background: '#DC2626', color: 'white', fontSize: '13px', fontWeight: 700,
                  cursor: isDeleting ? 'not-allowed' : 'pointer', opacity: isDeleting ? 0.6 : 1
                }}
              >
                <Trash2 size={14} /> {isDeleting ? 'Đang xóa...' : 'Xóa doanh nghiệp'}
              </button>
            </div>
          )}
      </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default BusinessDetailView;
