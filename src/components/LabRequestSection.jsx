import { useState } from "react";

const LAB_TESTS = [
  "Complete Blood Count (CBC)",
  "Urinalysis",
  "Fecal Analysis",
  "Fasting Blood Sugar (FBS)",
  "Random Blood Sugar (RBS)",
  "Lipid Profile",
  "Pregnancy Test",
  "Sputum AFB",
  "Hepatitis B Screening (HBsAg)",
  "Blood Typing",
];
const CUSTOM = "__custom__";

/**
 * Props:
 *  - labRequests: array ng { test_name, is_custom, request_notes }
 *  - setLabRequests: setter galing sa parent (EMR component)
 */
export default function LabRequestSection({ labRequests, setLabRequests }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const [customName, setCustomName] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setSelected("");
    setCustomName("");
    setNotes("");
    setOpen(false);
  };

  const handleAdd = () => {
    const isCustom = selected === CUSTOM;
    const name = isCustom ? customName.trim() : selected;
    if (!name) return;

    if (labRequests.some((l) => l.test_name.toLowerCase() === name.toLowerCase())) {
      reset();
      return;
    }

    setLabRequests([
      ...labRequests,
      { test_name: name, is_custom: isCustom, request_notes: notes.trim() || null },
    ]);
    reset();
  };

  const handleRemove = (index) =>
    setLabRequests(labRequests.filter((_, i) => i !== index));

  const canAdd = selected && (selected !== CUSTOM || customName.trim());

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>Laboratory Request</strong>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          style={{
            border: "1px solid #1e7a4c",
            color: "#1e7a4c",
            background: "#fff",
            borderRadius: 6,
            padding: "8px 16px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          + Request lab
        </button>
      </div>

      {open && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #d9e2dc",
            borderRadius: 8,
            display: "grid",
            gap: 10,
          }}
        >
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            style={{ padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
          >
            <option value="">-- Select laboratory test --</option>
            {LAB_TESTS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
            <option value={CUSTOM}>Custom / Others...</option>
          </select>

          {selected === CUSTOM && (
            <input
              type="text"
              placeholder="Type the laboratory test"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              style={{ padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
            />
          )}

          <input
            type="text"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ padding: 10, borderRadius: 6, border: "1px solid #ccc" }}
          />

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={reset} style={{ padding: "8px 14px", cursor: "pointer" }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!canAdd}
              style={{
                padding: "8px 14px",
                background: canAdd ? "#1e7a4c" : "#9bbfad",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: canAdd ? "pointer" : "not-allowed",
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {labRequests.length === 0 ? (
        <p style={{ color: "#666", fontSize: 14, marginTop: 8 }}>No laboratory requested.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 10, display: "grid", gap: 6 }}>
          {labRequests.map((l, i) => (
            <li
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                border: "1px solid #d9e2dc",
                borderRadius: 6,
              }}
            >
              <span>
                {l.test_name}
                {l.is_custom && <em style={{ color: "#888" }}> (custom)</em>}
                {l.request_notes && <span style={{ color: "#666" }}> — {l.request_notes}</span>}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(i)}
                style={{ border: "none", background: "none", color: "#c0392b", cursor: "pointer" }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}