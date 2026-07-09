"""
Email Service
Sends transactional emails (password reset, etc.) via SMTP.
If SMTP_HOST is not configured, sends are skipped and logged instead —
lets the forgot-password flow run end-to-end before real credentials exist.
"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

logger = logging.getLogger(__name__)


def send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send an HTML email. Returns True if actually sent, False if skipped/failed."""
    if not settings.SMTP_HOST:
        logger.warning(
            f"SMTP not configured — skipping email send. To: {to_email}, Subject: {subject}\n{html_body}"
        )
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, [to_email], msg.as_string())

        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


def send_password_reset_email(to_email: str, reset_token: str) -> bool:
    reset_link = f"{settings.FRONTEND_BASE_URL}/reset-password?token={reset_token}"
    html_body = f"""
        <p>Bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu cho tài khoản Company gắn với email này.</p>
        <p><a href="{reset_link}">Bấm vào đây để đặt lại mật khẩu</a> (liên kết hết hạn sau 1 giờ).</p>
        <p>Nếu bạn không yêu cầu điều này, hãy bỏ qua email này.</p>
    """
    return send_email(to_email, "Đặt lại mật khẩu Company", html_body)
