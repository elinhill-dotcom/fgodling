// FGs odlingsapp – Firebase Firestore (ingen inloggning)
//
// Denna fil ersätter Canva dataSdk. Den sparar allt i:
// diaries/fgs-elin-louise/records (en enda delad dagbok)

// 1) Din firebaseConfig:
const firebaseConfig = {
  apiKey: "AIzaSyDGx3Opxm3L-ag9p2iOr7o_PACg5ADdLNc",
  authDomain: "fgsodling.firebaseapp.com",
  projectId: "fgsodling",
  storageBucket: "fgsodling.firebasestorage.app",
  messagingSenderId: "394050884172",
  appId: "1:394050884172:web:1009a738b1758606bc9ae9",
  measurementId: "G-GGPB3CFC6F"
};

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, getDocs, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const DIARY_ID = "fgs-elin-louise";
const recordsRef = collection(db, "diaries", DIARY_ID, "records");

// ---------- State ----------
let allData = [];
let allVarieties = [];
let currentTab = "dashboard";
let currentMonth = new Date();
let openRegisterBatches = new Set();
let successChart = null;
let categoryChart = null;
let weeklyLossChart = null;

// ---------- Utilities ----------
function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function todayISO(){
  return new Date().toISOString().split("T")[0];
}

// Upload image to Firebase Storage and return download URL
async function uploadImageToStorage(file, folder, filenameBase){
  if(!file) return "";
  const safeBase = (filenameBase || "image").toString().replace(/[^a-z0-9_-]/gi, "_").slice(0, 60);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${folder}/${safeBase}_${Date.now()}.${ext}`;
  const r = storageRef(storage, path);
  const bytes = await file.arrayBuffer();
  await uploadBytes(r, new Uint8Array(bytes), { contentType: file.type || "image/jpeg" });
  return await getDownloadURL(r);
}

// ---------- Firestore CRUD (dataSdk-liknande) ----------
async function createRecord(payload){
  payload.createdAt = serverTimestamp();
  payload.updatedAt = serverTimestamp();
  const ref = await addDoc(recordsRef, payload);
  return { isOk: true, id: ref.id };
}

async function updateRecord(id, patch){
  patch.updatedAt = serverTimestamp();
  await updateDoc(doc(recordsRef, id), patch);
  return { isOk: true };
}

async function replaceRecord(id, full){
  full.updatedAt = serverTimestamp();
  await setDoc(doc(recordsRef, id), full, { merge: false });
  return { isOk: true };
}

async function deleteRecord(id){
  await deleteDoc(doc(recordsRef, id));
  return { isOk: true };
}

// ---------- Live subscription ----------
onSnapshot(query(recordsRef, orderBy("createdAt", "asc")), (snap) => {
  allData = snap.docs.map(d => ({ __backendId: d.id, ...d.data() }));
  updateUI();
}, (err) => {
  console.error("Firestore subscribe error:", err);
  alert("Kunde inte läsa/spara i Firestore. Kolla Firestore Rules (måste tillåta read/write).");
});

// ---------- Tabs ----------
window.showTab = function(tab){
  currentTab = tab;
  document.querySelectorAll("section[id^='section-']").forEach(el => el.classList.add("hidden"));
  document.querySelectorAll("button[id^='tab-']").forEach(el => el.classList.remove("tab-active", "text-white"));

  document.getElementById(`section-${tab}`).classList.remove("hidden");
  document.getElementById(`tab-${tab}`).classList.add("tab-active", "text-white");
  updateUI();
};

// ---------- Init ----------
function init(){
  /* Title handled by header logo */

  const sowDateEl = document.getElementById("sow-date");
  if (sowDateEl) sowDateEl.value = todayISO();

  // Forms
  const varietyForm = document.getElementById("variety-form");
  const sowForm = document.getElementById("sow-form");
  if (varietyForm) varietyForm.addEventListener("submit", handleAddVariety);
  if (sowForm) sowForm.addEventListener("submit", handleSowForm);
}
init();

// ---------- UI update ----------
function updateUI(){
  updateDashboard();
  if (currentTab === "calendar") updateCalendar();
  if (currentTab === "varieties") updateVarieties();
  if (currentTab === "register") updateRegister();
  if (currentTab === "overview") updateOverview();
}

function updateDashboard(){
  ensureDashboardLayout();

  const sown = allData.filter(d => d.record_type === "sown" && d.variety_id);
  const potted = allData.filter(d => d.record_type === "potted");
  const losses = allData.filter(d => d.record_type === "loss");

  const totalSown = sown.reduce((sum, d) => sum + (Number(d.sown_count)||0), 0);
  const totalPotted = potted.reduce((sum, d) => sum + (Number(d.potted_count)||0), 0);
  const totalLost = losses.reduce((sum, d) => sum + (Number(d.lost_count)||0), 0);
  const uniqueVarieties = new Set(sown.map(d => d.variety_id)).size;

  const statTotalSown = document.getElementById("stat-total-sown");
  const statPotted = document.getElementById("stat-potted");
  const statLost = document.getElementById("stat-lost");
  const statVarieties = document.getElementById("stat-varieties");

  if(statTotalSown) statTotalSown.textContent = totalSown;
  if(statPotted) statPotted.textContent = totalPotted;
  if(statLost) statLost.textContent = totalLost;
  if(statVarieties) statVarieties.textContent = uniqueVarieties;

  updatePersonStats(sown, losses);
  if (typeof updateRecentActivities === "function") updateRecentActivities();
  updateCharts(sown, potted, losses);
}



function ensureDashboardLayout(){
  const container = document.getElementById("home-dashboard");
  if(!container) return;

  container.innerHTML = `
    <div class="storybook-shell soft-card p-5 md:p-6">
      <div class="storybook-title-wrap">
        <p class="storybook-subtitle">Välkommen till</p>
        <h1 class="storybook-title">Systrarna Hills Odlingsapp</h1>
      </div>

      <div class="storybook-menu mt-5">
        <button type="button" onclick="showTab('varieties')" class="storybook-menu-item peach">🌸 Fröbibliotek <span>›</span></button>
        <button type="button" onclick="showTab('register')" class="storybook-menu-item sage">🌱 Ny sådd <span>›</span></button>
        <button type="button" onclick="showTab('overview')" class="storybook-menu-item lavender">🪴 Plantornas resa <span>›</span></button>
      </div>

      <div class="storybook-section mt-6">
        <h2>Översikt just nu</h2>
        <div class="storybook-stats">
          <div class="storybook-stat-row"><span>🌱 Frön sådda</span><strong id="stat-total-sown">0</strong></div>
          <div class="storybook-stat-row"><span>🪴 Plantor omskolade</span><strong id="stat-potted">0</strong></div>
          <div class="storybook-stat-row"><span>💔 Förlorade</span><strong id="stat-lost">0</strong></div>
          <div class="storybook-stat-row"><span>🌼 Sorter odlade</span><strong id="stat-varieties">0</strong></div>
        </div>
      </div>

      <div class="storybook-section mt-6">
        <h2>Senaste aktiviteter</h2>
        <div id="dashboard-recent" class="storybook-recent-list"></div>
      </div>

      <div id="person-stats" class="grid sm:grid-cols-2 gap-3 mt-5"></div>
    </div>

    <div class="soft-card p-4 md:p-5">
      <h2 class="serif text-2xl mb-3">Trender</h2>
      <div class="grid gap-4 md:grid-cols-2">
        <div class="bg-white/80 rounded-2xl p-3 border" style="border-color:var(--line)"><canvas id="successChart" class="max-h-64"></canvas></div>
        <div class="bg-white/80 rounded-2xl p-3 border" style="border-color:var(--line)"><canvas id="weeklyLossChart" class="max-h-64"></canvas></div>
      </div>
      <div class="bg-white/80 rounded-2xl p-3 border mt-4" style="border-color:var(--line)"><canvas id="categoryChart" class="max-h-64"></canvas></div>
    </div>
  `;
}

function updateRecentActivities(){
  const host = document.getElementById("dashboard-recent");
  if(!host) return;

  const dateOf = (event) => {
    const candidate = event.sown_date || event.potted_date || event.loss_date || event.createdAt;
    if(!candidate) return 0;
    if(typeof candidate === "object" && typeof candidate.seconds === "number") return candidate.seconds * 1000;
    const ts = new Date(candidate).getTime();
    return Number.isNaN(ts) ? 0 : ts;
  };

  const recent = allData
    .filter(d => d.record_type === "sown" || d.record_type === "potted" || d.record_type === "loss")
    .sort((a, b) => dateOf(b) - dateOf(a))
    .slice(0, 4);

  if(recent.length === 0){
    host.innerHTML = `<div class="storybook-empty">Inga aktiviteter ännu – börja med att registrera en sådd 🌱</div>`;
    return;
  }

  host.innerHTML = recent.map((item) => {
    if(item.record_type === "loss"){
      return `<div class="storybook-recent-item"><span>💔 ${escapeHtml(item.variety_name || "Okänd sort")}</span><strong>${Number(item.lost_count)||0} förlorade</strong></div>`;
    }
    if(item.record_type === "potted"){
      return `<div class="storybook-recent-item"><span>🪴 ${escapeHtml(item.variety_name || "Okänd sort")}</span><strong>${Number(item.potted_count || item.sown_count)||0} omskolade</strong></div>`;
    }
    return `<div class="storybook-recent-item"><span>🌱 ${escapeHtml(item.variety_name || "Okänd sort")}</span><strong>${Number(item.sown_count)||0} sådda</strong></div>`;
  }).join("");
}

function updatePersonStats(sown, losses){
  const elinSown = sown.filter(d => (d.sown_by||"").includes("Elin")).reduce((s,d)=> s + (Number(d.sown_count)||0), 0);
  const louiseSown = sown.filter(d => (d.sown_by||"").includes("Louise")).reduce((s,d)=> s + (Number(d.sown_count)||0), 0);
  const elinLost = losses.filter(d => d.lost_by === "Elin").reduce((s,d)=> s + (Number(d.lost_count)||0), 0);
  const louiseLost = losses.filter(d => d.lost_by === "Louise").reduce((s,d)=> s + (Number(d.lost_count)||0), 0);

  const elinSuccess = elinSown > 0 ? Math.round(((elinSown - elinLost) / elinSown) * 100) : 0;
  const louiseSuccess = louiseSown > 0 ? Math.round(((louiseSown - louiseLost) / louiseSown) * 100) : 0;

  const personStatsEl = document.getElementById("person-stats");
  if(!personStatsEl) return;

  personStatsEl.innerHTML = `
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="font-semibold">👩 Elin</p>
        <p class="text-sm muted">${elinSown} sådda • ${elinLost} förlorade</p>
      </div>
      <div class="text-2xl font-bold">${elinSuccess}%</div>
    </div>
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="font-semibold">👩 Louise</p>
        <p class="text-sm muted">${louiseSown} sådda • ${louiseLost} förlorade</p>
      </div>
      <div class="text-2xl font-bold">${louiseSuccess}%</div>
    </div>
  `;
}

function updateCharts(sown, potted, losses){
  const successCanvas = document.getElementById("successChart");
  const weeklyCanvas = document.getElementById("weeklyLossChart");
  const categoryCanvas = document.getElementById("categoryChart");
  if(!successCanvas || !weeklyCanvas || !categoryCanvas) return;

  // Success chart
  const elinSown = sown.filter(d => (d.sown_by||"").includes("Elin")).reduce((s,d)=> s + (Number(d.sown_count)||0), 0);
  const louiseSown = sown.filter(d => (d.sown_by||"").includes("Louise")).reduce((s,d)=> s + (Number(d.sown_count)||0), 0);
  const elinLost = losses.filter(d => d.lost_by === "Elin").reduce((s,d)=> s + (Number(d.lost_count)||0), 0);
  const louiseLost = losses.filter(d => d.lost_by === "Louise").reduce((s,d)=> s + (Number(d.lost_count)||0), 0);

  const successCtx = successCanvas.getContext("2d");
  if (successChart) successChart.destroy();
  successChart = new Chart(successCtx, {
    type: "bar",
    data: {
      labels: ["Elin", "Louise"],
      datasets: [
        { label: "Överlevde", data: [elinSown - elinLost, louiseSown - louiseLost], backgroundColor: "#10b981" },
        { label: "Förlorade", data: [elinLost, louiseLost], backgroundColor: "#ef4444" }
      ]
    },
    options: { indexAxis: "y", responsive: true, maintainAspectRatio: true, plugins: { legend: { position: "bottom" } }, scales: { x: { stacked: true }, y: { stacked: true } } }
  });

  // Weekly loss chart
  const weeklyLosses = {};
  losses.forEach(loss => {
    if (loss.loss_date) {
      const date = new Date(loss.loss_date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay() + 1);
      const weekKey = weekStart.toLocaleDateString("sv-SE");
      weeklyLosses[weekKey] = (weeklyLosses[weekKey] || 0) + (Number(loss.lost_count)||0);
    }
  });

  const sortedWeeks = Object.keys(weeklyLosses).sort();
  const weeklyCtx = weeklyCanvas.getContext("2d");
  if (weeklyLossChart) weeklyLossChart.destroy();
  weeklyLossChart = new Chart(weeklyCtx, {
    type: "line",
    data: {
      labels: sortedWeeks,
      datasets: [{ label: "Förlorade per vecka", data: sortedWeeks.map(w => weeklyLosses[w]), borderColor: "#ef4444", backgroundColor: "rgba(239, 68, 68, 0.1)", tension: 0.4, fill: true }]
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true } } }
  });

  // Category chart
  const categories = {};
  sown.forEach(d => {
    const variety = allVarieties.find(v => v.variety_id === d.variety_id);
    const cat = variety?.category || "Okänd";
    categories[cat] = (categories[cat] || 0) + (Number(d.sown_count)||0);
  });

  const categoryCtx = categoryCanvas.getContext("2d");
  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(categoryCtx, {
    type: "doughnut",
    data: {
      labels: Object.keys(categories),
      datasets: [{ data: Object.values(categories), backgroundColor: ["#ec4899", "#f59e0b", "#06b6d4", "#8b5cf6", "#14b8a6"] }]
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } }
  });
}

// ---------- Varieties ----------
function updateVarieties(){
  const varieties = allData.filter(d => d.record_type === "variety");
  allVarieties = varieties;

  const select = document.getElementById("sow-variety");
  select.innerHTML = "<option value=''>Välj frösort</option>" +
    varieties.map(v => `<option value="${v.variety_id}">${escapeHtml(v.variety_name)}</option>`).join("");

  document.getElementById("varieties-list").innerHTML = varieties.map(v => `
    <div class="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl shadow p-5 border-l-4 border-emerald-600">
      ${v.variety_image_url ? `<img src="${escapeHtml(v.variety_image_url)}" class="w-full h-40 object-cover rounded-xl mb-3 border border-emerald-100" alt="Bild på fröpåse">` : ``}
      <div class="flex gap-2 flex-wrap mb-3">
        <input type="file" id="variety-img-${v.__backendId}" accept="image/*" class="hidden"
          onchange="handleImageSelected('variety-img-${v.__backendId}','${v.__backendId}','variety_image_url','variety_images','${v.variety_id}')">
        <button type="button" class="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded"
          onclick="pickImageFile('variety-img-${v.__backendId}')">🖼️ Byt bild</button>
        ${v.variety_image_url ? `<button type="button" class="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded"
          onclick="removeImageField(\'${v.__backendId}\',\'variety_image_url\')">🗑️ Ta bort bild</button>` : ``}
      </div>
      <h3 class="text-lg font-bold text-emerald-900">${escapeHtml(v.variety_name)}</h3>
      <p class="text-sm text-gray-600 italic">${escapeHtml(v.english_name || "")}</p>
      <div class="grid grid-cols-2 gap-2 mt-3 text-sm">
        <p><span class="font-semibold">📂</span> ${escapeHtml(v.category || "")}</p>
        <p><span class="font-semibold">📏</span> ${escapeHtml(v.height || "")}</p>
        <p><span class="font-semibold">🌈</span> ${escapeHtml(v.color || "")}</p>
        <p><span class="font-semibold">📅</span> ${escapeHtml(v.sow_time || "")}</p>
      </div>
      ${v.notes ? `<p class="mt-3 text-xs text-emerald-700 bg-white p-2 rounded">📝 ${escapeHtml(v.notes)}</p>` : ""}
      <button type="button" onclick="deleteVariety('${v.variety_id}')" class="mt-3 w-full text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-lg font-semibold transition-all">🗑️ Ta bort</button>
    </div>
  `).join("");
}


function getBatchUsage(batchId){
  const potted = allData.filter(d => d.record_type === "potted" && d.batch_id === batchId)
    .reduce((sum,d)=> sum + (Number(d.potted_count || d.sown_count)||0), 0);
  const planted = allData.filter(d => d.record_type === "planted_out" && d.batch_id === batchId)
    .reduce((sum,d)=> sum + (Number(d.planted_out_count)||0), 0);
  const lost = allData.filter(d => d.record_type === "loss" && d.batch_id === batchId)
    .reduce((sum,d)=> sum + (Number(d.lost_count)||0), 0);
  return { potted, planted, lost, used: potted + planted + lost };
}

function getRemainingForSown(rec){
  const total = Number(rec.sown_count)||0;
  const usage = getBatchUsage(rec.batch_id || rec.__backendId);
  return Math.max(0, total - usage.used);
}


// ---------- Register tab ----------


function updateRegister(){
  const sown = allData
    .filter(d => d.record_type === "sown")
    .sort((a,b)=> new Date(b.sown_date) - new Date(a.sown_date));

  const losses = allData.filter(d => d.record_type === "loss");
  const pottedBatches = allData
    .filter(d => d.record_type === "potted")
    .sort((a,b)=> new Date((b.potted_date||b.sown_date||"")) - new Date((a.potted_date||a.sown_date||"")));
  const plantedOutBatches = allData
    .filter(d => d.record_type === "planted_out")
    .sort((a,b)=> new Date((b.planted_out_date||"")) - new Date((a.planted_out_date||"")));

  const sownList = document.getElementById("sown-list");
  const lossFormList = document.getElementById("loss-form-list");
  const lossHistory = document.getElementById("loss-history");
  if(!sownList || !lossFormList || !lossHistory) return;

  sownList.innerHTML = `
    <div class="text-sm font-bold text-gray-800 mb-2">🌱 Sådda batchar</div>
  ` + (sown.length === 0 ? `<p class="text-gray-500 text-sm">Inga sådda batchar ännu.</p>` : `<div class="batch-list">` + sown.map(s => {
    const remaining = getRemainingForSown(s);
    const usage = getBatchUsage(s.batch_id || s.__backendId);
    const isOpen = openRegisterBatches.has(s.__backendId);
    return `
      <div class="batch-card">
        <button type="button" class="batch-summary" onclick="toggleRegisterBatch('${s.__backendId}')">
          <div class="batch-summary-left">
            <div class="batch-summary-title">${escapeHtml(s.variety_name)}</div>
            <div class="batch-summary-meta">
              <span>${Number(s.sown_count)||0} sådda</span>
              <span>•</span>
              <span>${new Date(s.sown_date).toLocaleDateString("sv-SE")}</span>
              <span>•</span>
              <span>${escapeHtml(s.sown_by||"")}</span>
              <span>•</span>
              <span>Kvar: ${remaining}</span>
            </div>
          </div>
          <div class="batch-toggle">${isOpen ? "−" : "+"}</div>
        </button>

        <div class="batch-details ${isOpen ? "" : "hidden"}">
          <div class="pt-4">
            ${s.sown_image_url ? `<img src="${escapeHtml(s.sown_image_url)}" alt="Bild sådd" class="w-full h-40 object-cover rounded-xl mb-3 border border-emerald-100">` : ``}
            <div class="flex gap-2 flex-wrap mb-3">
              <input type="file" id="sown-img-${s.__backendId}" accept="image/*" class="hidden"
                onchange="handleImageSelected('sown-img-${s.__backendId}','${s.__backendId}','sown_image_url','sown_images','${s.variety_id}')">
              <button type="button" class="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded"
                onclick="pickImageFile('sown-img-${s.__backendId}')">🖼️ Byt bild</button>
              ${s.sown_image_url ? `<button type="button" class="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded"
                onclick="removeImageField('${s.__backendId}','sown_image_url')">🗑️ Ta bort bild</button>` : ``}
            </div>
            <p class="text-sm text-gray-700 mb-3">Omskolat: ${usage.potted} • Utplanterat: ${usage.planted} • Förlorat: ${usage.lost}</p>

            <div class="grid gap-3 md:grid-cols-3">
              <div class="bg-white rounded-xl p-3 border border-blue-100">
                <p class="font-semibold text-blue-900 mb-2">🪴 Omskola från batch</p>
                <div class="grid gap-2">
                  <input type="number" min="1" max="${remaining}" value="${remaining > 0 ? 1 : 0}" id="pot-count-${s.__backendId}" class="p-2 border rounded" placeholder="Antal">
                  <input type="date" id="pot-date-${s.__backendId}" value="${todayISO()}" class="p-2 border rounded">
                  <select id="pot-by-${s.__backendId}" class="p-2 border rounded">
                    <option value="Elin">Elin</option>
                    <option value="Louise">Louise</option>
                  </select>
                  <button type="button" onclick="registerPotting('${s.__backendId}')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all">🪴 Omskola</button>
                </div>
              </div>

              <div class="bg-white rounded-xl p-3 border border-emerald-100">
                <p class="font-semibold text-emerald-900 mb-2">🌿 Plantera ut</p>
                <div class="grid gap-2">
                  <input type="number" min="1" max="${remaining}" value="${remaining > 0 ? 1 : 0}" id="plant-count-${s.__backendId}" class="p-2 border rounded" placeholder="Antal">
                  <input type="date" id="plant-date-${s.__backendId}" value="${todayISO()}" class="p-2 border rounded">
                  <select id="plant-by-${s.__backendId}" class="p-2 border rounded">
                    <option value="Elin">Elin</option>
                    <option value="Louise">Louise</option>
                  </select>
                  <input type="text" id="plant-garden-${s.__backendId}" class="p-2 border rounded" placeholder="Vems trädgård?">
                  <input type="text" id="plant-location-${s.__backendId}" class="p-2 border rounded" placeholder="Plats i trädgården">
                  <textarea id="plant-note-${s.__backendId}" class="p-2 border rounded text-sm" rows="2" placeholder="Anteckning"></textarea>
                  <input type="file" id="plant-image-${s.__backendId}" accept="image/*" class="p-2 border rounded text-sm bg-white">
                  <button type="button" onclick="registerPlantOut('${s.__backendId}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all">🌿 Plantera ut</button>
                </div>
              </div>

              <div class="bg-white rounded-xl p-3 border border-red-100">
                <p class="font-semibold text-red-900 mb-2">💀 Förlust från batch</p>
                <div class="grid gap-2">
                  <input type="number" min="0" max="${remaining}" value="0" id="loss-count-${s.__backendId}" class="p-2 border rounded" placeholder="Antal">
                  <input type="date" id="loss-date-${s.__backendId}" value="${todayISO()}" class="p-2 border rounded">
                  <select id="loss-stage-${s.__backendId}" class="p-2 border rounded">
                    <option value="">Välj läge</option>
                    <option>Grodd</option>
                    <option>Spirad</option>
                    <option>Blad</option>
                    <option>Omskolad</option>
                    <option>Växande</option>
                  </select>
                  <button type="button" onclick="registerLoss('${s.__backendId}', '${escapeHtml(s.sown_by||"")}')" class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-all">💀 Registrera förlust</button>
                </div>
              </div>
            </div>

            <div class="flex gap-2 flex-wrap justify-end mt-3">
              <button type="button" onclick="editEvent('${s.__backendId}')" class="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-semibold transition-all">✏️ Redigera batch</button>
              <button type="button" onclick="deleteEvent('${s.__backendId}')" class="bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-lg text-sm font-semibold transition-all">🗑️ Ta bort batch</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("") + `</div>`);

  lossFormList.innerHTML = `
    <div class="text-sm text-gray-600">
      Här kan ni dela upp samma batch mellan olika händelser. En batch kan både omskolas, planteras ut i Elins eller Louises trädgård och delvis gå förlorad.
    </div>
  `;

  const historyHtml = [];
  if (pottedBatches.length) {
    historyHtml.push(`<div class="mt-2 text-sm font-bold text-gray-800 mb-2">🪴 Omskolningar</div>`);
    historyHtml.push(pottedBatches.map(p => `
      <div class="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-600">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
          <div>
            <p class="font-bold text-blue-900">${escapeHtml(p.variety_name)}</p>
            <p class="text-sm text-blue-700">${Number(p.potted_count||0)} plantor • ${new Date(p.potted_date).toLocaleDateString("sv-SE")} • ${escapeHtml(p.potted_by||"")}</p>
          </div>
          <div class="w-full sm:w-auto flex gap-2 flex-wrap justify-end">
            <button type="button" onclick="editEvent('${p.__backendId}')" class="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded transition-all">✏️ Redigera</button>
            <button type="button" onclick="deleteEvent('${p.__backendId}')" class="text-xs bg-red-200 hover:bg-red-300 text-red-800 px-3 py-2 rounded transition-all">🗑️ Ta bort</button>
          </div>
        </div>
      </div>
    `).join(""));
  }

  if (plantedOutBatches.length) {
    historyHtml.push(`<div class="mt-4 text-sm font-bold text-gray-800 mb-2">🌿 Utplanteringar</div>`);
    historyHtml.push(plantedOutBatches.map(p => `
      <div class="bg-emerald-50 rounded-lg p-4 border-l-4 border-emerald-600">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
          <div>
            ${p.planted_out_image_url ? `<img src="${escapeHtml(p.planted_out_image_url)}" alt="Utplanterad" class="w-full h-36 object-cover rounded-xl mb-3 border border-emerald-100">` : ``}
            <p class="font-bold text-emerald-900">${escapeHtml(p.variety_name)}</p>
            <p class="text-sm text-emerald-700">${Number(p.planted_out_count||0)} utplanterade • ${new Date(p.planted_out_date).toLocaleDateString("sv-SE")} • ${escapeHtml(p.planted_out_by||"")}</p>
            <p class="text-sm text-gray-700">${escapeHtml(p.garden_name||"")} • ${escapeHtml(p.location_name||"")}</p>
            ${p.location_note ? `<p class="text-sm text-gray-600 mt-1">${escapeHtml(p.location_note)}</p>` : ``}
          </div>
          <div class="w-full sm:w-auto flex gap-2 flex-wrap justify-end">
            <button type="button" onclick="editEvent('${p.__backendId}')" class="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded transition-all">✏️ Redigera</button>
            <button type="button" onclick="deleteEvent('${p.__backendId}')" class="text-xs bg-red-200 hover:bg-red-300 text-red-800 px-3 py-2 rounded transition-all">🗑️ Ta bort</button>
          </div>
        </div>
      </div>
    `).join(""));
  }

  historyHtml.push(losses.length === 0 ? `<p class='text-gray-500'>Inga förluster registrerade</p>` : `<div class="mt-4 text-sm font-bold text-gray-800 mb-2">💀 Förluster</div>` + losses
      .sort((a,b)=> new Date(b.loss_date) - new Date(a.loss_date))
      .map(l => `
        <div class="bg-red-50 rounded-lg p-4 border-l-4 border-red-600">
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
            <div>
              <p class="font-bold text-red-900">${escapeHtml(l.variety_name)}</p>
              <p class="text-sm text-red-700">${Number(l.lost_count)||0} frön • ${new Date(l.loss_date).toLocaleDateString("sv-SE")} • ${escapeHtml(l.lost_stage||"")} • ${escapeHtml(l.lost_by||"")}</p>
            </div>
            <div class="w-full sm:w-auto flex gap-2 flex-wrap justify-end">
              <button type="button" onclick="editEvent('${l.__backendId}')" class="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded transition-all">✏️ Redigera</button>
              <button type="button" onclick="deleteEvent('${l.__backendId}')" class="text-xs bg-red-200 hover:bg-red-300 text-red-800 px-3 py-2 rounded transition-all">🗑️ Ta bort</button>
            </div>
          </div>
        </div>
      `).join(""));

  lossHistory.innerHTML = historyHtml.join("");
}

