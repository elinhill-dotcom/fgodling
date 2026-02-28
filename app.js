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

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

const DIARY_ID = "fgs-elin-louise";
const recordsRef = collection(db, "diaries", DIARY_ID, "records");

// ---------- State ----------
let allData = [];
let allVarieties = [];
let currentTab = "dashboard";
let currentMonth = new Date();
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
  document.getElementById("app-title").innerHTML = "🌱 FGs odlingsapp";

  const sowDateEl = document.getElementById("sow-date");
  if (sowDateEl) sowDateEl.value = todayISO();

  // Forms
  document.getElementById("variety-form").addEventListener("submit", handleAddVariety);
  document.getElementById("sow-form").addEventListener("submit", handleSowForm);
}
init();

// ---------- UI update ----------
function updateUI(){
  updateDashboard();
  if (currentTab === "calendar") updateCalendar();
  if (currentTab === "varieties") updateVarieties();
  if (currentTab === "register") updateRegister();
}

function updateDashboard(){
  const sown = allData.filter(d => d.record_type === "sown");
  const potted = allData.filter(d => d.record_type === "potted");
  const losses = allData.filter(d => d.record_type === "loss");

  const totalSown = sown.reduce((sum, d) => sum + (Number(d.sown_count)||0), 0);
  const totalPotted = potted.reduce((sum, d) => sum + (Number(d.potted_count)||0), 0);
  const totalLost = losses.reduce((sum, d) => sum + (Number(d.lost_count)||0), 0);
  const uniqueVarieties = new Set(sown.map(d => d.variety_id)).size;

  document.getElementById("stat-total-sown").textContent = totalSown;
  document.getElementById("stat-potted").textContent = totalPotted;
  document.getElementById("stat-lost").textContent = totalLost;
  document.getElementById("stat-varieties").textContent = uniqueVarieties;

  updatePersonStats(sown, losses);
  updateCharts(sown, potted, losses);
}

function updatePersonStats(sown, losses){
  const elinSown = sown.filter(d => (d.sown_by||"").includes("Elin")).reduce((s,d)=> s + (Number(d.sown_count)||0), 0);
  const louiseSown = sown.filter(d => (d.sown_by||"").includes("Louise")).reduce((s,d)=> s + (Number(d.sown_count)||0), 0);
  const elinLost = losses.filter(d => d.lost_by === "Elin").reduce((s,d)=> s + (Number(d.lost_count)||0), 0);
  const louiseLost = losses.filter(d => d.lost_by === "Louise").reduce((s,d)=> s + (Number(d.lost_count)||0), 0);

  const elinSuccess = elinSown > 0 ? Math.round(((elinSown - elinLost) / elinSown) * 100) : 0;
  const louiseSuccess = louiseSown > 0 ? Math.round(((louiseSown - louiseLost) / louiseSown) * 100) : 0;

  document.getElementById("person-stats").innerHTML = `
    <div class="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
      <div>
        <p class="font-semibold text-blue-900">👩 Elin</p>
        <p class="text-sm text-blue-600">${elinSown} sådda • ${elinLost} förlorade</p>
      </div>
      <div class="text-2xl font-bold text-blue-600">${elinSuccess}%</div>
    </div>
    <div class="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
      <div>
        <p class="font-semibold text-purple-900">👩 Louise</p>
        <p class="text-sm text-purple-600">${louiseSown} sådda • ${louiseLost} förlorade</p>
      </div>
      <div class="text-2xl font-bold text-purple-600">${louiseSuccess}%</div>
    </div>
  `;
}

