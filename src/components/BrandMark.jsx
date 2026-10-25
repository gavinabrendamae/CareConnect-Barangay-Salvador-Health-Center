import { useState } from 'react';

export default function BrandMark() {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className="brand-mark"><i className="bi bi-heart-pulse-fill" /></span>;
  }
  return (
    <img
      className="brand-logo"
      src="public/Resources/Logo.png"
      alt="Barangay Salvador logo"
      onError={() => setFailed(true)}
    />
  );
}