// ---------- Calendar ----------
function updateCalendar(){
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  document.getElementById("calendar-month").textContent =
    currentMonth.toLocaleDateString("sv-SE", { month: "long", year: "numeric" });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  let html = "";
  for (let i = 0; i < startingDayOfWeek; i++) html += "<div class='bg-gray-50 rounded-lg'></div>";

  for (let day = 1; day <= daysInMonth; day++){
    const date = new Date(year, month, day);
    const isToday = new Date().toDateString() === date.toDateString();
    html += `
      <div class="bg-white rounded-lg p-2 calendar-day border-2 ${isToday ? "border-emerald-600 bg-emerald-50" : "border-gray-200"}">
        <div class="font-bold text-sm ${isToday ? "text-emerald-700" : "text-gray-600"}">${day}</div>
      </div>
    `;
  }

  document.getElementById("calendar-grid").innerHTML = html;

  const elinTasks = [...getTasks("Elin", 30), ...getPlantTasks("Elin", 30), ...getPlantOutLogs("Elin", 30)];
  const louiseTasks = [...getTasks("Louise", 30), ...getPlantTasks("Louise", 30), ...getPlantOutLogs("Louise", 30)];

  document.getElementById("elin-tasks").innerHTML = elinTasks.length === 0
    ? "<p class='text-gray-500'>Inga uppgifter</p>"
    : elinTasks.map(t => `<div class="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-600"><p class="font-semibold text-blue-900">${t.date}</p><p class="text-sm text-blue-700">${t.text}</p></div>`).join("");

  document.getElementById("louise-tasks").innerHTML = louiseTasks.length === 0
    ? "<p class='text-gray-500'>Inga uppgifter</p>"
    : louiseTasks.map(t => `<div class="p-3 bg-purple-50 rounded-lg border-l-4 border-purple-600"><p class="font-semibold text-purple-900">${t.date}</p><p class="text-sm text-purple-700">${t.text}</p></div>`).join("");
}

