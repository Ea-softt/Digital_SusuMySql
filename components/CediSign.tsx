import React from 'react';

export const CediSign: React.FC<{ className?: string }> = ({ className }) => (
  <span className={className} aria-hidden>
    ₵
  </span>
);

export default CediSign;
