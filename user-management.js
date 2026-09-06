function userRoleLabel(role){return ({owner:"Hospital Admin",staff:"Hospital Staff",pharmacyOwner:"Pharmacy Admin",pharmacy:"Pharmacy Staff",accountant:"Accountant",doctor:"Doctor"})[role]||role||""}
let userMgmtDoctors=[];
let userMgmtUsers=[];

async function renderUserManagement(){
  if(currentUser?.role!=="owner"){document.getElementById("userManagementView").innerHTML="<div class='panel'><p class='error'>Hospital Admin access only.</p></div>";return;}
  const el=document.getElementById("userManagementView");
  const doctorResult=await db.from("doctor_master").select("id,doctor_name,department,status").order("doctor_name",{ascending:true});
  userMgmtDoctors=(doctorResult.data||[]).filter(d=>(d.status||"Active")==="Active");
  el.innerHTML=`
    <div class="panel">
      <h2>Doctor Portals</h2>
      <p>Every active doctor can have an individual Doctor Portal. Each login automatically shows only that doctor's assigned patients, daily notes, operations and discharge records.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Doctor</th><th>Department</th><th>Portal Status</th><th>Username</th><th>OTP Email</th><th>Action</th></tr></thead>
          <tbody id="doctorPortalRows"><tr><td colspan="6">Loading doctor portals...</td></tr></tbody>
        </table>
      </div>
    </div>
    <div class="panel" id="createUserPanel">
      <h2>Create User / Doctor Portal Login</h2>
      <p>Create staff accounts or link a Doctor login to a Doctor Master profile.</p>
      <div id="userMgmtMessage"></div>
      <form id="newUserForm">
        <div class="grid" style="grid-template-columns:repeat(3,1fr)">
          <div><label>Username</label><input id="newUsername" required placeholder="e.g. sanjay"></div>
          <div><label>Display Name</label><input id="newDisplayName" required placeholder="Dr. Sanjay Gautam"></div>
          <div><label>Email for OTP</label><input id="newUserEmail" type="email" required></div>
          <div><label>Role</label><select id="newUserRole"><option value="staff">Hospital Staff</option><option value="doctor">Doctor</option><option value="accountant">Accountant</option><option value="pharmacy">Pharmacy Staff</option><option value="pharmacyOwner">Pharmacy Admin</option></select></div>
          <div id="doctorLinkWrap" class="hidden"><label>Link Doctor Profile</label><select id="newDoctorId"><option value="">Select doctor</option>${userMgmtDoctors.map(d=>`<option value="${d.id}">${d.doctor_name} · ${d.department||""}</option>`).join("")}</select></div>
          <div><label>Login Code</label><input id="newLoginCodeCreate" type="password" minlength="6" required></div>
        </div>
        <br><button type="submit">Create User</button>
      </form>
    </div>
    <div class="panel table-wrap">
      <h3>All Users</h3>
      <table><thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Doctor Profile</th><th>Status</th><th>Action</th></tr></thead><tbody id="appUserRows"></tbody></table>
    </div>
    <div class="panel hidden" id="changeLoginPanel">
      <h3>Edit User Login</h3>
      <input type="hidden" id="editUsername">
      <div class="grid" style="grid-template-columns:1fr 1fr 1fr auto">
        <div><label>Username</label><input id="editUsernameDisplay" readonly></div>
        <div><label>New Login Code</label><input id="newLoginCode" type="password"></div>
        <div><label>Confirm Login Code</label><input id="confirmLoginCode" type="password"></div>
        <div><label>&nbsp;</label><button type="button" id="saveLoginCodeBtn">Save</button></div>
      </div>
    </div>`;
  document.getElementById("newUserRole").onchange=toggleDoctorLink;
  document.getElementById("newUserForm").onsubmit=createAppUser;
  document.getElementById("saveLoginCodeBtn").onclick=saveLoginCode;
  toggleDoctorLink();
  await loadAppUsers();
}

function toggleDoctorLink(){
  const isDoctor=document.getElementById("newUserRole")?.value==="doctor";
  document.getElementById("doctorLinkWrap")?.classList.toggle("hidden",!isDoctor);
  if(document.getElementById("newDoctorId"))document.getElementById("newDoctorId").required=isDoctor;
}

function portalUsernameSuggestion(name){
  return String(name||"").toLowerCase().replace(/^dr\.?\s*/,"").replace(/[^a-z0-9]+/g,".").replace(/^\.+|\.+$/g,"");
}

function setupDoctorPortal(doctorId){
  const d=userMgmtDoctors.find(x=>String(x.id)===String(doctorId));
  if(!d)return;
  document.getElementById("newUserRole").value="doctor";
  toggleDoctorLink();
  document.getElementById("newDoctorId").value=String(d.id);
  document.getElementById("newDisplayName").value=d.doctor_name||"";
  document.getElementById("newUsername").value=portalUsernameSuggestion(d.doctor_name);
  document.getElementById("newUserEmail").value="";
  document.getElementById("newLoginCodeCreate").value="";
  document.getElementById("userMgmtMessage").innerHTML=`<p class='success'>Creating Doctor Portal for ${d.doctor_name}. Enter the doctor's OTP email and a login code, then click Create User.</p>`;
  document.getElementById("createUserPanel")?.scrollIntoView({behavior:"smooth",block:"start"});
  setTimeout(()=>document.getElementById("newUserEmail")?.focus(),350);
}

