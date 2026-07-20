"use client";

import { useEffect, useState } from "react";
import {
  addFaq,
  deleteFaq,
  fetchAllFaqs,
  swapFaqOrder,
  updateFaq,
} from "@/lib/admin-data";

export default function AdminFaq() {
  const [faqs, setFaqs] = useState(null);
  const [editing, setEditing] = useState(null); // id being edited
  const [draft, setDraft] = useState({ q: "", a: "" });
  const [newFaq, setNewFaq] = useState({ q: "", a: "" });
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetchAllFaqs().then(setFaqs).catch(console.error);
  }, []);

  function notify(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function move(index, dir) {
    await swapFaqOrder(faqs[index], faqs[index + dir]);
    setFaqs(await fetchAllFaqs());
  }

  async function saveEdit(id) {
    await updateFaq(id, { q: draft.q, a: draft.a });
    setFaqs(await fetchAllFaqs());
    setEditing(null);
    notify("Question updated.");
  }

  async function remove(faq) {
    if (!confirm(`Delete "${faq.q}"?`)) return;
    await deleteFaq(faq.id);
    setFaqs((fs) => fs.filter((f) => f.id !== faq.id));
    notify("Question deleted.");
  }

  async function addNew() {
    if (!newFaq.q.trim() || !newFaq.a.trim()) {
      notify("Add both a question and an answer first.");
      return;
    }
    const maxOrder = faqs.reduce((m, f) => Math.max(m, f.order ?? 0), -1);
    await addFaq(newFaq.q.trim(), newFaq.a.trim(), maxOrder + 1);
    setFaqs(await fetchAllFaqs());
    setNewFaq({ q: "", a: "" });
    notify("Question added to the site.");
  }

  if (!faqs) return <p>Loading…</p>;

  return (
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="admin-head">
        <div>
          <h1>FAQ</h1>
          <p className="sub">Use the arrows to reorder — the order here is the order on the site.</p>
        </div>
      </div>

      {faqs.map((f, i) => (
        <div className="faq-admin-row" key={f.id}>
          <span aria-hidden="true" className="grip">
            ⠿
          </span>
          {editing === f.id ? (
            <div className="body">
              <input
                className="field"
                style={{ border: "1.5px solid rgba(61,43,31,.2)", borderRadius: 10, padding: "10px 12px", fontSize: 15, fontFamily: "var(--sans)" }}
                value={draft.q}
                onChange={(e) => setDraft({ ...draft, q: e.target.value })}
              />
              <textarea
                rows={3}
                style={{ border: "1.5px solid rgba(61,43,31,.2)", borderRadius: 10, padding: "10px 12px", fontSize: 14, fontFamily: "var(--sans)", resize: "none" }}
                value={draft.a}
                onChange={(e) => setDraft({ ...draft, a: e.target.value })}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-bronze btn-sm" onClick={() => saveEdit(f.id)}>
                  Save
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="body">
              <strong>{f.q}</strong>
              <p>{f.a}</p>
            </div>
          )}
          {editing !== f.id && (
            <div className="acts">
              <button className="reorder-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                ↑
              </button>
              <button
                className="reorder-btn"
                aria-label="Move down"
                disabled={i === faqs.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setEditing(f.id);
                  setDraft({ q: f.q, a: f.a });
                }}
              >
                Edit
              </button>
              <button className="btn btn-danger-outline btn-sm" onClick={() => remove(f)}>
                Delete
              </button>
            </div>
          )}
        </div>
      ))}

      <div className="new-item-box">
        <strong className="section-label">NEW QUESTION</strong>
        <input
          type="text"
          placeholder="Question — e.g. Do you braid men's hair?"
          value={newFaq.q}
          onChange={(e) => setNewFaq({ ...newFaq, q: e.target.value })}
        />
        <textarea
          rows={2}
          placeholder="Answer…"
          value={newFaq.a}
          onChange={(e) => setNewFaq({ ...newFaq, a: e.target.value })}
        />
        <button className="btn btn-bronze" style={{ alignSelf: "flex-end" }} onClick={addNew}>
          Save question
        </button>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
