const ADMIN_PIN = "629122";
const API_URL = "/.netlify/functions/api";
let tours = [], selectedTourId = null, selectedDayIndex = 0, selectedActivityId = null;
let isAdmin = sessionStorage.getItem("vibeAdmin") === "true";
let deferredPrompt = null, touchStartX = 0, touchStartY = 0;

const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const currentTour = () => tours.find(t => +t.id === +selectedTourId) || tours[0];
const currentDays = () => currentTour()?.days || [];
const currentDay = () => currentDays()[selectedDayIndex];

async function loadData() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Database error");
    tours = data.tours || [];
    if (!selectedTourId && tours[0]) selectedTourId = tours[0].id;
    if (!currentTour() && tours[0]) selectedTourId = tours[0].id;
    if (selectedDayIndex >= currentDays().length) selectedDayIndex = 0;
    renderAll();
  } catch (err) {
    $("schedule").innerHTML = `<div class="glass-card admin-panel"><h2><i class="fa-solid fa-triangle-exclamation"></i> Eroare database</h2><p>${esc(err.message)}</p></div>`;
  }
}

async function apiPost(action, payload = {}) {
  const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, pin: ADMIN_PIN, ...payload }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Eroare la salvare");
  tours = data.tours || tours;
  renderAll();
}

function renderAll() { renderTourSelect(); renderDays(); renderSchedule(); renderAdminSelects(); renderAdminToursList(); renderAdminList(); }
function formatTourLabel(t) { return `${t.title} ${t.emoji || ""} — ${t.start_date} / ${t.end_date}`; }
function renderTourSelect() { $("tour").innerHTML = tours.map(t => `<option value="${t.id}" ${+t.id===+selectedTourId?"selected":""}>${esc(formatTourLabel(t))}</option>`).join(""); }
function changeTour() { selectedTourId = +$("tour").value; selectedDayIndex = 0; renderAll(); }

function renderDays() {
  const box = $("days"); box.innerHTML = "";
  currentDays().forEach((d, i) => {
    const b = document.createElement("button");
    b.className = "day-btn" + (i === selectedDayIndex ? " active" : "");
    b.innerHTML = `<strong>${esc(d.name)}</strong><span><i class="fa-regular fa-calendar"></i> ${esc(d.short_label)}</span>`;
    b.onclick = () => selectDay(i, i > selectedDayIndex ? "left" : "right");
    box.appendChild(b);
  });
  setTimeout(() => box.querySelector(".active")?.scrollIntoView({behavior:"smooth", block:"nearest", inline:"center"}), 20);
}

function renderAdminSelects() {
  $("dayTour").innerHTML = tours.map(t => `<option value="${t.id}">${esc(t.title)} ${esc(t.emoji||"")}</option>`).join("");
  $("adminDay").innerHTML = currentDays().map(d => `<option value="${d.id}">${esc(d.name)} — ${esc(d.date)}</option>`).join("");
  if (currentTour()) $("dayTour").value = currentTour().id;
}

function animateSchedule(direction = "in") {
  const c = $("schedule"); c.classList.remove("animating", "swipe-left", "swipe-right"); void c.offsetWidth;
  c.classList.add(direction === "left" ? "swipe-left" : direction === "right" ? "swipe-right" : "animating");
}

function renderSchedule(direction = "in") {
  const day = currentDay(), items = day?.activities || [], c = $("schedule");
  $("dayName").textContent = day?.name || "Nicio zi";
  $("dayDate").textContent = day?.date || "Adaugă zile din Admin";
  $("totalDays").textContent = currentDays().length;
  $("totalActivities").textContent = items.length;
  if (!day) c.innerHTML = `<div class="glass-card admin-panel"><h2><i class="fa-regular fa-folder-open"></i> Nu sunt zile adăugate</h2><p>Intră în Admin Panel și adaugă zile pentru această tură.</p></div>`;
  else if (!items.length) c.innerHTML = `<div class="glass-card admin-panel"><h2><i class="fa-regular fa-folder-open"></i> Nu sunt activități adăugate</h2><p>Intră în Admin Panel și adaugă prima activitate pentru această zi.</p></div>`;
  else c.innerHTML = items.map(item => `<article class="schedule-card"><div class="schedule-header"><div class="time"><i class="fa-regular fa-clock"></i> ${esc(item.time)}</div><div class="activity"><i class="fa-solid fa-bolt"></i> ${esc(item.activity)}</div></div><div class="schedule-body"><div class="info-box small"><div class="title"><i class="fa-solid fa-child"></i> Grupa Mică</div><p>${esc(item.small)}</p></div><div class="info-box big"><div class="title"><i class="fa-solid fa-users"></i> Grupa Mare</div><p>${esc(item.big)}</p></div><div class="info-box needs"><div class="title"><i class="fa-solid fa-clipboard-list"></i> Necesare</div><p>${esc(item.needs)}</p></div></div></article>`).join("");
  animateSchedule(direction);
}

function selectDay(index, direction = "in") { if (index < 0 || index >= currentDays().length) return; selectedDayIndex = index; renderDays(); renderSchedule(direction); }

