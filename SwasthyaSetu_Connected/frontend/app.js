// Frontend is intentionally served by FastAPI.
// Therefore API calls use the same origin (/api/...) and require no localhost hard-coding.
const API = "/api";
let token = localStorage.getItem("token") || "";
let user = JSON.parse(localStorage.getItem("user") || "null");

const app = document.getElementById("app");

async function api(path, options={}) {
  const headers = {...(options.headers || {}), "Content-Type":"application/json"};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, {...options, headers});
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.detail || "API request failed");
  return data;
}
const esc = s => String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

function loginView(){
  app.innerHTML = `<div class="login-shell"><div class="login-card">
    <div class="logo">🏥</div><h1>SwasthyaSetu</h1>
    <p>Integrated public healthcare access for rural communities</p>
    <form id="loginForm">
      <label>Email</label><input id="email" type="email" value="worker@swasthyasetu.in" required>
      <label>Password</label><input id="password" type="password" value="demo123" required>
      <button>Sign in</button>
    </form>
    <small>Demo account: worker@swasthyasetu.in / demo123</small>
    <div id="loginError"></div>
  </div></div>`;
  document.getElementById("loginForm").onsubmit = async e => {
    e.preventDefault();
    try {
      const x = await api("/login",{method:"POST",body:JSON.stringify({email:email.value,password:password.value})});
      token=x.token; user=x.user;
      localStorage.setItem("token",token); localStorage.setItem("user",JSON.stringify(user));
      render("dashboard");
    } catch(err) { document.getElementById("loginError").innerHTML=`<p class="error">${esc(err.message)}</p>`; }
  };
}

function shell(page){
  app.innerHTML=`<div class="layout">
  <aside>
    <div class="brand">🏥 <b>SwasthyaSetu</b></div>
    <div class="role">${esc(user?.role||"Health Worker")}<br><span>${esc(user?.facility||"")}</span></div>
    <nav>${[
      ["dashboard","📊 Dashboard"],["triage","🩺 Digital Triage"],["patients","👥 Patients"],
      ["teleconsultation","📱 Teleconsultation"],["appointments","🗓️ Appointments"],
      ["referrals","🔗 Referrals"],["diagnostics","🧪 Diagnostics"],
      ["medicines","💊 Medicines"],["quality","📈 Quality"]
    ].map(([x,t])=>`<button data-page="${x}" class="${page===x?"active":""}">${t}</button>`).join("")}</nav>
    <button class="logout" id="logout">↪ Logout</button>
  </aside>
  <main><header><div><b>Public Healthcare Operations</b><span id="connection">Checking connection…</span></div>
  <div>👤 ${esc(user?.name||"User")}</div></header><section id="content"></section></main></div>`;
  document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>render(b.dataset.page));
  document.getElementById("logout").onclick=()=>{localStorage.clear();location.reload()};
  api("/health").then(x=>document.getElementById("connection").textContent="● Backend connected")
    .catch(()=>document.getElementById("connection").textContent="● Backend unavailable");
}

