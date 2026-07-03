"""
CSV Security Service
Validates and sanitizes CSV uploads to prevent malicious content
"""
import re
import logging
from typing import BinaryIO, Dict, Any

logger = logging.getLogger(__name__)


class CSVSecurityService:
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    MAX_ROWS = 10000
    
    DANGEROUS_PATTERNS = [
        r'^=',  # Excel formula
        r'^@',  # Excel formula
        r'^\+',  # Excel formula
        r'^\-',  # Excel formula
        r'<script',  # XSS
        r'javascript:',  # XSS
        r'data:text/html',  # Data URI XSS
        r'<iframe',  # XSS
        r'onerror=',  # XSS
        r'onload=',  # XSS
    ]
    
    def validate_csv_file(self, file: BinaryIO, filename: str) -> Dict[str, Any]:
        """
        Validate CSV file before processing
        
        Args:
            file: File object
            filename: Original filename
            
        Returns:
            dict with validation results
            
        Raises:
            ValueError: If file is invalid or dangerous
        """
        
        # 1. Check file extension
        if not filename.lower().endswith(('.csv', '.txt')):
            raise ValueError(f"File extension không hợp lệ: {filename}. Chỉ chấp nhận .csv hoặc .txt")
        
        # 2. Check file size
        file.seek(0, 2)  # Seek to end
        size = file.tell()
        file.seek(0)  # Reset
        
        if size == 0:
            raise ValueError("File rỗng")
        
        if size > self.MAX_FILE_SIZE:
            max_mb = self.MAX_FILE_SIZE / 1024 / 1024
            raise ValueError(f"File quá lớn ({size / 1024 / 1024:.1f}MB). Tối đa: {max_mb}MB")
        
        # 3. Read and check content
        try:
            content = file.read().decode('utf-8', errors='strict')
        except UnicodeDecodeError:
            file.seek(0)
            try:
                content = file.read().decode('utf-8-sig', errors='strict')
            except UnicodeDecodeError:
                raise ValueError("File không phải định dạng text hợp lệ (UTF-8)")
        
        file.seek(0)  # Reset for later use
        
        # 4. Check number of rows
        lines = content.split('\n')
        row_count = len([line for line in lines if line.strip()])
        
        if row_count > self.MAX_ROWS:
            raise ValueError(f"Quá nhiều dòng ({row_count}). Tối đa: {self.MAX_ROWS} dòng")
        
        # 5. Scan for malicious patterns (first 100 lines only for performance)
        suspicious_lines = []
        for line_no, line in enumerate(lines[:100], 1):
            for pattern in self.DANGEROUS_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    suspicious_lines.append({
                        'line': line_no,
                        'content': line[:100],
                        'pattern': pattern
                    })
        
        if suspicious_lines:
            logger.warning(f"Suspicious patterns found in CSV: {suspicious_lines}")
            raise ValueError(
                f"Phát hiện nội dung nguy hiểm tại dòng {suspicious_lines[0]['line']}: "
                f"{suspicious_lines[0]['content'][:50]}..."
            )
        
        logger.info(f"CSV validation passed: {filename}, size={size}, rows={row_count}")
        
        return {
            "valid": True,
            "size": size,
            "rows": row_count,
            "filename": filename
        }
    
    def sanitize_csv_cell(self, value: str) -> str:
        """
        Sanitize single cell value to prevent injection attacks
        
        Args:
            value: Cell value
            
        Returns:
            Sanitized value
        """
        if not value or not isinstance(value, str):
            return value
        
        # Remove leading/trailing whitespace
        value = value.strip()
        
        if not value:
            return value
        
        # 1. Neutralize formula injection
        if value and value[0] in ['=', '+', '-', '@', '\t', '\r']:
            value = "'" + value  # Prefix with single quote to neutralize
            logger.debug(f"Neutralized potential formula: {value[:20]}")
        
        # 2. Remove HTML tags
        value = re.sub(r'<[^>]+>', '', value)
        
        # 3. Remove javascript: protocol
        value = re.sub(r'javascript:', '', value, flags=re.IGNORECASE)
        
        # 4. Remove data: URIs
        value = re.sub(r'data:[^,]*,', '', value, flags=re.IGNORECASE)
        
        # 5. Remove event handlers
        value = re.sub(r'on\w+\s*=', '', value, flags=re.IGNORECASE)
        
        # 6. Truncate very long values (potential DoS)
        if len(value) > 1000:
            value = value[:1000]
            logger.warning(f"Truncated long value to 1000 chars")
        
        return value
    
    def sanitize_csv_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize entire CSV row
        
        Args:
            row: Dictionary of column:value pairs
            
        Returns:
            Sanitized row
        """
        return {
            key: self.sanitize_csv_cell(str(value)) if value is not None else None
            for key, value in row.items()
        }


# Global instance
_csv_security_service = None


def get_csv_security_service() -> CSVSecurityService:
    """Get or create CSV security service instance"""
    global _csv_security_service
    if _csv_security_service is None:
        _csv_security_service = CSVSecurityService()
    return _csv_security_service
