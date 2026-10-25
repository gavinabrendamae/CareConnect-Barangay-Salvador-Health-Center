import { useState } from 'react';

export default function PasswordInput({ id, value, onChange, placeholder, required = true, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-group">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className="form-control"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
      />
      <button className="btn btn-eye" type="button" onClick={() => setShow(!show)} aria-label="Show or hide password">
        <i className={`bi ${show ? 'bi-eye-slash' : 'bi-eye'}`} />
      </button>
    </div>
  );
}