function getTasks(person, days){
  const tasks = [];
  const today = new Date();
  const sown = allData.filter(d => d.record_type === "sown" && d.sown_by === person);

  sown.forEach(s => {
    if (!s.sown_date) return;
    const sowDate = new Date(s.sown_date);
    const pottingDay = 14; // enkel regel
    const pottingDate = new Date(sowDate);
    pottingDate.setDate(pottingDate.getDate() + pottingDay);

    const daysLeft = Math.floor((pottingDate - today) / (1000*60*60*24));
    if (daysLeft >= 0 && daysLeft <= 30) {
      tasks.push({
        date: pottingDate.toLocaleDateString("sv-SE"),
        text: `🪴 Omskola ${s.variety_name} (${daysLeft === 0 ? "IDAG!" : "om " + daysLeft + "d"})`
      });
    }
  });

  return tasks.sort((a,b)=> new Date(a.date) - new Date(b.date));
}


function getPlantOutLogs(person, days){
  const tasks = [];
  const today = new Date();
  const plantings = allData.filter(d => d.record_type === "planted_out" && d.planted_out_by === person);
  plantings.forEach(p => {
    if(!p.planted_out_date) return;
    const date = new Date(p.planted_out_date);
    const diff = Math.floor((today - date) / (1000*60*60*24));
    if(diff >= 0 && diff <= days){
      tasks.push({
        date: date.toLocaleDateString("sv-SE"),
        text: `🌿 Utplanterat ${p.variety_name} i ${p.location_name || p.garden_name || "trädgården"}`
      });
    }
  });
  return tasks.sort((a,b)=> new Date(a.date) - new Date(b.date));
}

