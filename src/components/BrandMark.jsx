import { useState } from 'react';

// Uses the Barangay Salvador seal (public/Resources/Logo.png); falls back to the old heart icon if the image file is missing.
export default function BrandMark() {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className="brand-mark"><i className="bi bi-heart-pulse-fill" /></span>;
  }
  return (
    <img
      className="brand-logo"
      src={`${import.meta.env.BASE_URL}Resources/Logo.png`}
      alt="Barangay Salvador logo"
      onError={() => setFailed(true)}
    />
  );
}