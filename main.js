
  const STORAGE_KEY = "podroze_dashboard_multi_clean_v1";

  const defaultTrip = {
    meta: {
      tripName: "Nowa podróż",
      flightOut: "",
      flightBack: "",
      generalNotes: ""
    },
    planDays: [],
    lodgings: [],
    como: { baseSuggest: "", notes: "", link1: "", link2: "" },
    returnPlan: { start: "", goal: "", departTime: "", flightTime: "", rules: "" },
    tasks: [
      { done:false, title:"Dokumenty + bilety", desc:"Zrzuty offline / PDF" },
      { done:false, title:"Powerbank + kable", desc:"Telefon = bilety + mapy" },
      { done:false, title:"Rezerwacje noclegów", desc:"Potwierdzenia w offline" }
    ],
    budget: []
  };

  const $ = (id)=>document.getElementById(id);
  function safeBind(id, evt, fn){
    const el = $(id);
    if(!el) return false;
    el.addEventListener(evt, fn);
    return true;
  }
  function showBootError(err){
    try{
      console.error("PODROZE boot error:", err);
      const box = $("bootError");
      const msg = $("bootErrorMsg");
      if(box && msg){
        msg.textContent = (err && (err.stack||err.message)) ? (err.stack||err.message) : String(err);
        box.style.display = "block";
      }
    }catch(e){}
  }

  const toast = $("toast");
  function showToast(msg="Zapisano ✅"){ toast.textContent = msg; toast.classList.add("show"); setTimeout(()=>toast.classList.remove("show"), 1100); }
  function safeParseJSON(s){ try{ return {ok:true, data: JSON.parse(s)}; }catch(e){ return {ok:false, err:e}; } }
  function escapeHtml(s){ return (s??"").toString().replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
  function formatDateISO(iso){ if(!iso) return "—"; const [y,m,d]=iso.split("-").map(Number); if(!y||!m||!d) return iso; return `${String(d).padStart(2,'0')}.${String(m).padStart(2,'0')}.${y}`; }
  function normalizeDate(s){
    if(!s) return "";
    s = (""+s).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m) return s;
    m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if(m) return `${m[3]}-${m[2]}-${m[1]}`;
    m = s.match(/^(\d{2})\.(\d{2})$/);
    if(m){ const y = new Date().getFullYear(); return `${y}-${m[2]}-${m[1]}`; }
    return s;
  }

  function nightsBetween(a,b){ if(!a||!b) return null; const A=new Date(a+"T00:00:00"), B=new Date(b+"T00:00:00"); return Math.round((B-A)/86400000); }
  function uid(){ return Math.random().toString(16).slice(2) + "_" + Date.now().toString(16); }
  function deepClone(o){ return structuredClone(o); }

  function defaultStore(){ const id = uid(); return { currentId: id, trips: { [id]: { name: defaultTrip.meta.tripName, data: deepClone(defaultTrip), updatedAt: Date.now() } } }; }
  function migrateOldOrDefault(){
    const oldKey = "podroze_dashboard_bergamo_milan_como_v1";
    const rawOld = localStorage.getItem(oldKey);
    if(rawOld){
      const p = safeParseJSON(rawOld);
      if(p.ok){ const id = uid(); return { currentId:id, trips:{ [id]: { name: (p.data?.meta?.tripName || "Podróż"), data: p.data, updatedAt: Date.now() } } }; }
    }
    return defaultStore();
  }
  function loadStore(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return migrateOldOrDefault();
    const p = safeParseJSON(raw);
    if(!p.ok || !p.data || typeof p.data !== "object" || !p.data.trips) return migrateOldOrDefault();
    return p.data;
  }

  let store = loadStore();
  let state = getCurrentTripData();

  function getCurrentTrip(){
    const t = store.trips[store.currentId];
    if(t) return t;
    const firstId = Object.keys(store.trips)[0];
    store.currentId = firstId;
    return store.trips[firstId];
  }
  function getCurrentTripData(){ return getCurrentTrip().data; }

  function persistStore(){
    const cur = getCurrentTrip();
    cur.name = state.meta?.tripName || cur.name || "Podróż";
    cur.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    syncTripSelect();
  }

  function syncTripSelect(){
    const sel = $("tripSelect");
    if(!sel) return;
    const ids = Object.keys(store.trips).sort((a,b)=>(store.trips[b].updatedAt||0)-(store.trips[a].updatedAt||0));
    sel.innerHTML = "";
    for(const id of ids){
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = store.trips[id].name || "Podróż";
      sel.appendChild(opt);
    }
    sel.value = store.currentId || ids[0];
  }

  function switchTrip(id){
    if(!store.trips[id]) return;
    persistStore();
    store.currentId = id;
    state = getCurrentTripData();
    renderAll();
    persistStore();
    showToast("Zmieniono podróż ✅");
  }
  function newTrip(){
    const name = prompt("Nazwa nowej podróży:", "Nowa podróż");
    if(name === null) return;
    const id = uid();
    const data = deepClone(defaultTrip);
    data.meta.tripName = name || "Nowa podróż";
    store.trips[id] = { name: data.meta.tripName, data, updatedAt: Date.now() };
    store.currentId = id;
    state = data;
    renderAll();
    persistStore();
    showToast("Dodano podróż ✅");
  }
  function dupTrip(){
    const cur = getCurrentTrip();
    const id = uid();
    const data = deepClone(cur.data);
    data.meta.tripName = (cur.name || "Podróż") + " (kopia)";
    store.trips[id] = { name: data.meta.tripName, data, updatedAt: Date.now() };
    store.currentId = id;
    state = data;
    renderAll();
    persistStore();
    showToast("Zduplikowano ✅");
  }
  function delTrip(){
    const ids = Object.keys(store.trips);
    if(ids.length <= 1){ alert("Musi zostać przynajmniej jedna podróż."); return; }
    const cur = getCurrentTrip();
    if(!confirm(`Usunąć podróż:\n\n${cur.name}\n\n(Pliki JSON na dysku zostają.)`)) return;
    delete store.trips[store.currentId];
    store.currentId = Object.keys(store.trips)[0];
    state = getCurrentTripData();
    renderAll();
    persistStore();
    showToast("Usunięto ✅");
  }

  function syncJSONBox(){ $("jsonBox").value = JSON.stringify(state, null, 2); }

  function updateGeneralNotesPreview(){
    const el = $("previewGeneralNotes");
    if(!el) return;
    const gn = (state?.meta?.generalNotes || "").trim();
    el.textContent = gn ? gn : "—";
  }

  function renderKPIs(){
    const dates = (state.planDays||[]).map(d=>normalizeDate(d.date)).filter(Boolean).sort();
    const start = dates[0], end = dates[dates.length-1];
    $("kpiDates").textContent = (start && end) ? `${formatDateISO(start)} → ${formatDateISO(end)}` : "—";
    const nights = nightsBetween(start, end);
    $("kpiNights").textContent = (nights!=null) ? `${nights} nocy (orientacyjnie)` : "—";

    $("kpiFlightOut").textContent = state.meta.flightOut || "—";
    $("kpiFlightBack").textContent = state.meta.flightBack || "—";
    $("kpiAirport") && ($("kpiAirport").textContent = "—");

    const today = new Date();
    const isoToday = today.toISOString().slice(0,10);
    const next = (state.planDays||[])
      .map(d=>({__d:d, __iso: normalizeDate(d.date)}))
      .filter(x=>x.__iso && x.__iso >= isoToday)
      .sort((a,b)=>a.__iso.localeCompare(b.__iso))[0]?.__d;
    $("kpiBase").textContent = next?.base || (state.planDays?.[0]?.base ?? "—");
    const idx = next ? (state.planDays||[]).findIndex(d=>d===next) : -1;
    const nxt = (idx>=0 && state.planDays[idx+1]) ? state.planDays[idx+1] : null;
    $("kpiNext").textContent = nxt ? `Następnie: ${nxt.base} (${formatDateISO(nxt.date)})` : "—";

    const rp = state.returnPlan || {};
    const depart = rp.departTime || "";
    const flight = rp.flightTime || "";
    let hint = "Ustaw godziny wyjazdu i lotu.";
    let label = "—";
    if(depart && flight){
      const [dh,dm]=depart.split(":").map(Number);
      const [fh,fm]=flight.split(":").map(Number);
      const mins = (fh*60+fm) - (dh*60+dm);
      if(Number.isFinite(mins)){
        if(mins >= 420){ label="Spokojnie"; hint=`Masz ~${Math.floor(mins/60)}h ${mins%60}m buforu.`; }
        else if(mins >= 300){ label="OK"; hint=`Masz ~${Math.floor(mins/60)}h ${mins%60}m. Zostaw bufor.`; }
        else { label="Ryzyko"; hint=`Tylko ~${Math.floor(mins/60)}h ${mins%60}m. To pachnie gonitwą.`; }
      }
    }
    $("kpiStress").textContent = label;
    $("kpiStressHint").textContent = hint;
  }

  function renderPlan(){
    const tbody = $("planTable").querySelector("tbody");
    tbody.innerHTML = "";
    (state.planDays||[]).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
    for(const [i,d] of (state.planDays||[]).entries()){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td contenteditable="true" data-k="date" data-i="${i}">${d.date||""}</td>
        <td contenteditable="true" data-k="base" data-i="${i}">${escapeHtml(d.base||"")}</td>
        <td contenteditable="true" data-k="plan" data-i="${i}">${escapeHtml(d.plan||"")}</td>
        <td contenteditable="true" data-k="transport" data-i="${i}">${escapeHtml(d.transport||"")}</td>
        <td>
          <select data-k="status" data-i="${i}">
            ${["plan","ok","uwaga","gotowe"].map(s=>`<option value="${s}" ${d.status===s?"selected":""}>${s}</option>`).join("")}
          </select>
        </td>
      `;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll("[contenteditable]").forEach(el=>{
      el.addEventListener("blur", ()=>{
        const i = Number(el.dataset.i), k = el.dataset.k;
        let v = el.textContent.trim();
        if(k==="date"){ v = normalizeDate(v); el.textContent = v; }
        state.planDays[i][k] = v;
        save();
      });
    });
    tbody.querySelectorAll("select").forEach(sel=>{
      sel.addEventListener("change", ()=>{
        const i = Number(sel.dataset.i), k = sel.dataset.k;
        state.planDays[i][k] = sel.value;
        save();
      });
    });
  }

  
  function parseISODate(s){
    if(!s) return null;
    const m = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m) return null;
    return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
  }
  function daysDiff(a,b){
    const ms = 24*60*60*1000;
    const da = Date.UTC(a.getFullYear(),a.getMonth(),a.getDate());
    const db = Date.UTC(b.getFullYear(),b.getMonth(),b.getDate());
    return Math.round((db-da)/ms);
  }
  function calcLodgingNights(){
    const today = new Date();
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let total = 0;
    let remaining = 0;
    (state.lodgings||[]).forEach(l=>{
      const ci = parseISODate(l.checkIn);
      const co = parseISODate(l.checkOut);
      if(ci && co){
        const n = Math.max(0, daysDiff(ci, co));
        total += n;
        const start = (t0 > ci) ? t0 : ci;
        if(co > start){
          remaining += Math.max(0, daysDiff(start, co));
        }
      }
    });
    const el = $("lodgingsSummary");
    if(el) el.textContent = `Noce: ${total} • Pozostało: ${remaining}`;
  }

  function renderLodgings(){
    const box = $("lodgingList");
    box.innerHTML = "";
    for(const [i,l] of (state.lodgings||[]).entries()){
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <div class="txt">
          <div class="t" contenteditable="true" data-lk="name" data-li="${i}">${escapeHtml(l.name||"")}</div>
          <div class="d">
            <span contenteditable="true" data-lk="city" data-li="${i}">${escapeHtml(l.city||"")}</span>
            • <span contenteditable="true" data-lk="address" data-li="${i}">${escapeHtml(l.address||"")}</span>
            <br>
            <span class="mono">Link:</span> <span contenteditable="true" data-lk="url" data-li="${i}">${escapeHtml(l.url||"")}</span>
            <br>
            <span class="mono">IN:</span> <input type="date" class="dateinp" data-lk="checkIn" data-li="${i}" value="${escapeHtml(l.checkIn||"")}">
            <span class="mono">OUT:</span> <input type="date" class="dateinp" data-lk="checkOut" data-li="${i}" value="${escapeHtml(l.checkOut||"")}">
            <br>
            <span contenteditable="true" data-lk="notes" data-li="${i}">${escapeHtml(l.notes||"")}</span>
          </div>
        </div>
        <div class="x" title="Usuń" data-del="${i}">✕</div>
      `;
      box.appendChild(el);
    }
    box.querySelectorAll("[contenteditable]").forEach(el=>{
      el.addEventListener("blur", ()=>{
        const i = Number(el.dataset.li), k = el.dataset.lk;
        state.lodgings[i][k] = el.textContent.trim();
        save();
      });
    });

    /* LODGINGS_DATE_LISTENERS */
    box.querySelectorAll('.dateinp').forEach(inp=>{
      inp.addEventListener('change', ()=>{
        const i = Number(inp.dataset.li), k = inp.dataset.lk;
        state.lodgings[i][k] = inp.value;
        save();
        if(typeof calcLodgingNights === 'function') calcLodgingNights();
      });
    });

    box.querySelectorAll("[data-del]").forEach(b=>{
      b.addEventListener("click", ()=>{
        const i = Number(b.dataset.del);
        state.lodgings.splice(i,1);
        renderAll(); save();
      });
    });
  }

  function renderTasks(){
    const list = $("taskList");
    list.innerHTML = "";
    for(const [i,t] of (state.tasks||[]).entries()){
      const el = document.createElement("div");
      el.className = "item";
      el.innerHTML = `
        <input type="checkbox" ${t.done?"checked":""} data-ti="${i}">
        <div class="txt">
          <div class="t" contenteditable="true" data-tk="title" data-ti="${i}">${escapeHtml(t.title||"")}</div>
          <div class="d" contenteditable="true" data-tk="desc" data-ti="${i}">${escapeHtml(t.desc||"")}</div>
        </div>
        <div class="x" title="Usuń" data-tdel="${i}">✕</div>
      `;
      list.appendChild(el);
    }
    list.querySelectorAll("input[type=checkbox]").forEach(cb=>{
      cb.addEventListener("change", ()=>{ state.tasks[Number(cb.dataset.ti)].done = cb.checked; save(); });
    });
    list.querySelectorAll("[contenteditable]").forEach(el=>{
      el.addEventListener("blur", ()=>{
        const i=Number(el.dataset.ti), k=el.dataset.tk;
        state.tasks[i][k]=el.textContent.trim();
        save();
      });
    });
    list.querySelectorAll("[data-tdel]").forEach(b=>{
      b.addEventListener("click", ()=>{
        state.tasks.splice(Number(b.dataset.tdel),1);
        renderAll(); save();
      });
    });
  }

  function renderBudget(){
    const tbody = $("budgetTable").querySelector("tbody");
    tbody.innerHTML = "";
    for(const [i,c] of (state.budget||[]).entries()){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td contenteditable="true" data-bk="item" data-bi="${i}">${escapeHtml(c.item||"")}</td>
        <td contenteditable="true" data-bk="amount" data-bi="${i}">${(c.amount ?? "")}</td>
        <td>
          <select data-bk="currency" data-bi="${i}">
            ${["EUR","PLN"].map(x=>`<option value="${x}" ${(c.currency===x)?"selected":""}>${x}</option>`).join("")}
          </select>
        </td>
        <td contenteditable="true" data-bk="note" data-bi="${i}">${escapeHtml(c.note||"")}</td>
        <td><button class="smallbtn danger" data-bdel="${i}">Usuń</button></td>
      `;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll("[contenteditable]").forEach(el=>{
      el.addEventListener("blur", ()=>{
        const i=Number(el.dataset.bi), k=el.dataset.bk;
        let v = el.textContent.trim();
        if(k==="amount"){
          v = v.replace(",", ".");
          const n = Number(v);
          state.budget[i][k] = Number.isFinite(n) ? n : 0;
          el.textContent = state.budget[i][k];
        }else{
          state.budget[i][k] = v;
        }
        save(); renderBudgetSum();
      });
    });
    tbody.querySelectorAll("select").forEach(sel=>{
      sel.addEventListener("change", ()=>{
        const i=Number(sel.dataset.bi), k=sel.dataset.bk;
        state.budget[i][k]=sel.value;
        save(); renderBudgetSum();
      });
    });
    tbody.querySelectorAll("[data-bdel]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        state.budget.splice(Number(btn.dataset.bdel),1);
        renderAll(); save();
      });
    });
    renderBudgetSum();
  }

  function renderBudgetSum(){
    const sums = {};
    for(const c of (state.budget||[])){
      const cur = c.currency || "EUR";
      const amt = Number(c.amount)||0;
      sums[cur] = (sums[cur]||0) + amt;
    }
    const parts = Object.entries(sums).map(([k,v])=>`${v.toFixed(2)} ${k}`);
    $("budgetSum").textContent = parts.length ? parts.join(" • ") : "0";
  }

  
  function ensureLinksModel(){
    state.como = state.como || { baseSuggest:"", notes:"", link1:"", link2:"" };
    if(!Array.isArray(state.como.links)){
      const links = [];
      const a = (state.como.link1||"").trim();
      const b = (state.como.link2||"").trim();
      if(a) links.push({title:"", url:a});
      if(b) links.push({title:"", url:b});
      state.como.links = links;
    }
  }

  function renderLinks(){
    ensureLinksModel();
    const list = $("linksList");
    if(!list) return;
    list.innerHTML = "";
    for(const [i,lnk] of (state.como.links||[]).entries()){
      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML = `
        <div class="txt">
          <div class="d">
            <input class="linkTitle" type="text" placeholder="Tytuł (opcjonalnie)" value="${escapeHtml(lnk.title||"")}" data-li="${i}" data-lk="title">
            <input class="linkUrl" type="text" placeholder="URL" value="${escapeHtml(lnk.url||"")}" data-li="${i}" data-lk="url">
          </div>
        </div>
        <div class="x" title="Usuń" data-ldel="${i}">✕</div>
      `;
      list.appendChild(row);
    }
    list.querySelectorAll("input").forEach(inp=>{
      inp.addEventListener("input", ()=>{
        const i = Number(inp.dataset.li), k = inp.dataset.lk;
        state.como.links[i][k] = inp.value;
        save();
      });
    });
    list.querySelectorAll("[data-ldel]").forEach(b=>{
      b.addEventListener("click", ()=>{
        state.como.links.splice(Number(b.dataset.ldel),1);
        renderLinks(); save();
      });
    });
  }

  function renderForm(){
    $("tripName").textContent = state.meta.tripName || "—";
    $("tripNameInput").value = state.meta.tripName || "";
    $("flightOut").value = state.meta.flightOut || "";
    $("flightBack").value = state.meta.flightBack || "";
    $("generalNotes").value = state.meta.generalNotes || "";

    // Podgląd: uwagi ogólne
    const gn = (state.meta.generalNotes || "").trim();
    $("previewGeneralNotes").textContent = gn ? gn : "—";

    $("comoBaseSuggest").textContent = state.como.baseSuggest || "—";
    $("comoNotes").value = state.como.notes || "";
    $("returnStart").value = state.returnPlan.start || "";
    $("returnGoal").value = state.returnPlan.goal || "";
    $("returnDepart").value = state.returnPlan.departTime || "";
    $("returnFlightTime").value = state.returnPlan.flightTime || "";
    $("returnRules").value = state.returnPlan.rules || "";

    syncJSONBox();
  }

  function renderAll(){
    syncTripSelect();
    updateGeneralNotesPreview();
    renderKPIs();
    renderPlan();
    renderLodgings();
    calcLodgingNights();
    renderTasks();
    renderBudget();
    renderForm();
    renderLinks();
  }

  function save(){
    if(typeof calcLodgingNights === 'function'){ try{ calcLodgingNights(); }catch(e){} }

    syncJSONBox();
    updateGeneralNotesPreview();
    renderKPIs();
    persistStore();
    showToast();
  }

  function hardReset(){
    if(!confirm("Na pewno? To usunie WSZYSTKIE podróże zapisane w tej przeglądarce.")) return;
    localStorage.removeItem(STORAGE_KEY);
    store = defaultStore();
    state = getCurrentTripData();
    renderAll();
    persistStore();
    showToast("Zresetowano 🧹");
  }

  // ---- wire UI ----
  document.addEventListener("DOMContentLoaded", ()=>{
    // main controls
    safeBind("btnSave", "click", save);
    safeBind("btnReset", "click", hardReset);

    safeBind("tripSelect", "change", (e)=>switchTrip(e.target.value));
    safeBind("btnNewTrip", "click", newTrip);
    safeBind("btnDupTrip", "click", dupTrip);
    safeBind("btnDelTrip", "click", delTrip);

    // plan / lodgings / tasks / budget
    safeBind("btnAddDay", "click", ()=>{
      state.planDays.push({date:"", base:"", plan:"", transport:"", status:"plan"});
      renderPlan(); save();
    });

    safeBind("btnSortDays", "click", ()=>{
      state.planDays.sort((a,b)=>(a.date||"").localeCompare(b.date||""));
      renderPlan(); save();
    });

    safeBind("btnAddLodging", "click", ()=>{
      state.lodgings.push({name:"Nowy nocleg", city:"", address:"", url:"", checkIn:"", checkOut:"", notes:""});
      renderLodgings(); save();
    });

    safeBind("btnAddLink", "click", ()=>{
      ensureLinksModel();
      state.como.links.push({title:"", url:""});
      renderLinks(); save();
    });

    safeBind("btnAddTask", "click", ()=>{
      const title = ($("newTaskTitle")?.value || "").trim();
      if(!title) return;
      state.tasks.push({done:false, title, desc:""});
      if($("newTaskTitle")) $("newTaskTitle").value = "";
      renderTasks(); save();
    });

    safeBind("btnAddCost", "click", ()=>{
      state.budget.push({item:"Nowy koszt", amount:0, currency:"EUR", note:""});
      renderBudget(); save();
    });

    // meta fields
    safeBind("tripNameInput", "input", ()=>{
      state.meta.tripName = $("tripNameInput").value;
      const h = $("tripName"); if(h) h.textContent = state.meta.tripName || "—";
      save();
    });
    safeBind("flightOut", "input", ()=>{ state.meta.flightOut = $("flightOut").value; save(); });
    safeBind("flightBack", "input", ()=>{ state.meta.flightBack = $("flightBack").value; save(); });
    safeBind("generalNotes", "input", ()=>{ state.meta.generalNotes = $("generalNotes").value; updateGeneralNotesPreview(); save(); });

    // transport notes + return plan
    safeBind("comoNotes", "input", ()=>{ state.como.notes = $("comoNotes").value; save(); });

    safeBind("returnStart", "input", ()=>{ state.returnPlan.start = $("returnStart").value; save(); });
    safeBind("returnGoal", "input", ()=>{ state.returnPlan.goal = $("returnGoal").value; save(); });
    safeBind("returnDepart", "input", ()=>{ state.returnPlan.departTime = $("returnDepart").value; save(); });
    safeBind("returnFlightTime", "input", ()=>{ state.returnPlan.flightTime = $("returnFlightTime").value; save(); });
    safeBind("returnRules", "input", ()=>{ state.returnPlan.rules = $("returnRules").value; save(); });

    safeBind("btnApplyJson", "click", ()=>{
    const p = safeParseJSON($("jsonBox").value);
    if(!p.ok){ alert("JSON ma błąd: " + p.err.message); return; }
    state = Object.assign(deepClone(defaultTrip), p.data);
    store.trips[store.currentId].data = state;
    store.trips[store.currentId].name = state.meta?.tripName || store.trips[store.currentId].name;
    renderAll();
    persistStore();
    showToast("Zastosowano JSON ✅");
      });

      safeBind("btnExport", "click", ()=>{
    persistStore();
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const safeName = (state.meta?.tripName || "podroz").replaceAll(/[^a-z0-9\-_ ]/gi,"").trim().replaceAll(" ","_").slice(0,60) || "podroz";
    a.download = `${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
      });

      $("fileImport").addEventListener("change", async (e)=>{
    const f = e.target.files?.[0];
    if(!f) return;
    const txt = await f.text();
    const p = safeParseJSON(txt);
    if(!p.ok){ alert("Plik JSON ma błąd: " + p.err.message); e.target.value=""; return; }
    const data = Object.assign(deepClone(defaultTrip), p.data);
    const name = data?.meta?.tripName || f.name.replace(/\.json$/i,"") || "Podróż z pliku";
    const id = uid();
    store.trips[id] = { name, data, updatedAt: Date.now() };
    store.currentId = id;
    state = data;
    renderAll();
    persistStore();
    showToast("Zaimportowano jako nową podróż ✅");
    e.target.value = "";
      });

      renderAll();
      persistStore();
  });