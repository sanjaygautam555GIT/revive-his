const USERS={owner:{password:"owner123",role:"owner",name:"Owner"},staff:{password:"staff123",role:"staff",name:"Hospital Staff"},pharmacyowner:{password:"pharmowner123",role:"pharmacyOwner",name:"Pharmacy Owner"},pharmacy:{password:"pharmacy123",role:"pharmacy",name:"Pharmacy Staff"},accountant:{password:"account123",role:"accountant",name:"Accountant"}};
const ROLE_LABELS={owner:"Owner – Observe only",staff:"Staff – OPD/IPD/Billing",pharmacyOwner:"Pharmacy Owner – Stock only",pharmacy:"Pharmacy Staff – Billing only",accountant:"Accountant – Expenses/Reports"};
const NAV_BY_ROLE={owner:["dashboard","patientSearch","cashReport","reports"],staff:["dashboard","opd","ipd","patientSearch"],pharmacyOwner:["pharmacyStock"],pharmacy:["pharmacyBilling"],accountant:["dashboard","expenses","cashReport","reports"]};
let currentUser=null;
function login(username,password){const key=username.trim().toLowerCase();const user=USERS[key];if(!user||user.password!==password)return null;currentUser={username:key,...user};sessionStorage.setItem("reviveUser",JSON.stringify(currentUser));return currentUser}
function restoreSession(){const raw=sessionStorage.getItem("reviveUser");if(!raw)return null;currentUser=JSON.parse(raw);return currentUser}
function logout(){currentUser=null;sessionStorage.removeItem("reviveUser")}
