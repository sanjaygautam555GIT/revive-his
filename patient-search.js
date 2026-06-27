async function renderPatientSearch(){
  document.getElementById("patientSearchView").innerHTML=`<div class="panel"><h2>Patient Search</h2><div class="form-row"><div><label>Search name / mobile / doctor</label><input id="searchTerm"></div><button id="searchBtn">Search</button></div></div><div class="panel table-wrap"><table><thead><tr><th>Type</th><th>Date</th><th>Patient</th><th>Info</th><th>Amount</th></tr></thead><tbody id="searchRows"></tbody></table></div>`;
  document.getElementById("searchBtn").onclick=searchPatients;
}

async function searchPatients(){
  const q=document.getElementById("searchTerm").value.trim().toLowerCase();
  const body=document.getElementById("searchRows");
  body.innerHTML="<tr><td colspan='5'>Searching...</td></tr>";
  const[opd,ipd,sales]=await Promise.all([fetchAll("patient"),fetchAll("ipd_admission"),fetchAll("pharmacy_sales")]);
  const rows=[];
  opd.filter(r=>[r.patient_name,r.mobile,r.doctor].join(" ").toLowerCase().includes(q)).forEach(r=>rows.push(["OPD",rowDate(r),r.patient_name,r.doctor,money(r.amount)]));
  ipd.filter(r=>[r.patient_name,r.mobile,r.doctor,r.surgery].join(" ").toLowerCase().includes(q)).forEach(r=>rows.push(["IPD",rowDate(r),r.patient_name,r.doctor||r.surgery,money(r.advance)]));
  sales.filter(r=>[r.patient_name,r.patient_type].join(" ").toLowerCase().includes(q)).forEach(r=>rows.push(["Pharmacy",r.bill_date,r.patient_name,r.patient_type,money(r.amount_paid)]));
  body.innerHTML=rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c||""}</td>`).join("")}</tr>`).join(""):"<tr><td colspan='5'>No record found</td></tr>";
}