function renderDoctorPortalRows(){
  const body=document.getElementById("doctorPortalRows");
  if(!body)return;
  if(!userMgmtDoctors.length){body.innerHTML="<tr><td colspan='6'>No active doctors found in Doctor Master.</td></tr>";return;}
  body.innerHTML=userMgmtDoctors.map(d=>{
    const linked=userMgmtUsers.find(u=>u.role==="doctor"&&String(u.doctor_id)===String(d.id)&&String(u.status||"Active").toLowerCase()!=="inactive");
    if(linked){
      return `<tr><td><b>${d.doctor_name||""}</b></td><td>${d.department||""}</td><td><span class='success'>Portal Active</span></td><td>${linked.username||""}</td><td>${linked.email||""}</td><td><button class='secondary' type='button' onclick='openLoginCodeChange("${linked.username}")'>Change Login Code</button></td></tr>`;
    }
    return `<tr><td><b>${d.doctor_name||""}</b></td><td>${d.department||""}</td><td><span class='error'>No Portal Login</span></td><td>-</td><td>-</td><td><button type='button' onclick='setupDoctorPortal(${d.id})'>Create Portal Login</button></td></tr>`;
  }).join("");
}

async function createAppUser(e){
  e.preventDefault();
  const msg=document.getElementById("userMgmtMessage");
  const role=document.getElementById("newUserRole").value;
  const doctorId=role==="doctor"?document.getElementById("newDoctorId").value:null;
  const payload={username:document.getElementById("newUsername").value.trim().toLowerCase(),display_name:document.getElementById("newDisplayName").value.trim(),email:document.getElementById("newUserEmail").value.trim().toLowerCase(),role,doctor_id:doctorId?Number(doctorId):null,login_code:document.getElementById("newLoginCodeCreate").value,status:"Active"};
  if(role==="doctor"&&!doctorId){msg.innerHTML="<p class='error'>Select the Doctor Master profile for this login.</p>";return;}
  if(role==="doctor"&&userMgmtUsers.some(u=>u.role==="doctor"&&String(u.doctor_id)===String(doctorId)&&String(u.status||"Active").toLowerCase()!=="inactive")){
    msg.innerHTML="<p class='error'>This doctor already has an active Doctor Portal login.</p>";return;
  }
  const {error}=await db.from("app_users").insert([payload]);
  if(error){msg.innerHTML=`<p class='error'>User creation failed: ${error.message}</p>`;return;}
  msg.innerHTML=`<p class='success'>${role==="doctor"?"Doctor Portal":"User login"} created for ${payload.display_name}.</p>`;
  document.getElementById("newUserForm").reset();toggleDoctorLink();await loadAppUsers();
}

async function loadAppUsers(){
  const body=document.getElementById("appUserRows");
  const {data,error}=await db.from("app_users").select("*").order("username",{ascending:true});
  if(error){body.innerHTML=`<tr><td colspan='6' class='error'>${error.message}</td></tr>`;return;}
  userMgmtUsers=data||[];
  renderDoctorPortalRows();
  body.innerHTML=userMgmtUsers.length?userMgmtUsers.map(u=>{const d=userMgmtDoctors.find(x=>String(x.id)===String(u.doctor_id));return `<tr><td>${u.username||""}</td><td>${u.display_name||""}</td><td>${userRoleLabel(u.role)}</td><td>${d?d.doctor_name:(u.role==="doctor"?"Not linked":"-")}</td><td>${u.status||"Active"}</td><td><button class='secondary' onclick='openLoginCodeChange("${u.username}")'>Change Code</button></td></tr>`}).join(""):"<tr><td colspan='6'>No users found.</td></tr>";
}

function openLoginCodeChange(username){
  document.getElementById("changeLoginPanel").classList.remove("hidden");
  document.getElementById("editUsername").value=username;
  document.getElementById("editUsernameDisplay").value=username;
  document.getElementById("newLoginCode").value="";
  document.getElementById("confirmLoginCode").value="";
  document.getElementById("changeLoginPanel")?.scrollIntoView({behavior:"smooth",block:"center"});
}

async function saveLoginCode(){
  const msg=document.getElementById("userMgmtMessage");const username=document.getElementById("editUsername").value;const a=document.getElementById("newLoginCode").value;const b=document.getElementById("confirmLoginCode").value;
  if(!username){msg.innerHTML="<p class='error'>Select user first.</p>";return;}
  if(a.length<6){msg.innerHTML="<p class='error'>Login code must be at least 6 characters.</p>";return;}
  if(a!==b){msg.innerHTML="<p class='error'>Login codes do not match.</p>";return;}
  const {error}=await db.from("app_users").update({login_code:a,updated_at:new Date().toISOString()}).eq("username",username);
  if(error){msg.innerHTML=`<p class='error'>Update failed: ${error.message}</p>`;return;}
  msg.innerHTML=`<p class='success'>Login code updated for ${username}.</p>`;
  document.getElementById("changeLoginPanel").classList.add("hidden");await loadAppUsers();
}