window.previousMonth = function(){
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  updateCalendar();
};

window.nextMonth = function(){
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  updateCalendar();
};

// ---------- Actions ----------
async function handleAddVariety(e){
  e.preventDefault();
  const id = "variety_" + Date.now();
  const nameEl = document.getElementById("variety-name");
  if(!nameEl || !nameEl.value.trim()){
    alert("Fyll i namn på frösorten först.");
    return;
  }

  // Optional image upload (seed packet)
  let variety_image_url = "";
  const fileEl = document.getElementById("variety-image");
  const file = fileEl && fileEl.files ? fileEl.files[0] : null;
  if(file){
    try{
      variety_image_url = await uploadImageToStorage(file, "variety_images", id);
    }catch(err){
      console.error("Variety image upload failed:", err);
      alert("Kunde inte ladda upp bilden. Du kan spara frösorten utan bild och prova igen senare.");
    }
  }

  const payload = {
    record_type: "variety",
    variety_id: id,
    variety_name: document.getElementById("variety-name").value,
    variety_image_url: variety_image_url,
    english_name: document.getElementById("variety-english-name").value,
    category: document.getElementById("variety-category").value,
    perennial: document.getElementById("variety-perennial").value,
    bloom_time: document.getElementById("variety-bloom-time").value,
    location: document.getElementById("variety-location").value,
    germination_days: document.getElementById("variety-germination").value,
    sow_time: document.getElementById("variety-sow-time").value,
    height: document.getElementById("variety-height").value,
    color: document.getElementById("variety-color").value,
    plant_out_after_days: document.getElementById("variety-plant-after")?.value || 0,
    notes: document.getElementById("variety-notes").value
  };

  const res = await createRecord(payload);
  if (res.isOk) {
    document.getElementById("variety-form").reset();
    const f = document.getElementById("variety-image");
    if(f) f.value = "";
  }
}

