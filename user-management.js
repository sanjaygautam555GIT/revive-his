async function renderUserManagement(){
  if(currentUser?.role!=="owner"){document.getElementById("userManagementView").innerHTML="<div class='panel'><p class='error'>Owner access only.</p></div>";return;}
  const el=document.getElementById("userManagementView");
  el.innerHTML=`
    <div class="panel">
      <h2>User Management</h2>
      <p>Owner-only login control. Select a user and update the login code.</p>
      <div id="userMgmtMessage"></div>
    </div>
    <div class="panel table-wrap">
      <h3>Users</h3>
      <table><thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody id="appUserRows"></tbody></table>
    </div>
    <div class="panel hidden" id="changeLoginPanel">
      <h3>Change Login Code</h3>
      <input type="hidden" id="editUsername">
      <div class="grid" style="grid-template-columns:1fr 1fr 1fr auto">
        <div><label>Username</label><input id="editUsernameDisplay" readonly></div>
        <div><label>New Login Code</label><input id="newLoginCode" type="password"></div>
        <div><label>Confirm Login Code</label><input id="confirmLoginCode" type="password"></div>
        <div><label>&nbsp;</label><button type="button" id="saveLoginCodeBtn">Save</button></div>
      </div>
    </div>`;
  document.getElementById("saveLoginCodeBtn").onclick=saveLoginCode;
  await loadAppUsers();
}
async function loadAppUsers(){
  const body=document.getElementById("appUserRows");
  const {data,error}=await db.from("app_users").select("*").order("username",{ascending:true});
  if(error){body.innerHTML=`<tr><td colspan='5' class='error'>${error.message}</td></tr>`;return;}
  const rows=data||[];
  body.innerHTML=rows.length?rows.map(u=>`<tr><td>${u.username||""}</td><td>${u.display_name||""}</td><td>${u.role||""}</td><td>${u.status||"Active"}</td><td><button class='secondary' onclick='openLoginCodeChange("${u.username}")'>Change</button></td></tr>`).join(""):"<tr><td colspan='5'>No users found. Create users in Supabase first.</td></tr>";
}
function openLoginCodeChange(username){
  document.getElementById("changeLoginPanel").classList.remove("hidden");
  document.getElementById("editUsername").value=username;
  document.getElementById("editUsernameDisplay").value=username;
  document.getElementById("newLoginCode").value="";
  document.getElementById("confirmLoginCode").value="";
}
async function saveLoginCode(){
  const msg=document.getElementById("userMgmtMessage");
  const username=document.getElementById("editUsername").value;
  const a=document.getElementById("newLoginCode").value;
  const b=document.getElementById("confirmLoginCode").value;
  if(!username){msg.innerHTML="<p class='error'>Select user first.</p>";return;}
  if(a.length<6){msg.innerHTML="<p class='error'>Login code must be at least 6 characters.</p>";return;}
  if(a!==b){msg.innerHTML="<p class='error'>Login codes do not match.</p>";return;}
  const {error}=await db.from("app_users").update({login_code:a,updated_at:new Date().toISOString()}).eq("username",username);
  if(error){msg.innerHTML=`<p class='error'>Update failed: ${error.message}</p>`;return;}
  msg.innerHTML=`<p class='success'>Login code updated for ${username}.</p>`;
  document.getElementById("changeLoginPanel").classList.add("hidden");
  await loadAppUsers();
}
