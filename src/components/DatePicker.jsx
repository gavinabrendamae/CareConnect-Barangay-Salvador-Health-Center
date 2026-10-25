import { useEffect, useRef } from 'react';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';

export default function DatePicker({ id, onChange, placeholder = 'dd/mm/yyyy', defaultValue }) {
  const inputRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const fp = flatpickr(inputRef.current, {
      dateFormat: 'Y-m-d',
      defaultDate: defaultValue || undefined,
      altInput: true,
      altFormat: 'd/m/Y',
      altInputClass: 'form-control',
      maxDate: 'today',
      allowInput: false,
      disableMobile: true,
      onChange: (_dates, str) => onChangeRef.current(str),
    });
    if (fp.altInput) fp.altInput.placeholder = placeholder;
    return () => fp.destroy();
  }, [placeholder]);

  return <input id={id} ref={inputRef} type="text" className="form-control" autoComplete="off" />;
}