async function render(page){
  if(!token){loginView();return}
  shell(page);
  const c=document.getElementById("content");
  try {
    if(page==="dashboard"){
      const d=await api("/dashboard");
      c.innerHTML=`<div class="hero"><div><h1>Good morning 👋</h1><p>Today’s care-access overview.</p></div><div>● System operational</div></div>
      <div class="cards">${[
        ["👥","Registered Patients",d.patients],["🚨","High-Risk Patients",d.high_risk],
        ["🔗","Pending Referrals",d.pending_referrals],["📱","Teleconsultations",d.teleconsultations],
        ["💊","Medicine Alerts",d.medicine_alerts]
      ].map(x=>`<div class="card"><span>${x[0]}</span><small>${x[1]}</small><strong>${x[2]}</strong></div>`).join("")}</div>
      <div class="grid2"><div class="panel"><h2>Care workflow</h2><div class="flow"><b>1</b> Triage → <b>2</b> Consultation → <b>3</b> Referral → <b>4</b> Follow-up</div></div>
      <div class="panel"><h2>Connected architecture</h2><p>Browser UI → FastAPI REST API → SQLite database. All dashboard values above are loaded live from the backend.</p></div></div>`;
    }
    else if(page==="triage"){
      c.innerHTML=`<h1>🩺 Digital Triage</h1><p class="muted">Decision support prototype — final clinical decisions remain with qualified professionals.</p>
      <div class="panel form"><label>Patient name<input id="tn"></label><label>Age<input id="ta" type="number" value="30"></label>
      <label>Symptoms</label><div class="checks">${["Fever","Breathing difficulty","Chest pain","Severe bleeding","Unconsciousness","Severe abdominal pain","Vomiting","Cough","Headache"].map(x=>`<label><input type="checkbox" value="${x}"> ${x}</label>`).join("")}</div>
      <label><input id="preg" type="checkbox"> Pregnant / recently delivered</label><label><input id="chron" type="checkbox"> Known chronic condition</label>
      <button id="assess">Assess priority</button><div id="triageResult"></div></div>`;
      document.getElementById("assess").onclick=async()=>{
        const symptoms=[...document.querySelectorAll(".checks input:checked")].map(x=>x.value);
        const d=await api("/triage",{method:"POST",body:JSON.stringify({patient_name:tn.value,age:+ta.value,symptoms,pregnancy:preg.checked,chronic:chron.checked})});
        triageResult.innerHTML=`<div class="result ${d.priority.toLowerCase()}"><b>${d.priority}</b><br>${d.action}</div>`;
      };
    }
    else if(page==="patients"){
      let rows=await api("/patients");
      c.innerHTML=`<h1>👥 Patient Records</h1><div class="toolbar"><input id="ps" placeholder="Search name, ID or condition…"><button id="addP">+ Add patient</button></div><div id="ptable"></div>`;
      const draw=data=>ptable.innerHTML=`<table><thead><tr><th>ID</th><th>Name</th><th>Age</th><th>Condition</th><th>Risk</th><th>Facility</th></tr></thead><tbody>${data.map(p=>`<tr><td>${p.patient_code}</td><td><b>${esc(p.name)}</b></td><td>${p.age}</td><td>${esc(p.condition)}</td><td><span class="badge ${p.risk.toLowerCase()}">${p.risk}</span></td><td>${esc(p.facility)}</td></tr>`).join("")}</tbody></table>`;
      draw(rows);
      ps.oninput=async()=>draw(await api("/patients?q="+encodeURIComponent(ps.value)));
      addP.onclick=()=>showPatientForm();
    }
    else if(page==="teleconsultation"){
      const patients=await api("/patients");
      c.innerHTML=`<h1>📱 Assisted Teleconsultation</h1><div class="grid2"><div class="panel form">
      <label>Patient<select id="cp">${patients.map(p=>`<option value="${p.id}">${esc(p.patient_code)} — ${esc(p.name)}</option>`).join("")}</select></label>
      <label>Specialty<select id="cs">${["General Medicine","Paediatrics","Gynaecology","Cardiology","Dermatology"].map(x=>`<option>${x}</option>`).join("")}</select></label>
      <label>Priority<select id="cpri"><option>Routine</option><option>Urgent</option><option>Emergency</option></select></label>
      <label>Clinical notes<textarea id="cn"></textarea></label><button id="request">Request consultation</button></div>
      <div class="panel"><h2>📶 Connectivity</h2><h3>Backend connected</h3><p>Consultation requests are written to the backend database.</p></div></div>`;
      request.onclick=async()=>{await api("/consultations",{method:"POST",body:JSON.stringify({patient_id:+cp.value,specialty:cs.value,priority:cpri.value,notes:cn.value})});alert("Consultation request saved in backend.");render("dashboard")};
    }
    else if(page==="referrals"){
      const rows=await api("/referrals");
      c.innerHTML=`<h1>🔗 Referral Tracking</h1><div class="panel"><table><thead><tr><th>Referral</th><th>Patient</th><th>From</th><th>To</th><th>Department</th><th>Status</th><th>Update</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td>${r.referral_code}</td><td>${esc(r.patient_name)}</td><td>${esc(r.source_facility)}</td><td>${esc(r.destination_facility)}</td><td>${esc(r.department)}</td><td><span class="badge">${r.status}</span></td><td><select onchange="updateReferral(${r.id},this.value)">${["Pending","Scheduled","Completed","Urgent","Cancelled"].map(s=>`<option ${s===r.status?"selected":""}>${s}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div>`;
    }
    else if(page==="medicines"){
      const rows=await api("/medicines");
      c.innerHTML=`<h1>💊 Medicine Availability</h1><div class="cards mini">${rows.map(m=>`<div class="card"><small>${esc(m.name)}</small><strong>${m.stock}</strong><span>${m.status}</span><em>Minimum: ${m.minimum_stock}</em></div>`).join("")}</div>`;
    }
    else if(page==="appointments"){
      c.innerHTML=`<h1>🗓️ Appointments & Queue</h1><div class="cards"><div class="card"><small>Patients waiting</small><strong>18</strong></div><div class="card"><small>Average wait</small><strong>24 min</strong></div><div class="card"><small>Priority tokens</small><strong>4</strong></div></div><div class="panel"><h2>Today's queue</h2><table><tr><th>Token</th><th>Patient</th><th>Service</th><th>Time</th><th>Status</th></tr>${[["01","Asha Pawar","General OPD","10:30","Waiting"],["02","Ramesh More","Medicine","10:40","With Doctor"],["03","Sita Patil","Gynaecology","10:50","Priority"],["04","Meena Chaudhari","Postnatal","11:00","Waiting"]].map(x=>`<tr>${x.map(v=>`<td>${v}</td>`).join("")}</tr>`).join("")}</table></div>`;
    }
    else if(page==="diagnostics"){
      c.innerHTML=`<h1>🧪 Diagnostic Coordination</h1><div class="panel"><table><tr><th>Test</th><th>Patient</th><th>Facility</th><th>Status</th><th>Expected</th></tr>${[["CBC","Sita Patil","PHC Amalner","Sample collected","Today"],["HbA1c","Ramesh More","Sub-centre Nimkhedi","Awaiting sample","Tomorrow"],["ECG","Ganesh Shinde","Rural Hospital Bhusawal","Completed","Today"],["Malaria test","Asha Pawar","PHC Chalisgaon","Completed","Today"]].map(x=>`<tr>${x.map(v=>`<td>${v}</td>`).join("")}</tr>`).join("")}</table></div>`;
    }
    else if(page==="quality"){
      c.innerHTML=`<h1>📈 Facility Quality Dashboard</h1><div class="cards">${[["Referral completion","86%"],["Average OPD wait","24 min"],["Follow-up completion","78%"],["Essential medicines","92%"]].map(x=>`<div class="card"><small>${x[0]}</small><strong>${x[1]}</strong></div>`).join("")}</div><div class="panel"><h2>Quality improvement priorities</h2><ul><li>Improve specialist access through assisted teleconsultation.</li><li>Reduce referral drop-off with end-to-end tracking.</li><li>Improve medicine replenishment visibility.</li><li>Strengthen maternal, child and chronic-care follow-up.</li></ul></div>`;
    }
  } catch(err) {
    c.innerHTML=`<div class="panel"><h2>⚠️ Could not load data</h2><p>${esc(err.message)}</p><button onclick="render('${page}')">Retry</button></div>`;
  }
}

