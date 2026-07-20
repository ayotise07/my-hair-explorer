"use client";

import { useEffect, useRef, useState } from "react";
import { deletePhoto, fetchAllPhotos, updatePhoto, uploadPhoto } from "@/lib/admin-data";

const PLACEMENTS = ["Hero", "Lookbook", "Instagram"];

export default function AdminPhotos() {
  const [photos, setPhotos] = useState(null);
  const [filter, setFilter] = useState("All");
  const [toast, setToast] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    fetchAllPhotos().then(setPhotos).catch(console.error);
  }, []);

  function notify(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function togglePlacement(photo, placement) {
    const placements = photo.placements.includes(placement)
      ? photo.placements.filter((p) => p !== placement)
      : [...photo.placements, placement];
    await updatePhoto(photo.id, { placements });
    setPhotos(await fetchAllPhotos());
  }

  async function remove(photo) {
    if (!confirm(`Remove ${photo.name} from the library?`)) return;
    await deletePhoto(photo);
    setPhotos((ps) => ps.filter((p) => p.id !== photo.id));
    notify("Photo removed.");
  }

  async function upload(files) {
    try {
      let order = photos.length;
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          notify("Images only, please.");
          return;
        }
        await uploadPhoto(file, order++);
      }
      setPhotos(await fetchAllPhotos());
      notify(`${files.length} photo${files.length === 1 ? "" : "s"} uploaded — tag where they appear.`);
    } catch (err) {
      console.error(err);
      notify("Upload failed — check your connection and try again.");
    }
  }

  if (!photos) return <p>Loading…</p>;

  const counts = {
    All: photos.length,
    ...Object.fromEntries(PLACEMENTS.map((p) => [p, photos.filter((x) => x.placements.includes(p)).length])),
    Unused: photos.filter((x) => x.placements.length === 0).length,
  };
  const shown =
    filter === "All"
      ? photos
      : filter === "Unused"
        ? photos.filter((p) => p.placements.length === 0)
        : photos.filter((p) => p.placements.includes(filter));

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Photos</h1>
          <p className="sub">Tag each photo with where it appears — hero, lookbook, or Instagram strip.</p>
        </div>
        <button className="btn btn-bronze" onClick={() => fileRef.current?.click()}>
          + Upload photos
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) upload([...e.target.files]);
            e.target.value = "";
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="tablist" aria-label="Filter by placement">
        {["All", ...PLACEMENTS, "Unused"].map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={`chip${filter === f ? " active" : ""}`}
            style={{ minHeight: 40, padding: "9px 18px", fontSize: 13.5 }}
            onClick={() => setFilter(f)}
          >
            {f} · {counts[f]}
          </button>
        ))}
      </div>

      <div className="photo-grid">
        {shown.map((p) => (
          <div className="photo-card" key={p.id}>
            <img src={p.src} alt={p.name} />
            <div className="pc-body">
              <div className="pc-tags">
                {PLACEMENTS.map((pl) => (
                  <button
                    key={pl}
                    className={`pc-tag${p.placements.includes(pl) ? " on" : ""}`}
                    aria-pressed={p.placements.includes(pl)}
                    onClick={() => togglePlacement(p, pl)}
                  >
                    {pl}
                  </button>
                ))}
              </div>
              <div className="pc-foot">
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                <div style={{ display: "flex", gap: 10, flex: "none" }}>
                  <button
                    className="del"
                    style={{ color: "var(--bronze)" }}
                    onClick={async () => {
                      const name = prompt("Rename photo:", p.name);
                      if (!name || name === p.name) return;
                      await updatePhoto(p.id, { name });
                      setPhotos(await fetchAllPhotos());
                    }}
                  >
                    Edit
                  </button>
                  <button className="del" onClick={() => remove(p)}>
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        <button
          className="upload-tile"
          style={{ minHeight: 264, borderRadius: 14, fontSize: 14 }}
          onClick={() => fileRef.current?.click()}
        >
          <span className="plus" style={{ fontSize: 28 }}>
            +
          </span>
          Drag photos here
          <span className="hint">or click to browse</span>
        </button>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