async function handleSowForm(e){
  e.preventDefault();
  const varietySelect = document.getElementById("sow-variety");
  if(!varietySelect || !varietySelect.value){
    alert("Välj en frösort först.");
    return;
  }
  const varietyId = varietySelect.value;
  const varietyName = varietySelect.options[varietySelect.selectedIndex]?.text || "";

  // Optional image upload for this sowing batch
  let sown_image_url = "";
  const imgEl = document.getElementById("sow-image");
  const file = imgEl && imgEl.files ? imgEl.files[0] : null;
  if(file){
    try{
      const nameBase = `sow_${varietyId}_${document.getElementById("sow-date").value || todayISO()}`;
      sown_image_url = await uploadImageToStorage(file, "sown_images", nameBase);
    }catch(err){
      console.error("Sow image upload failed:", err);
      alert("Kunde inte ladda upp bilden. Sådden kan ändå sparas utan bild.");
    }
  }

  // Batch = en sown-post (som i originalet)
  const batchId = "batch_" + Date.now();

  const payload = {
    record_type: "sown",
    batch_id: batchId,
    variety_id: varietyId,
    variety_name: varietyName,
    sown_date: document.getElementById("sow-date").value,
    sown_count: parseInt(document.getElementById("sow-count").value, 10),
    sown_by: document.getElementById("sow-by").value,
    sown_image_url: sown_image_url
  };

  const res = await createRecord(payload);
  if (res.isOk){
    document.getElementById("sow-form").reset();
    document.getElementById("sow-date").value = todayISO();
    document.getElementById("sow-count").value = "1";
    const im = document.getElementById("sow-image");
    if(im) im.value = "";
  }
}

window.deleteVariety = async function(varietyId){
  const rec = allData.find(d => d.record_type === "variety" && d.variety_id === varietyId);
  if (!rec) return;
  if (!confirm("Ta bort frösorten?")) return;
  await deleteRecord(rec.__backendId);
};


window.registerPotting = async function(sownBackendId){
  const rec = allData.find(d => d.__backendId === sownBackendId);
  if (!rec) return;
  const remaining = getRemainingForSown(rec);
  const count = parseInt(document.getElementById(`pot-count-${sownBackendId}`)?.value || "0", 10);
  const date = document.getElementById(`pot-date-${sownBackendId}`)?.value || todayISO();
  const by = document.getElementById(`pot-by-${sownBackendId}`)?.value || rec.sown_by || "";

  if (!count || count < 1) return alert("Ange antal att omskola.");
  if (count > remaining) return alert("Du kan inte omskola fler än som finns kvar i batchen.");

  const payload = {
    record_type: "potted",
    batch_id: rec.batch_id || rec.__backendId,
    variety_id: rec.variety_id,
    variety_name: rec.variety_name,
    potted_date: date + "T00:00:00Z",
    potted_count: count,
    potted_by: by,
    source_sown_backend_id: sownBackendId
  };
  await createRecord(payload);
  document.getElementById(`pot-count-${sownBackendId}`).value = "1";
};

window.registerPlantOut = async function(sownBackendId){
  const rec = allData.find(d => d.__backendId === sownBackendId);
  if (!rec) return;
  const remaining = getRemainingForSown(rec);

  const count = parseInt(document.getElementById(`plant-count-${sownBackendId}`)?.value || "0", 10);
  const date = document.getElementById(`plant-date-${sownBackendId}`)?.value || todayISO();
  const by = document.getElementById(`plant-by-${sownBackendId}`)?.value || "";
  const garden = document.getElementById(`plant-garden-${sownBackendId}`)?.value || "";
  const location = document.getElementById(`plant-location-${sownBackendId}`)?.value || "";
  const note = document.getElementById(`plant-note-${sownBackendId}`)?.value || "";
  const fileInput = document.getElementById(`plant-image-${sownBackendId}`);
  const file = fileInput && fileInput.files ? fileInput.files[0] : null;

  if (!count || count < 1) return alert("Ange antal att plantera ut.");
  if (count > remaining) return alert("Du kan inte plantera ut fler än som finns kvar i batchen.");
  if (!by) return alert("Välj vem som planterade ut.");
  if (!garden.trim()) return alert("Skriv vems trädgård det gäller.");
  if (!location.trim()) return alert("Skriv var i trädgården plantan hamnade.");

  let planted_out_image_url = "";
  if(file){
    try{
      planted_out_image_url = await uploadImageToStorage(file, "plantout_images", `${rec.variety_id}_${by}_${date}`);
    }catch(err){
      console.error("Plant out image upload failed:", err);
      alert("Kunde inte ladda upp bilden. Utplanteringen sparas utan bild.");
    }
  }

  const payload = {
    record_type: "planted_out",
    batch_id: rec.batch_id || rec.__backendId,
    variety_id: rec.variety_id,
    variety_name: rec.variety_name,
    planted_out_date: date + "T00:00:00Z",
    planted_out_count: count,
    planted_out_by: by,
    garden_name: garden,
    location_name: location,
    location_note: note,
    planted_out_image_url,
    source_sown_backend_id: sownBackendId
  };
  await createRecord(payload);
  if(fileInput) fileInput.value = "";
  document.getElementById(`plant-count-${sownBackendId}`).value = "1";
};

window.registerLoss = async function(sowId, sowedBy){
  const sowRecord = allData.find(d => d.__backendId === sowId);
  if (!sowRecord) return;

  const remaining = getRemainingForSown(sowRecord);
  const count = parseInt(document.getElementById(`loss-count-${sowId}`).value || "0", 10);
  const date = document.getElementById(`loss-date-${sowId}`).value || todayISO();
  const stage = document.getElementById(`loss-stage-${sowId}`).value;

  if (!count || count < 1){
    alert("Ange antal döda frön");
    return;
  }
  if (count > remaining){
    alert("Du kan inte registrera fler förluster än som finns kvar i batchen.");
    return;
  }

  const payload = {
    batch_id: sowRecord.batch_id || sowRecord.__backendId,
    record_type: "loss",
    variety_id: sowRecord.variety_id,
    variety_name: sowRecord.variety_name,
    loss_date: date + "T00:00:00Z",
    lost_stage: stage,
    lost_count: count,
    lost_by: sowedBy
  };

  const res = await createRecord(payload);
  if (res.isOk){
    document.getElementById(`loss-count-${sowId}`).value = "0";
    document.getElementById(`loss-stage-${sowId}`).value = "";
  }
};

