function userRoleLabel(role){return ({owner:"Hospital Admin",staff:"Hospital Staff",pharmacyOwner:"Pharmacy Admin",pharmacy:"Pharmacy Staff",accountant:"Accountant",doctor:"Doctor"})[role]||role||""}
let userMgmtDoctors=[];
async function renderUserManagement(){
  if(currentUser?.role!=="owner"){document.getElementById("userManagementView").innerHTML="<div class='panel'><p class='error'>Hospital Admin access only.</p></div>";return;}
  const el=document.getElementById("userManagementView");
  const doctorResult=await db.from("doctor_master").select("id,doctor_name,department,status").order("doctor_name",{ascending:true});
  userMgmtDoctors=(doctorResult.data||[]).filter(d=>(d.status||"Active")==="Active");
  el.innerHTML=`
    <div class="panel">
      <h2>User Management</h2>
      <p>Create staff accounts and link Doctor logins to Doctor Master.</p>
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
      <h3>Users</h3>
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
  toggleDoctorLink();await loadAppUsers();
}
function toggleDoctorLink(){const isDoctor=document.getElementById("newUserRole")?.value==="doctor";document.getElementById("doctorLinkWrap")?.classList.toggle("hidden",!isDoctor);if(document.getElementById("newDoctorId"))document.getElementById("newDoctorId").required=isDoctor}
async function createAppUser(e){
  e.preventDefault();const msg=document.getElementById("userMgmtMessage");
  const role=document.getElementById("newUserRole").value;const doctorId=role==="doctor"?document.getElementById("newDoctorId").value:null;
  const payload={username:document.getElementById("newUsername").value.trim().toLowerCase(),display_name:document.getElementById("newDisplayName").value.trim(),email:document.getElementById("newUserEmail").value.trim().toLowerCase(),role,doctor_id:doctorId?Number(doctorId):null,login_code:document.getElementById("newLoginCodeCreate").value,status:"Active"};
  if(role==="doctor"&&!doctorId){msg.innerHTML="<p class='error'>Select the Doctor Master profile for this login.</p>";return}
  const {error}=await db.from("app_users").insert([payload]);if(error){msg.innerHTML=`<p class='error'>User creation failed: ${error.message}</p>`;return}
  msg.innerHTML=`<p class='success'>${userRoleLabel(role)} login created for ${payload.display_name}.</p>`;document.getElementById("newUserForm").reset();toggleDoctorLink();await loadAppUsers();
}
async function loadAppUsers(){
  const body=document.getElementById("appUserRows");
  const {data,error}=await db.from("app_users").select("*").order("username",{ascending:true});
  if(error){body.innerHTML=`<tr><td colspan='6' class='error'>${error.message}</td></tr>`;return;}
  const rows=data||[];
  body.innerHTML=rows.length?rows.map(u=>{const d=userMgmtDoctors.find(x=>String(x.id)===String(u.doctor_id));return `<tr><td>${u.username||""}</td><td>${u.display_name||""}</td><td>${userRoleLabel(u.role)}</td><td>${d?d.doctor_name:(u.role==="doctor"?"Not linked":"-")}</td><td>${u.status||"Active"}</td><td><button class='secondary' onclick='openLoginCodeChange("${u.username}")'>Change Code</button></td></tr>`}).join(""):"<tr><td colspan='6'>No users found.</td></tr>";
}
function openLoginCodeChange(username){document.getElementById("changeLoginPanel").classList.remove("hidden");document.getElementById("editUsername").value=username;document.getElementById("editUsernameDisplay").value=username;document.getElementById("newLoginCode").value="";document.getElementById("confirmLoginCode").value=""}
async function saveLoginCode(){const msg=document.getElementById("userMgmtMessage");const username=document.getElementById("editUsername").value;const a=document.getElementById("newLoginCode").value;const b=document.getElementById("confirmLoginCode").value;if(!username){msg.innerHTML="<p class='error'>Select user first.</p>";return}if(a.length<6){msg.innerHTML="<p class='error'>Login code must be at least 6 characters.</p>";return}if(a!==b){msg.innerHTML="<p class='error'>Login codes do not match.</p>";return}const {error}=await db.from("app_users").update({login_code:a,updated_at:new Date().toISOString()}).eq("username",username);if(error){msg.innerHTML=`<p class='error'>Update failed: ${error.message}</p>`;return}msg.innerHTML=`<p class='success'>Login code updated for ${username}.</p>`;document.getElementById("changeLoginPanel").classList.add("hidden");await loadAppUsers()}
