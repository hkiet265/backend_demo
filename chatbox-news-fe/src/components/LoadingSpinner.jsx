const LoadingSpinner = ({ fullScreen = false, message = 'Đang tải...' }) => {
  if (fullScreen) {
    return (
      <div className="loading-fullscreen">
        <div className="loading-content">
          <div className="loading-logo">
            <img src="/emtu-avatar.png" alt="Em Tư" className="loading-avatar" />
            <div className="loading-rings">
              <div className="loading-ring"></div>
              <div className="loading-ring"></div>
              <div className="loading-ring"></div>
            </div>
          </div>
          <p className="loading-message">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="loading-inline">
      <div className="loading-spinner">
        <div className="spinner-dot"></div>
        <div className="spinner-dot"></div>
        <div className="spinner-dot"></div>
      </div>
      {message && <p className="loading-text">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;
