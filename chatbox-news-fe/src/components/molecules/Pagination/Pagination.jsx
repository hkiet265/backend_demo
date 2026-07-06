import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Pagination.css';

const Pagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange,
  showEllipsis = true 
}) => {
  if (totalPages <= 1) return null;

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(
          <button
            key={i}
            className={`pagination-number ${i === currentPage ? 'active' : ''}`}
            onClick={() => onPageChange(i)}
          >
            {i}
          </button>
        );
      }
    } else {
      // Show pages with ellipsis
      pages.push(
        <button
          key={1}
          className={`pagination-number ${1 === currentPage ? 'active' : ''}`}
          onClick={() => onPageChange(1)}
        >
          1
        </button>
      );

      if (currentPage > 3 && showEllipsis) {
        pages.push(<span key="ellipsis-start" className="pagination-ellipsis">...</span>);
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(
          <button
            key={i}
            className={`pagination-number ${i === currentPage ? 'active' : ''}`}
            onClick={() => onPageChange(i)}
          >
            {i}
          </button>
        );
      }

      if (currentPage < totalPages - 2 && showEllipsis) {
        pages.push(<span key="ellipsis-end" className="pagination-ellipsis">...</span>);
      }

      if (totalPages > 1) {
        pages.push(
          <button
            key={totalPages}
            className={`pagination-number ${totalPages === currentPage ? 'active' : ''}`}
            onClick={() => onPageChange(totalPages)}
          >
            {totalPages}
          </button>
        );
      }
    }

    return pages;
  };

  return (
    <div className="pagination">
      <button
        className="pagination-btn"
        onClick={handlePrevious}
        disabled={currentPage === 1}
      >
        <ChevronLeft size={18} />
        <span>Trước</span>
      </button>

      <div className="pagination-numbers">
        {renderPageNumbers()}
      </div>

      <button
        className="pagination-btn"
        onClick={handleNext}
        disabled={currentPage === totalPages}
      >
        <span>Sau</span>
        <ChevronRight size={18} />
      </button>
    </div>
  );
};

export default Pagination;