window.deleteLoss = async function(lossBackendId){
  const rec = allData.find(d => d.__backendId === lossBackendId);
  if (!rec) return;
  if (!confirm("Ta bort förlusten?")) return;
  await deleteRecord(lossBackendId);
};

window.deleteLoss = async function(lossBackendId){
  const rec = allData.find(d => d.__backendId === lossBackendId);
  if (!rec) return;
  if (!confirm("Ta bort förlusten?")) return;
  await deleteRecord(lossBackendId);
};

// expose for form handlers
window.handleAddVariety = handleAddVariety;
window.handleSowForm = handleSowForm;


// ---------- Overview & Reviews ----------


function updateOverview(){
  const varieties = allData.filter(d => d.record_type === "variety");
  const sown = allData.filter(d => d.record_type === "sown" && d.variety_id);
  const losses = allData.filter(d => d.record_type === "loss");
  const plantedOut = allData.filter(d => d.record_type === "planted_out");
  const potted = allData.filter(d => d.record_type === "potted");
  const comments = allData.filter(d => d.record_type === "comment");
  const reviews = allData.filter(d => d.record_type === "review");

  const container = document.getElementById("overview-content");
  if(!container) return;

  const avgForVariety = (varietyId) => {
    const rs = reviews.filter(r => r.variety_id === varietyId && (r.reviewer === "Elin" || r.reviewer === "Louise"));
    return rs.length ? rs.reduce((s,r)=>s+(Number(r.rating)||0),0)/rs.length : 0;
  };

  const favorites = varieties
    .map(v => ({ v, avg: avgForVariety(v.variety_id) }))
    .filter(x => x.avg > 0)
    .sort((a,b)=> b.avg-a.avg)
    .slice(0,5);

  const favoritesHtml = `
    <div class="overview-favorite-card">
      <div class="overview-block-title">🏆 Årets favoriter</div>
      ${favorites.length === 0 ? `<p class="muted">Inga betyg än.</p>` :
        `<div class="overview-favorite-grid">
          ${favorites.map((x,idx)=>`
            <div class="review-soft-card">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="review-name" style="font-size:1.45rem">${idx+1}. ${escapeHtml(x.v.variety_name)}</div>
                  <div class="muted text-sm">${escapeHtml(x.v.category || "Okänd kategori")}</div>
                </div>
                <div class="stat-chip">★ ${x.avg.toFixed(1)}</div>
              </div>
            </div>
          `).join('')}
        </div>`}
    </div>
  `;

  container.innerHTML = `<div class="overview-shell">` + favoritesHtml + varieties.map(v => {
    const vSown = sown.filter(s => s.variety_id === v.variety_id);
    const vLoss = losses.filter(l => l.variety_id === v.variety_id);
    const vPotted = potted.filter(p => p.variety_id === v.variety_id);
    const vPlantedOut = plantedOut.filter(p => p.variety_id === v.variety_id);
    const vComments = comments.filter(c => c.variety_id === v.variety_id);
    const vReviews = reviews.filter(r => r.variety_id === v.variety_id && (r.reviewer === "Elin" || r.reviewer === "Louise"));
    const rElin = vReviews.find(r => r.reviewer === "Elin");
    const rLouise = vReviews.find(r => r.reviewer === "Louise");

    const totalSown = vSown.reduce((s,d)=> s + (Number(d.sown_count)||0),0);
    const totalLost = vLoss.reduce((s,d)=> s + (Number(d.lost_count)||0),0);
    const totalPotted = vPotted.reduce((s,d)=> s + (Number(d.potted_count)||0),0);
    const totalPlanted = vPlantedOut.reduce((s,d)=> s + (Number(d.planted_out_count)||0),0);
    const avg = vReviews.length ? vReviews.reduce((s,r)=> s + (Number(r.rating)||0),0)/vReviews.length : 0;
    const yes = vReviews.filter(r=>r.grow_again==="yes").length;
    const no = vReviews.filter(r=>r.grow_again==="no").length;
    const summary = yes>no ? "Vi vill gärna odla den igen." : no>yes ? "Vi satsar troligen på annat nästa år." : "Vi har ännu inget gemensamt beslut.";

    const reviewCard = (name, r) => `
      <div class="review-soft-card">
        <div class="flex items-center justify-between gap-3">
          <div class="review-name">${name}</div>
          <div class="stat-chip">${r && r.rating ? `★ ${Number(r.rating).toFixed(1)}` : "Inget betyg"}</div>
        </div>
        ${r && r.review_image_url ? `<img src="${escapeHtml(r.review_image_url)}" alt="${name} bild">` : ``}
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
          <input type="number" min="1" max="5" id="rating-${name}-${v.variety_id}" value="${r?.rating||''}" placeholder="Betyg 1-5" class="p-2 border rounded">
          <select id="grow-${name}-${v.variety_id}" class="p-2 border rounded">
            <option value="">Odla igen?</option>
            <option value="yes" ${(r?.grow_again==="yes")?"selected":""}>Ja</option>
            <option value="no" ${(r?.grow_again==="no")?"selected":""}>Nej</option>
          </select>
          <input type="file" id="image-${name}-${v.variety_id}" accept="image/*" class="p-2 border rounded text-sm bg-white">
        </div>
        <textarea id="note-${name}-${v.variety_id}" placeholder="Din kommentar om blomman..." class="mt-2 w-full p-2 border rounded text-sm">${r?.note || ''}</textarea>
        <div class="flex gap-2 flex-wrap mt-2">
          <button onclick="saveReviewFor('${name}','${v.variety_id}','${escapeHtml(v.variety_name)}')" class="bg-emerald-600 text-white px-3 py-2 rounded text-sm">Spara ${name}</button>
          ${r ? `<button onclick="deleteReview('${r.__backendId}')" class="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded text-sm">Ta bort</button>` : ``}
        </div>
      </div>
    `;

    return `
      <div class="overview-card">
        <div class="overview-top">
          <div>
            <div class="serif text-4xl">${escapeHtml(v.variety_name)}</div>
            <div class="overview-meta">
              <span>${escapeHtml(v.category || "Okänd kategori")}</span>
              <span>•</span>
              <span>${totalSown} frön sådda</span>
              <span>•</span>
              <span>${totalPotted} omskolade</span>
              <span>•</span>
              <span>${totalPlanted} utplanterade</span>
              <span>•</span>
              <span>${totalLost} gick förlorade</span>
              ${avg ? `<span>•</span><span>Snittbetyg ${avg.toFixed(1)}</span>` : ``}
            </div>
          </div>
          ${v.variety_image_url ? `<img src="${escapeHtml(v.variety_image_url)}" alt="Fröpåse" class="h-24 w-24 rounded-2xl object-cover border" style="border-color:var(--line)">` : ``}
        </div>

        <div class="overview-divider"></div>

        <div class="mt-5">
          <div class="overview-block-title">💬 Kommentarer</div>
          ${vComments.length ? vComments.map(c=>`
            <div class="comment-entry">
              <div class="flex items-start justify-between gap-2">
                <div class="text-xs muted">${new Date(c.createdAt?.seconds*1000 || Date.now()).toLocaleDateString("sv-SE")} • ${c.comment_by}</div>
                <div class="flex gap-2">
                  <button class="text-xs px-2 py-1 rounded" onclick="editEvent('${c.__backendId}')" style="background:#f5f2ee;border:1px solid var(--line)">Redigera</button>
                  <button class="text-xs px-2 py-1 rounded" onclick="deleteComment('${c.__backendId}')" style="background:#f8f3f3;border:1px solid rgba(160,120,120,.20)">Ta bort</button>
                </div>
              </div>
              <div class="mt-1">${escapeHtml(c.comment_text)}</div>
            </div>
          `).join("") : `<p class="muted">Inga kommentarer ännu.</p>`}
          <div class="flex gap-2 mt-3">
            <input type="text" id="comment-${v.variety_id}" placeholder="Skriv kommentar..." class="flex-1 p-2 border rounded text-sm">
            <button onclick="addComment('${v.variety_id}','${escapeHtml(v.variety_name)}')" class="bg-emerald-600 text-white px-3 py-2 rounded text-sm">Spara</button>
          </div>
        </div>


        <div class="mt-6">
          <div class="overview-block-title">🌿 Utplanteringar</div>
          ${vPlantedOut.length ? `<div class="review-grid-soft">
            ${vPlantedOut.map(p => `
              <div class="review-soft-card">
                <div class="flex items-center justify-between gap-3">
                  <div class="review-name" style="font-size:1.5rem">${escapeHtml(p.planted_out_by || "")}</div>
                  <div class="stat-chip">${Number(p.planted_out_count)||0} st</div>
                </div>
                ${p.planted_out_image_url ? `<img src="${escapeHtml(p.planted_out_image_url)}" alt="Utplanterad bild">` : ``}
                <div class="mt-3 text-sm text-gray-700">
                  <div><strong>Trädgård:</strong> ${escapeHtml(p.garden_name || "")}</div>
                  <div><strong>Plats:</strong> ${escapeHtml(p.location_name || "")}</div>
                  <div><strong>Datum:</strong> ${new Date(p.planted_out_date).toLocaleDateString("sv-SE")}</div>
                  ${p.location_note ? `<div class="mt-2">${escapeHtml(p.location_note)}</div>` : ``}
                </div>
              </div>
            `).join("")}
          </div>` : `<p class="muted">Ingen utplantering registrerad ännu.</p>`}
        </div>

        <div class="mt-6">
          <div class="overview-block-title">⭐ Omdöme</div>
          <div class="review-grid-soft">
            ${reviewCard("Elin", rElin)}
            ${reviewCard("Louise", rLouise)}
          </div>
          ${(rElin || rLouise) ? `
            <div class="summary-note mt-4">
              <div class="serif text-xl">Samlat omdöme</div>
              <div class="mt-2">${summary}</div>
            </div>` : ``}
        </div>
      </div>
    `;
  }).join("") + `</div>`;
}

