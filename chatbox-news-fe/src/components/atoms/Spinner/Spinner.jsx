import React from 'react';
import './Spinner.css';

const Spinner = ({ size = 'md', color = 'primary' }) => {
  return (
    <div className={`spinner spinner-${size} spinner-${color}`}>
      <div className="spinner-circle"></div>
    </div>
  );
};

export default Spinner;
