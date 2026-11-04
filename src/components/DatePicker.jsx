import { useEffect, useRef } from 'react';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.min.css';

export default function DatePicker({ id, onChange, placeholder = 'dd/mm/yyyy', defaultValue, minDate, maxDate = 'today' }) {
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
      maxDate: maxDate ?? undefined,
      minDate: minDate ?? undefined,
      allowInput: false,
      disableMobile: true,
      closeOnSelect: false, // the user confirms with the OK button, so it is clear the date was chosen
      onReady: (_d, _s, inst) => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'padding:8px 10px 10px;border-top:1px solid #e6e6e6;display:flex;justify-content:flex-end;';
        const ok = document.createElement('button');
        ok.type = 'button';
        ok.textContent = 'OK';
        ok.className = 'btn btn-sm btn-primary-custom px-4';
        ok.disabled = !inst.selectedDates.length;
        ok.addEventListener('click', () => inst.close());
        wrap.appendChild(ok);
        inst.calendarContainer.appendChild(wrap);
        inst._okBtn = ok;
      },
      onChange: (dates, str, inst) => {
        if (inst._okBtn) inst._okBtn.disabled = !dates.length;
        onChangeRef.current(str);
      },
    });
    if (fp.altInput) fp.altInput.placeholder = placeholder;
    return () => fp.destroy();
  }, [placeholder]);

  return <input id={id} ref={inputRef} type="text" className="form-control" autoComplete="off" />;
}