window.addComment = async function(varietyId, varietyName){
  try {
    const input = document.getElementById("comment-"+varietyId);
    if(!input || !input.value) return;

    await createRecord({
      record_type:"comment",
      variety_id: varietyId,
      variety_name: varietyName,
      comment_text: input.value,
      comment_by: "Elin & Louise",
      createdAt: new Date().toISOString()
    });

    input.value = "";
  } catch(error){
    console.error("Comment save error:", error);
    alert("Kunde inte spara kommentaren.");
  }
};


window.saveReviewFor = async function(reviewer, varietyId, varietyName){
  try {
    const ratingInput = document.getElementById(`rating-${reviewer}-${varietyId}`);
    const growInput = document.getElementById(`grow-${reviewer}-${varietyId}`);
    const noteInput = document.getElementById(`note-${reviewer}-${varietyId}`);
    const fileInput = document.getElementById(`image-${reviewer}-${varietyId}`);

    const rating = parseInt(ratingInput?.value || "", 10);
    const grow = growInput ? growInput.value : "";
    const note = noteInput ? noteInput.value : "";

    if(!rating || rating < 1 || rating > 5){
      alert("Ange betyg 1–5");
      return;
    }

    let review_image_url = "";
    const file = (fileInput && fileInput.files) ? fileInput.files[0] : null;
    if(file){
      try{
        review_image_url = await uploadImageToStorage(file, "review_images", `${varietyId}_${reviewer}`);
      }catch(err){
        console.error("Review image upload failed:", err);
        alert("Kunde inte ladda upp bilden. Omdömet kan ändå sparas utan bild.");
      }
    }

    const existing = allData.find(d => d.record_type === "review" && d.variety_id === varietyId && d.reviewer === reviewer);
    const payload = {
      record_type: "review",
      variety_id: varietyId,
      variety_name: varietyName,
      reviewer,
      rating,
      grow_again: grow || "",
      note: note || ""
    };
    if(review_image_url) payload.review_image_url = review_image_url;

    if(existing){
      await updateRecord(existing.__backendId, payload);
    } else {
      await createRecord(payload);
    }

    if(fileInput) fileInput.value = "";
    alert(`Omdöme sparat för ${reviewer} ✅`);
  } catch(error){
    console.error("Review save error:", error);
    alert("Något gick fel när omdömet sparades.");
  }
};

// Extend calendar logic with plant-out dates
function getPlantTasks(person, days){
  const tasks = [];
  const today = new Date();
  const sown = allData.filter(d => d.record_type === "sown" && d.sown_by === person);

  sown.forEach(s => {
    const variety = allData.find(v => v.record_type === "variety" && v.variety_id === s.variety_id);
    if(!variety) return;

    const plantAfter = parseInt(variety.plant_out_after_days || 0, 10);
    if(!plantAfter) return;

    const sowDate = new Date(s.sown_date);
    const plantDate = new Date(sowDate);
    plantDate.setDate(plantDate.getDate() + plantAfter);

    const daysLeft = Math.floor((plantDate - today) / (1000*60*60*24));
    if(daysLeft >= 0 && daysLeft <= days){
      tasks.push({
        date: plantDate.toLocaleDateString("sv-SE"),
        text: "🌤 Plantera ut " + s.variety_name + (daysLeft===0?" IDAG!":" om "+daysLeft+"d")
      });
    }
  });

  return tasks;
}


// ---------- Edit/Delete helpers (global for onclick) ----------
window.deleteEvent = async function(backendId){
  try{
    const rec = allData.find(d => d.__backendId === backendId);
    if(!rec) return alert("Händelsen hittas inte.");
    const label = rec.record_type === "sown" ? "sådd" : rec.record_type === "potted" ? "omskolning" : rec.record_type === "planted_out" ? "utplantering" : rec.record_type === "loss" ? "förlust" : rec.record_type;
    if(!confirm("Ta bort " + label + " för " + (rec.variety_name || "") + "?")) return;
    await deleteRecord(backendId);

// Force UI refresh so overview & stats update immediately
try{
  allData = allData.filter(d => d.__backendId !== backendId);
  updateUI();
}catch(e){
  console.warn("UI refresh fallback", e);
}
  }catch(e){
    console.error(e);
    alert("Kunde inte ta bort.");
  }
};

