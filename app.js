// FGs odlingsapp – Firestore (öppen, ingen auth)
//
// Firebase-konfiguration (din)
const firebaseConfig = {
  apiKey: "AIzaSyDGx3Opxm3L-ag9p2iOr7o_PACg5ADdLNc",
  authDomain: "fgsodling.firebaseapp.com",
  projectId: "fgsodling",
  storageBucket: "fgsodling.firebasestorage.app",
  messagingSenderId: "394050884172",
  appId: "1:394050884172:web:1009a738b1758606bc9ae9",
  measurementId: "G-GGPB3CFC6F",
};

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

// Fast dagbok för er två (ingen inställning behövs)
const DIARY_ID = "fgs-elin-louise";

// UI helpers
const $ = (s) => document.querySelector(s);
const toastEl = $("#toast");
let toastTimer = null;
function toast(msg){
  if(!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add("toast--show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> toastEl.classList.remove("toast--show"), 1800);
}

function clampInt(n, min=0){
  const x = Number(n);
  if(Number.isNaN(x)) return min;
  return Math.max(min, Math.floor(x));
}
function formatDate(iso){
  if(!iso) return "—";
  try{ return new Date(iso).toLocaleDateString("sv-SE"); } catch { return iso; }
}
function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// Refs
const varietiesRef = collection(db, "diaries", DIARY_ID, "varieties");
const batchesRef   = collection(db, "diaries", DIARY_ID, "batches");
const evalsRef     = collection(db, "diaries", DIARY_ID, "evaluations");

// State
let varieties = [];
let batches = [];
let evaluations = [];

// Elements
const varietyTbody = $("#varietyTbody");
const batchTbody = $("#batchTbody");
const evalTbody = $("#evalTbody");
const varietySelect = $("#varietySelect");
const evalSelect = $("#evalSelect");

// Subscriptions
onSnapshot(query(varietiesRef, orderBy("createdAt", "desc")), (snap) => {
  varieties = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderVarieties();
  renderSelects();
  renderStats();
});

onSnapshot(query(batchesRef, orderBy("createdAt", "desc")), (snap) => {
  batches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderBatches();
  renderStats();
});

onSnapshot(query(evalsRef, orderBy("updatedAt", "desc")), (snap) => {
  evaluations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderEvals();
});

// Render
function renderStats(){
  $("#statVarieties").textContent = String(varieties.length);
  $("#statBatches").textContent = String(batches.length);
  const sown = batches.reduce((a,b)=> a + clampInt(b.sownCount), 0);
  const remaining = batches.reduce((a,b)=> a + clampInt(b.remainingCount), 0);
  $("#statSown").textContent = String(sown);
  $("#statRemaining").textContent = String(remaining);
}

function renderSelects(){
  const opts = varieties
    .slice()
    .sort((a,b)=> (a.name||"").localeCompare(b.name||""))
    .map(v => `<option value="${v.id}">${escapeHtml(v.name || "Okänd")}</option>`)
    .join("");

  if(varietySelect){
    const cur = varietySelect.value;
    varietySelect.innerHTML = `<option value="">Välj sort…</option>` + opts;
    if(cur) varietySelect.value = cur;
  }
  if(evalSelect){
    const cur = evalSelect.value;
    evalSelect.innerHTML = `<option value="">Välj sort…</option>` + opts;
    if(cur) evalSelect.value = cur;
  }
  const hint = $("#varietyHint");
  if(hint) hint.textContent = varieties.length ? "" : "Lägg till minst 1 sort först.";
}

function renderVarieties(){
  if(!varietyTbody) return;
  if(!varieties.length){
    varietyTbody.innerHTML = `<tr><td colspan="4" class="muted">Inga sorter än. Lägg till en ovan.</td></tr>`;
    return;
  }

  varietyTbody.innerHTML = varieties.map(v => {
    const care = (v.care || "").trim();
    const type = (v.type || "").trim();
    return `
      <tr>
        <td><span class="pill">${escapeHtml(v.name || "Okänd sort")}</span></td>
        <td>${type ? escapeHtml(type) : `<span class="muted">—</span>`}</td>
        <td style="white-space:pre-wrap;">${care ? escapeHtml(care) : `<span class="muted">—</span>`}</td>
        <td class="col-actions">
          <div class="actions">
            <button class="btn" data-action="editVariety" data-id="${v.id}">Redigera</button>
            <button class="btn btn--danger" data-action="deleteVariety" data-id="${v.id}">Ta bort</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderBatches(){
  if(!batchTbody) return;
  if(!batches.length){
    batchTbody.innerHTML = `<tr><td colspan="7" class="muted">Inga batchar än. Registrera en sådd ovan.</td></tr>`;
    return;
  }

  batchTbody.innerHTML = batches.map(b => {
    const v = varieties.find(x => x.id === b.varietyId);
    const name = b.varietyName || v?.name || "Okänd sort";
    const sown = clampInt(b.sownCount, 0);
    const remaining = clampInt(b.remainingCount, 0);
    const potted = clampInt(b.pottedCount, 0);
    return `
      <tr>
        <td><span class="pill">${escapeHtml(name)}</span></td>
        <td>${formatDate(b.sownDate)}</td>
        <td class="num">${sown}</td>
        <td class="num">${remaining}</td>
        <td class="num">${potted}</td>
        <td>${b.note ? escapeHtml(b.note) : `<span class="muted">—</span>`}</td>
        <td class="col-actions">
          <div class="actions">
            <button class="btn" data-action="take" data-id="${b.id}">Ta plantor</button>
            <button class="btn" data-action="pot" data-id="${b.id}">Omskola</button>
            <button class="btn" data-action="loss" data-id="${b.id}">Förlust</button>
            <button class="btn btn--danger" data-action="deleteBatch" data-id="${b.id}">Ta bort</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderEvals(){
  if(!evalTbody) return;
  if(!evaluations.length){
    evalTbody.innerHTML = `<tr><td colspan="4" class="muted">Inga utvärderingar än.</td></tr>`;
    return;
  }

  evalTbody.innerHTML = evaluations.map(e => {
    const v = varieties.find(x => x.id === e.varietyId);
    const name = e.varietyName || v?.name || "Okänd sort";
    return `
      <tr>
        <td><span class="pill">${escapeHtml(name)}</span></td>
        <td class="num">${escapeHtml(String(e.rating || ""))}/5</td>
        <td style="white-space:pre-wrap;">${e.comment ? escapeHtml(e.comment) : `<span class="muted">—</span>`}</td>
        <td class="col-actions">
          <div class="actions">
            <button class="btn btn--danger" data-action="deleteEval" data-id="${e.id}">Ta bort</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// Forms
const varietyForm = $("#varietyForm");
if(varietyForm){
  varietyForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(varietyForm);
    const name = String(fd.get("name") || "").trim();
    const type = String(fd.get("type") || "").trim();
    const care = String(fd.get("care") || "").trim();
    if(!name) return toast("Skriv ett sortnamn");

    await addDoc(varietiesRef, { name, type, care, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    varietyForm.reset();
    toast("Sort sparad ✅");
  });
}

const batchForm = $("#batchForm");
if(batchForm){
  const dateInput = batchForm.querySelector('input[name="sownDate"]');
  if(dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0,10);

  batchForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(batchForm);
    const varietyId = String(fd.get("varietyId") || "").trim();
    const sownDate = String(fd.get("sownDate") || "").trim();
    const sownCount = clampInt(fd.get("sownCount"), 1);
    const note = String(fd.get("note") || "").trim();
    if(!varietyId) return toast("Välj en sort");
    if(!sownDate) return toast("Välj datum");

    const v = varieties.find(x => x.id === varietyId);
    const varietyName = v?.name || "";

    await addDoc(batchesRef, {
      varietyId, varietyName, sownDate, sownCount,
      remainingCount: sownCount,
      pottedCount: 0,
      note,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batchForm.reset();
    if(dateInput) dateInput.value = new Date().toISOString().slice(0,10);
    toast("Batch skapad ✅");
  });
}

const evalForm = $("#evalForm");
if(evalForm){
  evalForm.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fd = new FormData(evalForm);
    const varietyId = String(fd.get("varietyId") || "").trim();
    const rating = clampInt(fd.get("rating"), 1);
    const comment = String(fd.get("comment") || "").trim();
    if(!varietyId) return toast("Välj en sort");
    if(rating < 1 || rating > 5) return toast("Betyg måste vara 1–5");

    const v = varieties.find(x => x.id === varietyId);
    const varietyName = v?.name || "";

    await setDoc(doc(db, "diaries", DIARY_ID, "evaluations", varietyId), {
      varietyId, varietyName, rating, comment, updatedAt: serverTimestamp()
    }, { merge: true });

    evalForm.reset();
    toast("Utvärdering sparad ✅");
  });
}

// Click actions
document.addEventListener("click", async (ev) => {
  const btn = ev.target?.closest?.("button[data-action]");
  if(!btn) return;
  const action = btn.getAttribute("data-action");
  const id = btn.getAttribute("data-id");
  if(!action || !id) return;

  try{
    if(action === "deleteVariety"){
      if(!confirm("Ta bort sorten? (Batchar blir kvar men kan visa 'Okänd sort')")) return;
      await deleteDoc(doc(db, "diaries", DIARY_ID, "varieties", id));
      toast("Sort borttagen");
      return;
    }

    if(action === "editVariety"){
      const v = varieties.find(x => x.id === id);
      if(!v) return;
      const name = prompt("Ändra sortnamn:", v.name || "");
      if(name === null) return;
      const type = prompt("Ändra typ (valfritt):", v.type || "") ?? "";
      const care = prompt("Ändra skötsel (valfritt):", v.care || "") ?? "";
      await updateDoc(doc(db, "diaries", DIARY_ID, "varieties", id), {
        name: name.trim(),
        type: type.trim(),
        care: care,
        updatedAt: serverTimestamp(),
      });
      toast("Uppdaterat ✅");
      return;
    }

    if(action === "deleteBatch"){
      if(!confirm("Ta bort batchen?")) return;
      await deleteDoc(doc(db, "diaries", DIARY_ID, "batches", id));
      toast("Batch borttagen");
      return;
    }

    if(action === "deleteEval"){
      if(!confirm("Ta bort utvärderingen?")) return;
      await deleteDoc(doc(db, "diaries", DIARY_ID, "evaluations", id));
      toast("Borttagen");
      return;
    }

    if(["take","pot","loss"].includes(action)){
      const qtyStr = prompt("Hur många?", "1");
      if(qtyStr === null) return;
      const qty = clampInt(qtyStr, 1);

      const batchRef = doc(db, "diaries", DIARY_ID, "batches", id);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(batchRef);
        if(!snap.exists()) throw new Error("Batch hittas inte");

        const data = snap.data();
        const remaining = clampInt(data.remainingCount, 0);
        if(qty > remaining) throw new Error("Inte så många kvar i batchen");

        const updates = { updatedAt: serverTimestamp() };

        if(action === "take" || action === "loss"){
          updates.remainingCount = remaining - qty;
        }
        if(action === "pot"){
          updates.remainingCount = remaining - qty;
          updates.pottedCount = clampInt(data.pottedCount, 0) + qty;
        }
        tx.update(batchRef, updates);

        // eventlogg (valfritt)
        const evRef = doc(collection(db, "diaries", DIARY_ID, "events"));
        tx.set(evRef, { type: action, batchId: id, qty, at: serverTimestamp() });
      });

      toast("Sparat ✅");
      return;
    }

  }catch(err){
    console.error(err);
    toast(String(err?.message || "Något gick fel"));
  }
});
