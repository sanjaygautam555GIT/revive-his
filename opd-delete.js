// Same-day OPD visit deletion for mistaken or duplicate entries.
(function(){
  const originalLoad=window.loadOPDRegister;
  if(typeof originalLoad!=="function")return;

  window.loadOPDRegister=async function(){
    const body=document.getElementById("opdRows");
    if(!body)return;
    const {data,error}=await db.from("opd_visits").select("*").eq("visit_date",todayISO()).order("created_at",{ascending:true});
    const table=body.closest("table");
    const head=table?.querySelector("thead");
    if(head)head.innerHTML="<tr><th>Token</th><th>Visit ID</th><th>UHID</th><th>Name</th><th>Department</th><th>Doctor</th><th>Fee</th><th>Mode</th><th>Print</th><th>Action</th></tr>";
    if(error){body.innerHTML=`<tr><td colspan='10' class='error'>${error.message}</td></tr>`;return;}
    const rows=data||[];
    body.innerHTML=rows.length?rows.map((r,i)=>`<tr>
      <td>${String(i+1).padStart(3,"0")}</td>
      <td>${r.visit_id||""}</td>
      <td>${r.uhid||""}</td>
      <td>${r.patient_name||""}</td>
      <td>${r.department||""}</td>
      <td>${r.consultant||""}</td>
      <td>${money(r.amount||0)}</td>
      <td>${r.payment_mode||""}</td>
      <td><button class='secondary' onclick="printOPDSlip('${r.visit_id}')">Print</button></td>
      <td><button class='secondary' onclick="deleteOPDVisit('${r.id}','${String(r.visit_id||"").replaceAll("'","\\'")}','${String(r.patient_name||"").replaceAll("'","\\'")}')">Delete</button></td>
    </tr>`).join(""):"<tr><td colspan='10'>No OPD visits today.</td></tr>";
  };

  window.deleteOPDVisit=async function(rowId,visitId,patientName){
    if(currentUser?.role!=="staff"){
      alert("Only hospital staff can delete a same-day OPD visit.");
      return;
    }
    const ok=confirm(`Delete this OPD visit?\n\nPatient: ${patientName||"-"}\nVisit ID: ${visitId||"-"}\n\nUse this only for a mistaken or duplicate same-day entry.`);
    if(!ok)return;

    const {data:visit,error:readError}=await db.from("opd_visits").select("*").eq("id",rowId).maybeSingle();
    if(readError||!visit){alert("OPD visit could not be verified.");return;}
    if(String(visit.visit_date||"").slice(0,10)!==todayISO()){
      alert("Only OPD visits created today can be deleted from this screen.");
      return;
    }

    const {data,error}=await db.from("opd_visits").delete().eq("id",rowId).select();
    if(error){alert("Delete failed: "+error.message);return;}
    if(!data||!data.length){alert("Visit was not deleted. Supabase delete permission may be missing.");return;}

    const msg=document.getElementById("opdMessage");
    if(msg)msg.innerHTML=`<p class='success'>Deleted mistaken/duplicate OPD visit: ${visitId||""}. The patient UHID has been retained.</p>`;
    await window.loadOPDRegister();
  };
})();