window.editEvent = async function(backendId){
  try{
    const rec = allData.find(d => d.__backendId === backendId);
    if(!rec) return alert("Händelsen hittas inte.");
    const type = rec.record_type;

    if(type === "sown" || type === "potted" || type === "planted_out"){
      const currentCount = type === "sown" ? rec.sown_count : type === "potted" ? (rec.potted_count ?? rec.sown_count) : (rec.planted_out_count ?? 0);
      const newCount = prompt("Antal (frön/plantor):", String(currentCount ?? ""));
      if(newCount === null) return;
      const count = parseInt(newCount, 10);
      if(Number.isNaN(count) || count < 0) return alert("Ogiltigt antal.");

      const dateKey = type === "sown" ? "sown_date" : type === "potted" ? "potted_date" : "planted_out_date";
      const currentDate = (rec[dateKey] || "").slice(0,10) || "";
      const newDate = prompt("Datum (YYYY-MM-DD):", currentDate);
      if(newDate === null) return;

      const byKey = type === "sown" ? "sown_by" : type === "potted" ? "potted_by" : "planted_out_by";
      const newBy = prompt("Vem? (Elin/Louise):", rec[byKey] || "");
      if(newBy === null) return;

      const patch = {};
      if(type === "sown"){
        patch.sown_count = count;
        patch.sown_date = newDate;
        patch.sown_by = newBy;
      }else if(type === "potted"){
        patch.potted_count = count;
        patch.potted_date = newDate + "T00:00:00Z";
        patch.potted_by = newBy;
      }else{
        const newGarden = prompt("Vems trädgård?", rec.garden_name || "");
        if(newGarden === null) return;
        const newLocation = prompt("Plats i trädgården:", rec.location_name || "");
        if(newLocation === null) return;
        const newNote = prompt("Anteckning:", rec.location_note || "");
        if(newNote === null) return;
        patch.planted_out_count = count;
        patch.planted_out_date = newDate + "T00:00:00Z";
        patch.planted_out_by = newBy;
        patch.garden_name = newGarden;
        patch.location_name = newLocation;
        patch.location_note = newNote;
      }
      await updateRecord(backendId, patch);
      alert("Uppdaterat ✅");
      return;
    }

    if(type === "loss"){
      const newCount = prompt("Antal förlorade:", String(rec.lost_count ?? ""));
      if(newCount === null) return;
      const count = parseInt(newCount, 10);
      if(Number.isNaN(count) || count < 0) return alert("Ogiltigt antal.");

      const currentDate = (rec.loss_date || "").slice(0,10) || "";
      const newDate = prompt("Datum (YYYY-MM-DD):", currentDate);
      if(newDate === null) return;

      const newStage = prompt("Läge (Grodd/Spirad/Blad/Omskold/Växande):", rec.lost_stage || "");
      if(newStage === null) return;

      const newBy = prompt("Vem? (Elin/Louise):", rec.lost_by || "");
      if(newBy === null) return;

      await updateRecord(backendId, {
        lost_count: count,
        loss_date: newDate + "T00:00:00Z",
        lost_stage: newStage,
        lost_by: newBy
      });
      alert("Uppdaterat ✅");
      return;
    }

    if(type === "comment"){
      const newText = prompt("Ändra kommentar:", rec.comment_text || "");
      if(newText === null) return;
      await updateRecord(backendId, { comment_text: newText });
      alert("Uppdaterat ✅");
      return;
    }

    if(type === "review"){
      const newRating = prompt("Ändra betyg (1–5):", String(rec.rating ?? ""));
      if(newRating === null) return;
      const rating = parseInt(newRating, 10);
      if(Number.isNaN(rating) || rating < 1 || rating > 5) return alert("Betyg måste vara 1–5.");
      const newGrow = prompt("Odla igen? (yes/no):", rec.grow_again || "");
      if(newGrow === null) return;
      await updateRecord(backendId, { rating, grow_again: newGrow });
      alert("Uppdaterat ✅");
      return;
    }

    alert("Den här typen går inte att redigera här.");
  }catch(e){
    console.error(e);
    alert("Kunde inte uppdatera.");
  }
};

window.deleteComment = async function(backendId){
  if(!confirm("Ta bort kommentaren?")) return;
  await deleteRecord(backendId);

// Force UI refresh so overview & stats update immediately
try{
  allData = allData.filter(d => d.__backendId !== backendId);
  updateUI();
}catch(e){
  console.warn("UI refresh fallback", e);
}
};
window.deleteReview = async function(backendId){
  if(!confirm("Ta bort utvärderingen?")) return;
  await deleteRecord(backendId);

// Force UI refresh so overview & stats update immediately
try{
  allData = allData.filter(d => d.__backendId !== backendId);
  updateUI();
}catch(e){
  console.warn("UI refresh fallback", e);
}
};


window.revertPotting = async function(backendId){
  try{
    const rec = allData.find(d => d.__backendId === backendId);
    if(!rec) return alert("Hittar inte batchen.");
    if(rec.record_type !== "potted") return alert("Den här batchen är inte omskolad.");
    if(!confirm("Ångra omskolning och göra den till sådd igen?")) return;

    await updateRecord(backendId, {
      record_type: "sown",
      sown_count: rec.sown_count ?? rec.potted_count ?? 0,
      sown_date: (rec.sown_date || (rec.potted_date ? String(rec.potted_date).slice(0,10) : "")),
      sown_by: rec.sown_by ?? rec.potted_by ?? ""
    });
  }catch(e){
    console.error(e);
    alert("Kunde inte ångra.");
  }
};


// ---------- SYSTEM RESET ----------
window.resetSystem = async function(){
  const confirmReset = confirm("Vill du verkligen nollställa hela systemet? Detta tar bort ALLT.");
  if(!confirmReset) return;

  const doubleCheck = prompt("Skriv RESET för att bekräfta:");
  if(doubleCheck !== "RESET"){
    alert("Avbruten.");
    return;
  }

  try{
    for(const rec of [...allData]){
      await deleteRecord(rec.__backendId);
    }
    alert("Systemet är nu nollställt.");
  }catch(e){
    console.error(e);
    alert("Kunde inte nollställa.");
  }
};


// ---------- Image replace/remove helpers ----------
window.pickImageFile = function(inputId){
  const el = document.getElementById(inputId);
  if(el) el.click();
};

window.handleImageSelected = async function(inputId, backendId, fieldName, folder, filenameBase){
  try{
    const el = document.getElementById(inputId);
    const file = el && el.files ? el.files[0] : null;
    if(!file) return;

    const url = await uploadImageToStorage(file, folder, filenameBase);
    await updateRecord(backendId, { [fieldName]: url });

    // reset input so same file can be picked again later
    el.value = "";
    alert("Bild uppdaterad ✅");
  }catch(e){
    console.error("Image update failed:", e);
    alert("Kunde inte uppdatera bilden.");
  }
};

window.removeImageField = async function(backendId, fieldName){
  try{
    if(!confirm("Ta bort bilden? (Filen kan ligga kvar i Storage, men visas inte längre i appen.)")) return;
    await updateRecord(backendId, { [fieldName]: "" });
    alert("Bild borttagen ✅");
  }catch(e){
    console.error("Remove image failed:", e);
    alert("Kunde inte ta bort bilden.");
  }
};


// ---------- PWA Install (Android/Chrome) ----------
let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  // Prevent mini-infobar
  e.preventDefault();
  deferredInstallPrompt = e;
  renderInstallCard();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  renderInstallCard(true);
});

function isIOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isStandalone(){
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function renderInstallCard(installed=false){
  const el = document.getElementById("install-card");
  if(!el) return;

  if(isStandalone() || installed){
    el.classList.add("hidden");
    return;
  }

  // Show card in overview tab (it will still exist but hidden if not on tab)
  el.classList.remove("hidden");

  if(deferredInstallPrompt){
    el.innerHTML = `
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 class="font-bold text-emerald-800 text-lg">📲 Installera appen</h3>
          <p class="text-sm text-gray-600 mt-1">Installera Systrarna Hills Odlingsapp på hemskärmen så den känns som en riktig app.</p>
        </div>
        <button id="installBtn" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">Installera</button>
      </div>
    `;
    const btn = document.getElementById("installBtn");
    if(btn){
      btn.onclick = async () => {
        try{
          deferredInstallPrompt.prompt();
          const choice = await deferredInstallPrompt.userChoice;
          if(choice && choice.outcome === "accepted"){
            deferredInstallPrompt = null;
            renderInstallCard();
          }
        }catch(e){
          console.error(e);
        }
      };
    }
  } else if(isIOS()){
    el.innerHTML = `
      <h3 class="font-bold text-emerald-800 text-lg">📲 Installera på iPhone</h3>
      <ol class="list-decimal pl-5 mt-2 text-sm text-gray-700 space-y-1">
        <li>Öppna appen i <strong>Safari</strong>.</li>
        <li>Tryck på <strong>Dela</strong> (fyrkanten med pil upp).</li>
        <li>Välj <strong>Lägg till på hemskärmen</strong>.</li>
      </ol>
      <p class="text-xs text-gray-500 mt-3">Tips: Efter installation öppnas den utan adressfält.</p>
    `;
  } else {
    el.innerHTML = `
      <h3 class="font-bold text-emerald-800 text-lg">📲 Installera appen</h3>
      <p class="text-sm text-gray-600 mt-1">I din webbläsare: meny → <strong>Installera app</strong> eller <strong>Lägg till på startskärmen</strong>.</p>
    `;
  }
}


window.toggleRegisterBatch = function(batchKey){
  if(openRegisterBatches.has(batchKey)){
    openRegisterBatches.delete(batchKey);
  }else{
    openRegisterBatches.add(batchKey);
  }
  updateRegister();
};