function updateCharts(sown, potted, losses){
  // Success chart
  const elinSown = sown.filter(d => (d.sown_by||"").includes("Elin")).reduce((s,d)=> s + (Number(d.sown_count)||0), 0);
  const louiseSown = sown.filter(d => (d.sown_by||"").includes("Louise")).reduce((s,d)=> s + (Number(d.sown_count)||0), 0);
  const elinLost = losses.filter(d => d.lost_by === "Elin").reduce((s,d)=> s + (Number(d.lost_count)||0), 0);
  const louiseLost = losses.filter(d => d.lost_by === "Louise").reduce((s,d)=> s + (Number(d.lost_count)||0), 0);

  const successCtx = document.getElementById("successChart").getContext("2d");
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
  const weeklyCtx = document.getElementById("weeklyLossChart").getContext("2d");
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

  const categoryCtx = document.getElementById("categoryChart").getContext("2d");
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

// ---------- Register tab ----------
function updateRegister(){
  const sown = allData
    .filter(d => d.record_type === "sown")
    .sort((a,b)=> new Date(b.sown_date) - new Date(a.sown_date));

  const losses = allData.filter(d => d.record_type === "loss");

  // Potting list
  document.getElementById("sown-list").innerHTML = sown.map(s => `
    <div class="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 border-l-4 border-blue-500">
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div>
          <p class="font-bold text-gray-800">${escapeHtml(s.variety_name)}</p>
          <p class="text-sm text-gray-600">${Number(s.sown_count)||0} frön • ${new Date(s.sown_date).toLocaleDateString("sv-SE")} • Satt av: ${escapeHtml(s.sown_by||"")}</p>
        </div>
        <button type="button" onclick="registerPotting('${s.__backendId}')" class="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all">🪴 Omskola</button>
      </div>
    </div>
  `).join("");

  // Loss forms
  document.getElementById("loss-form-list").innerHTML = sown.map(s => `
    <div class="bg-white rounded-xl p-4 border-2 border-red-200">
      <p class="font-bold text-gray-800 mb-2">${escapeHtml(s.variety_name)} (${Number(s.sown_count)||0} frön sådda)</p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        <div>
          <label class="text-xs font-semibold text-gray-600">Antal döda</label>
          <input type="number" id="loss-count-${s.__backendId}" min="0" max="${Number(s.sown_count)||0}" value="0" class="w-full p-2 border border-red-300 rounded-lg text-sm">
        </div>
        <div>
          <label class="text-xs font-semibold text-gray-600">Datum</label>
          <input type="date" id="loss-date-${s.__backendId}" class="w-full p-2 border border-red-300 rounded-lg text-sm" value="${todayISO()}">
        </div>
        <div>
          <label class="text-xs font-semibold text-gray-600">Läge</label>
          <select id="loss-stage-${s.__backendId}" class="w-full p-2 border border-red-300 rounded-lg text-sm">
            <option value="">Välj</option>
            <option value="Grodd">Grodd</option>
            <option value="Spirad">Spirad</option>
            <option value="Blad">Blad</option>
            <option value="Omskold">Omskold</option>
            <option value="Växande">Växande</option>
          </select>
        </div>
      </div>
      <button type="button" onclick="registerLoss('${s.__backendId}', '${escapeHtml(s.sown_by||"")}')" class="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-all">💀 Registrera förlust</button>
    </div>
  `).join("");

  // Loss history
  document.getElementById("loss-history").innerHTML = losses.length === 0
    ? "<p class='text-gray-500'>Inga förluster registrerade</p>"
    : losses
      .sort((a,b)=> new Date(b.loss_date) - new Date(a.loss_date))
      .map(l => `
        <div class="bg-red-50 rounded-lg p-4 border-l-4 border-red-600">
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
            <div>
              <p class="font-bold text-red-900">${escapeHtml(l.variety_name)}</p>
              <p class="text-sm text-red-700">${Number(l.lost_count)||0} frön • ${new Date(l.loss_date).toLocaleDateString("sv-SE")} • ${escapeHtml(l.lost_stage||"")} • ${escapeHtml(l.lost_by||"")}</p>
            </div>
            <button type="button" onclick="deleteLoss('${l.__backendId}')" class="w-full sm:w-auto text-xs bg-red-200 hover:bg-red-300 text-red-800 px-3 py-2 rounded transition-all">🗑️ Ta bort</button>
          </div>
        </div>
      `).join("");
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

  const elinTasks = getTasks("Elin", 30);
  const louiseTasks = getTasks("Louise", 30);

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

  const payload = {
    record_type: "variety",
    variety_id: id,
    variety_name: document.getElementById("variety-name").value,
    english_name: document.getElementById("variety-english-name").value,
    category: document.getElementById("variety-category").value,
    perennial: document.getElementById("variety-perennial").value,
    bloom_time: document.getElementById("variety-bloom-time").value,
    location: document.getElementById("variety-location").value,
    germination_days: document.getElementById("variety-germination").value,
    sow_time: document.getElementById("variety-sow-time").value,
    height: document.getElementById("variety-height").value,
    color: document.getElementById("variety-color").value,
    notes: document.getElementById("variety-notes").value
  };

  const res = await createRecord(payload);
  if (res.isOk) document.getElementById("variety-form").reset();
}

async function handleSowForm(e){
  e.preventDefault();
  const varietySelect = document.getElementById("sow-variety");
  const varietyId = varietySelect.value;
  const varietyName = varietySelect.options[varietySelect.selectedIndex]?.text || "";

  // Batch = en sown-post (som i originalet)
  const payload = {
    record_type: "sown",
    variety_id: varietyId,
    variety_name: varietyName,
    sown_date: document.getElementById("sow-date").value,
    sown_count: parseInt(document.getElementById("sow-count").value, 10),
    sown_by: document.getElementById("sow-by").value
  };

  const res = await createRecord(payload);
  if (res.isOk){
    document.getElementById("sow-form").reset();
    document.getElementById("sow-date").value = todayISO();
    document.getElementById("sow-count").value = "1";
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
  // Precis som din Canva-kod: ändra record_type till potted
  await updateRecord(sownBackendId, {
    record_type: "potted",
    potted_date: new Date().toISOString(),
    potted_count: rec.sown_count,
    potted_by: rec.sown_by
  });
};

window.registerLoss = async function(sowId, sowedBy){
  const count = parseInt(document.getElementById(`loss-count-${sowId}`).value || "0", 10);
  const date = document.getElementById(`loss-date-${sowId}`).value;
  const stage = document.getElementById(`loss-stage-${sowId}`).value;

  if (!count || count === 0){
    alert("Ange antal döda frön");
    return;
  }

  const sowRecord = allData.find(d => d.__backendId === sowId);
  if (!sowRecord) return;

  const payload = {
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

// expose for form handlers
window.handleAddVariety = handleAddVariety;
window.handleSowForm = handleSowForm;
