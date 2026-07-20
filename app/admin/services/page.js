"use client";

import { useEffect, useState } from "react";
import {
  deleteService,
  fetchAllPhotos,
  fetchAllServices,
  saveService,
  updateServices,
} from "@/lib/admin-data";

const CATEGORIES = ["Knotless", "Boho", "Crotchet", "Stitch", "Kids"];

const EMPTY = {
  name: "",
  category: "Knotless",
  price: "",
  priceFrom: 0,
  deposit: 15,
  duration: "",
  hours: 1,
  tag: "",
  desc: "",
  image: "",
  visible: false,
};

function ServiceEditor({ service, photos, order, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState(service ? { ...EMPTY, ...service } : { ...EMPTY, order });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isNew = !service;

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function save() {
    if (!form.name.trim() || !form.price.trim() || !form.duration.trim()) {
      setError("Name, price and duration are required.");
      return;
    }
    setBusy(true);
    try {
      const { id, ...data } = form;
      await saveService(service?.id ?? null, {
        ...data,
        name: form.name.trim(),
        priceFrom: parseInt(form.priceFrom, 10) || 0,
        deposit: parseInt(form.deposit, 10) || 0,
        hours: parseInt(form.hours, 10) || 1,
      });
      onSaved(isNew ? `${form.name} added.` : `${form.name} updated — live on the site.`);
    } catch (err) {
      console.error(err);
      setError("Couldn't save — check your connection and try again.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete ${service.name}? This can't be undone.`)) return;
    setBusy(true);
    try {
      await deleteService(service.id);
      onDeleted(`${service.name} deleted.`);
    } catch (err) {
      console.error(err);
      setError("Couldn't delete — try again.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={isNew ? "Add service" : `Edit ${service.name}`}>
        <h2>{isNew ? "Add service" : `Edit ${service.name}`}</h2>
        <label className="field">
          Name
          <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <div className="modal-row">
          <label className="field">
            Category
            <select value={form.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Tag <span className="opt">(e.g. Most popular)</span>
            <input type="text" value={form.tag} onChange={(e) => set("tag", e.target.value)} />
          </label>
        </div>
        <div className="modal-row">
          <label className="field">
            Price shown <span className="opt">(e.g. $180 or from $100)</span>
            <input type="text" value={form.price} onChange={(e) => set("price", e.target.value)} />
          </label>
          <label className="field">
            Price from ($)
            <input type="number" min="0" value={form.priceFrom} onChange={(e) => set("priceFrom", e.target.value)} />
          </label>
        </div>
        <div className="modal-row">
          <label className="field">
            Duration shown <span className="opt">(e.g. 4–5 hrs)</span>
            <input type="text" value={form.duration} onChange={(e) => set("duration", e.target.value)} />
          </label>
          <label className="field">
            Hours <span className="opt">(for finish-time estimate)</span>
            <input type="number" min="1" max="12" value={form.hours} onChange={(e) => set("hours", e.target.value)} />
          </label>
        </div>
        <label className="field">
          Deposit ($)
          <input type="number" min="0" value={form.deposit} onChange={(e) => set("deposit", e.target.value)} />
        </label>
        <label className="field">
          Description
          <textarea rows={2} value={form.desc} onChange={(e) => set("desc", e.target.value)} />
        </label>
        <div className="field">
          Photo
          <div className="photo-pick-grid">
            <button
              type="button"
              className={`photo-pick${!form.image ? " on" : ""}`}
              onClick={() => set("image", "")}
            >
              None
            </button>
            {photos.map((p) => (
              <button
                type="button"
                key={p.id}
                className={`photo-pick${form.image === p.src ? " on" : ""}`}
                onClick={() => set("image", p.src)}
                aria-label={`Use ${p.name}`}
              >
                <img src={p.src} alt="" />
              </button>
            ))}
          </div>
          <span style={{ fontWeight: 400, fontSize: 13, color: "var(--taupe)" }}>
            Pick from the photo library — add new ones under Photos.
          </span>
        </div>
        {error && <div className="error-box">{error}</div>}
        <div className="modal-acts">
          {!isNew && (
            <button className="btn btn-danger-outline left" onClick={remove} disabled={busy}>
              Delete
            </button>
          )}
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-bronze" onClick={save} disabled={busy}>
            {busy ? "Saving…" : isNew ? "Add service" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminServices() {
  const [services, setServices] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [editing, setEditing] = useState(null); // service object, or "new"
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetchAllServices().then(setServices).catch(console.error);
    fetchAllPhotos().then(setPhotos).catch(console.error);
  }, []);

  function notify(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function setDraft(id, field, value) {
    setDrafts((d) => {
      const next = { ...d, [id]: { ...d[id], [field]: value } };
      const svc = services.find((s) => s.id === id);
      // drop no-op edits so the savebar reflects real changes
      if (svc && next[id][field] === svc[field]) {
        delete next[id][field];
        if (Object.keys(next[id]).length === 0) delete next[id];
      }
      return next;
    });
  }

  const dirty = Object.keys(drafts);
  const dirtyNames = dirty
    .map((id) => services?.find((s) => s.id === id)?.name)
    .filter(Boolean);

  async function publish() {
    const updates = dirty.map((id) => ({ id, ...drafts[id] }));
    await updateServices(updates);
    setServices(await fetchAllServices());
    setDrafts({});
    notify("Changes published — live on the site now.");
  }

  async function toggleVisible(svc) {
    await updateServices([{ id: svc.id, visible: !svc.visible }]);
    setServices(await fetchAllServices());
    notify(!svc.visible ? `${svc.name} is now visible on the site.` : `${svc.name} is hidden from the site.`);
  }

  async function afterEditorChange(msg) {
    setEditing(null);
    setServices(await fetchAllServices());
    notify(msg);
  }

  if (!services) return <p>Loading…</p>;

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Services &amp; pricing</h1>
          <p className="sub">Changes go live on the site and booking flow immediately.</p>
        </div>
        <button className="btn btn-bronze" onClick={() => setEditing("new")}>
          + Add service
        </button>
      </div>

      <div className="admin-table">
        <div className="svc-row-head">
          <span>PHOTO</span>
          <span>SERVICE</span>
          <span>PRICE</span>
          <span>DURATION</span>
          <span>VISIBLE</span>
          <span />
        </div>
        {services.map((s) => {
          const d = drafts[s.id] || {};
          return (
            <div className="svc-row" key={s.id}>
              {s.image ? (
                <img src={s.image} alt="" className="thumb" />
              ) : (
                <div className="thumb-empty">add</div>
              )}
              <div className="nm">
                <strong>{s.name}</strong>
                <div className="s">
                  {s.category}
                  {s.tag ? ` · ${s.tag}` : ""}
                </div>
              </div>
              <input
                type="text"
                aria-label={`Price for ${s.name}`}
                value={d.price ?? s.price}
                onChange={(e) => setDraft(s.id, "price", e.target.value)}
              />
              <input
                type="text"
                aria-label={`Duration for ${s.name}`}
                value={d.duration ?? s.duration}
                onChange={(e) => setDraft(s.id, "duration", e.target.value)}
              />
              <button
                role="switch"
                aria-checked={s.visible}
                aria-label={`${s.name} visible on site`}
                className="switch"
                onClick={() => toggleVisible(s)}
              >
                <span className="knob" />
              </button>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn btn-outline btn-sm" onClick={() => setEditing(s)}>
                  Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {dirty.length > 0 && (
        <div className="savebar">
          <span className="msg">
            <strong>
              {dirty.length} unsaved change{dirty.length === 1 ? "" : "s"}
            </strong>{" "}
            — {dirtyNames.join(", ")}
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-outline" onClick={() => setDrafts({})}>
              Discard
            </button>
            <button className="btn btn-bronze" onClick={publish}>
              Publish changes
            </button>
          </div>
        </div>
      )}

      {editing && (
        <ServiceEditor
          service={editing === "new" ? null : editing}
          photos={photos}
          order={services.length}
          onClose={() => setEditing(null)}
          onSaved={afterEditorChange}
          onDeleted={afterEditorChange}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