function toggleTheme() { document.body.classList.toggle("dark"); const dark = document.body.classList.contains("dark"); localStorage.setItem("vibeTheme", dark ? "dark" : "light"); document.querySelector('meta[name="theme-color"]').setAttribute("content", dark ? "#070b14" : "#0a348f"); $("themeBtn").innerHTML = dark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>'; }
function loadTheme() { if (localStorage.getItem("vibeTheme") === "dark") document.body.classList.add("dark"); const dark = document.body.classList.contains("dark"); document.querySelector('meta[name="theme-color"]').setAttribute("content", dark ? "#070b14" : "#0a348f"); $("themeBtn").innerHTML = dark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>'; }
function setActiveNav(page) { document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active")); if (page === "agenda") document.querySelectorAll(".nav-btn")[0].classList.add("active"); if (page === "admin" || page === "pin") document.querySelectorAll(".nav-btn")[1].classList.add("active"); }
function showPage(page) { $("agendaPage").classList.toggle("hidden", page !== "agenda"); $("pinPage").classList.toggle("hidden", page !== "pin"); $("adminPage").classList.toggle("hidden", page !== "admin"); setActiveNav(page); renderAdminList(); window.scrollTo({top:0, behavior:"smooth"}); }
function openAdmin() { if (isAdmin) showPage("admin"); else { showPage("pin"); setTimeout(() => $("pinInput").focus(), 100); } }
function checkPin() { const ok = $("pinInput").value === ADMIN_PIN; $("pinError").classList.toggle("hidden", ok); if (ok) { isAdmin = true; sessionStorage.setItem("vibeAdmin", "true"); $("pinInput").value = ""; showPage("admin"); } else $("pinInput").value = ""; }
function logoutAdmin() { isAdmin = false; sessionStorage.removeItem("vibeAdmin"); showPage("agenda"); }

function saveTourForm(e) { e.preventDefault(); apiPost("saveTour", { tour:{ id:$("tourId").value||null, title:$("tourTitle").value, emoji:$("tourEmoji").value, start_date:$("tourStart").value, end_date:$("tourEnd").value, sort_order:$("tourOrder").value||0 }}).then(resetTourForm).catch(alert); }
function editTour(id) { const t = tours.find(x => +x.id === +id); if (!t) return; $("tourId").value=t.id; $("tourTitle").value=t.title; $("tourEmoji").value=t.emoji||""; $("tourStart").value=t.start_date; $("tourEnd").value=t.end_date; $("tourOrder").value=t.sort_order||0; }
function resetTourForm() { $("tourForm").reset(); $("tourId").value=""; }
function deleteTour(id) { if (confirm("Ștergi această tură cu toate zilele și activitățile?")) apiPost("deleteTour", {id}).catch(alert); }
function saveDayForm(e) { e.preventDefault(); apiPost("saveDay", { day:{ id:$("dayId").value||null, tour_id:$("dayTour").value, name:$("dayNameInput").value, short_label:$("dayShort").value, date:$("dayDateInput").value, sort_order:$("dayOrder").value||0 }}).then(resetDayForm).catch(alert); }
function editDay(id) { const d = tours.flatMap(t=>t.days).find(x => +x.id === +id); if (!d) return; $("dayId").value=d.id; $("dayTour").value=d.tour_id; $("dayNameInput").value=d.name; $("dayShort").value=d.short_label; $("dayDateInput").value=d.date; $("dayOrder").value=d.sort_order||0; }
function resetDayForm() { $("dayForm").reset(); $("dayId").value=""; if (currentTour()) $("dayTour").value=currentTour().id; }
function deleteDay(id) { if (confirm("Ștergi această zi cu toate activitățile?")) apiPost("deleteDay", {id}).catch(alert); }

function renderAdminToursList() { $("adminToursList").innerHTML = tours.map(t => `<div class="admin-item" style="margin-top:12px;"><div><strong><i class="fa-solid fa-route"></i> ${esc(t.title)} ${esc(t.emoji||"")}</strong><span>${esc(t.start_date)} / ${esc(t.end_date)} • ${t.days.length} zile</span></div><div class="admin-actions"><button class="edit-btn" onclick="editTour(${t.id})"><i class="fa-solid fa-pen"></i> Tură</button><button class="delete-btn" onclick="deleteTour(${t.id})"><i class="fa-solid fa-trash"></i> Șterge</button></div></div>${t.days.map(d => `<div class="admin-item" style="margin:8px 0 0 24px;"><div><strong><i class="fa-regular fa-calendar"></i> ${esc(d.name)} — ${esc(d.date)}</strong><span>${d.activities.length} activități</span></div><div class="admin-actions"><button class="edit-btn" onclick="editDay(${d.id})"><i class="fa-solid fa-pen"></i> Zi</button><button class="delete-btn" onclick="deleteDay(${d.id})"><i class="fa-solid fa-trash"></i></button></div></div>`).join("")}`).join(""); }

function getFormItem() { return { id:selectedActivityId, day_id:$("adminDay").value, time:$("adminTime").value, activity:$("adminTitle").value, small:$("adminSmall").value, big:$("adminBig").value, needs:$("adminNeeds").value, sort_order:0 }; }
function resetFormMode() { selectedActivityId=null; $("activityForm").reset(); $("formTitle").innerHTML='<i class="fa-solid fa-circle-plus"></i> Activitate nouă'; $("formSubtitle").textContent="Completează datele și activitatea apare imediat pe pagina principală."; $("submitBtn").innerHTML='<i class="fa-solid fa-cloud-arrow-up"></i> Adaugă pe website'; $("cancelEditBtn").classList.add("hidden"); renderAdminSelects(); }
function saveActivityForm(e) { e.preventDefault(); apiPost("saveActivity", {activity:getFormItem()}).then(() => { resetFormMode(); showPage("agenda"); }).catch(alert); }
function editActivity(id) { const a = tours.flatMap(t=>t.days).flatMap(d=>d.activities).find(x => +x.id === +id); if (!a) return; selectedActivityId=a.id; $("adminDay").value=a.day_id; $("adminTime").value=a.time; $("adminTitle").value=a.activity; $("adminSmall").value=a.small; $("adminBig").value=a.big; $("adminNeeds").value=a.needs; $("formTitle").innerHTML='<i class="fa-solid fa-pen-to-square"></i> Editează activitatea'; $("formSubtitle").textContent="Modifică datele și salvează actualizarea în database."; $("submitBtn").innerHTML='<i class="fa-solid fa-floppy-disk"></i> Salvează modificările'; $("cancelEditBtn").classList.remove("hidden"); $("activityForm").scrollIntoView({behavior:"smooth", block:"start"}); }
function cancelEdit() { resetFormMode(); }
function deleteActivity(id) { if (confirm("Ștergi această activitate?")) apiPost("deleteActivity", {id}).catch(alert); }
function renderAdminList() { const items = tours.flatMap(t => t.days.flatMap(d => d.activities.map(a => ({...a, dayName:d.name, tourTitle:t.title})))); $("adminList").innerHTML = items.length ? items.map(i => `<div class="admin-item"><div><strong><i class="fa-regular fa-calendar-check"></i> ${esc(i.tourTitle)} / ${esc(i.dayName)}: ${esc(i.time)}</strong><span>${esc(i.activity)}</span></div><div class="admin-actions"><button class="edit-btn" onclick="editActivity(${i.id})"><i class="fa-solid fa-pen"></i> Editează</button><button class="delete-btn" onclick="deleteActivity(${i.id})"><i class="fa-solid fa-trash"></i> Șterge</button></div></div>`).join("") : `<div class="admin-item"><div><strong><i class="fa-regular fa-folder-open"></i> Nicio activitate</strong><span>Adaugă prima activitate din formular.</span></div></div>`; }

function scrollToTop() { window.scrollTo({top:0, behavior:"smooth"}); }
function createPWA() { const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#0a348f"/><circle cx="256" cy="256" r="140" fill="#ffd43b"/><text x="256" y="306" text-anchor="middle" font-size="170" font-weight="900" font-family="Arial" fill="#0a348f">V</text></svg>`; const iconUrl = "data:image/svg+xml;base64," + btoa(iconSvg); const manifest = { name:"VIBE Agenda Mentorilor", short_name:"VIBE Agenda", start_url:".", display:"standalone", background_color:"#0a348f", theme_color:"#0a348f", icons:[{src:iconUrl, sizes:"192x192", type:"image/svg+xml", purpose:"any maskable"},{src:iconUrl, sizes:"512x512", type:"image/svg+xml", purpose:"any maskable"}]}; const link=document.createElement("link"); link.rel="manifest"; link.href=URL.createObjectURL(new Blob([JSON.stringify(manifest)],{type:"application/json"})); document.head.appendChild(link); const apple=document.createElement("link"); apple.rel="apple-touch-icon"; apple.href=iconUrl; document.head.appendChild(apple); }
async function installApp() { $("installToast").classList.remove("show"); if (!deferredPrompt) return alert("Pentru instalare pe iPhone: Share → Add to Home Screen. Pe Android/Chrome: Menu → Install app."); deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; $("installBtn").classList.add("hidden"); }

$("pinInput").addEventListener("keydown", e => { if (e.key === "Enter") checkPin(); });
$("schedule").addEventListener("touchstart", e => { touchStartX=e.changedTouches[0].screenX; touchStartY=e.changedTouches[0].screenY; }, {passive:true});
$("schedule").addEventListener("touchend", e => { const dx=e.changedTouches[0].screenX-touchStartX, dy=e.changedTouches[0].screenY-touchStartY; if (Math.abs(dx)>65 && Math.abs(dx)>Math.abs(dy)*1.4) dx<0 ? selectDay(selectedDayIndex+1,"left") : selectDay(selectedDayIndex-1,"right"); }, {passive:true});
window.addEventListener("scroll", () => $("backTopBtn").classList.toggle("show", window.scrollY > 360));
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt=e; $("installBtn").classList.remove("hidden"); setTimeout(() => $("installToast").classList.add("show"), 800); });
window.addEventListener("appinstalled", () => { $("installBtn").classList.add("hidden"); $("installToast").classList.remove("show"); });

createPWA(); loadTheme(); loadData();