function showPatientForm(){
  const modal=document.createElement("div"); modal.className="modal";
  modal.innerHTML=`<div class="modalbox"><button class="close">×</button><h2>Add Patient</h2>
  <form id="pf"><label>Name<input id="fn" required></label><label>Age<input id="fa" type="number" min="0" max="120" required></label>
  <label>Gender<select id="fg"><option>Female</option><option>Male</option><option>Other</option></select></label>
  <label>Phone<input id="fp"></label><label>Village<input id="fv"></label><label>Condition<input id="fc"></label>
  <label>Risk<select id="fr"><option>Low</option><option>Medium</option><option>High</option></select></label>
  <button>Save patient</button></form></div>`;
  document.body.appendChild(modal);
  modal.querySelector(".close").onclick=()=>modal.remove();
  modal.querySelector("#pf").onsubmit=async e=>{
    e.preventDefault();
    try {
      const x=await api("/patients",{method:"POST",body:JSON.stringify({
        name:fn.value,age:+fa.value,gender:fg.value,phone:fp.value,village:fv.value,
        condition:fc.value,risk:fr.value,facility:user.facility
      })});
      modal.remove(); alert(`${x.patient_code} added successfully`); render("patients");
    } catch(err){alert(err.message)}
  };
}
async function updateReferral(id,status){
  try{await api(`/referrals/${id}?status=${encodeURIComponent(status)}`,{method:"PATCH"});render("referrals")}
  catch(err){alert(err.message)}
}

if(token) render("dashboard"); else loginView();
