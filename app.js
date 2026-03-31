const firebaseConfig = {
  apiKey: "AIzaSyD8qs6TDKkN3-vdV7Xa3nA0YzydHklB3gQ",
  authDomain: "emi-tracker-9081d.firebaseapp.com",
  projectId: "emi-tracker-9081d"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

let loans = [];
let user;
let chart, amortChart;

// LOGIN
function login(){
  const provider=new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).then(res=>{
    user=res.user;
    showUserProfile(user);
    loadData();
  });
}

// PROFILE
function showUserProfile(u){
  document.getElementById("userProfile").classList.remove("hidden");
  userName.innerText=u.displayName;
  userEmail.innerText=u.email;
  userPic.src=u.photoURL;
}

// LOGOUT
function logout(){
  auth.signOut().then(()=>location.reload());
}

auth.onAuthStateChanged(u=>{
  if(u){
    user=u;
    showUserProfile(u);
    loadData();
  }
});

// LOAD
async function loadData(){
  const doc=await db.collection("loans").doc(user.uid).get();
  loans=doc.exists?doc.data().loans||[]:[];
  render();
}

// SAVE
async function save(){
  await db.collection("loans").doc(user.uid).set({loans});
}

// ADD
async function addLoan(){
  const name=document.getElementById("name").value;
  const amount=+document.getElementById("amount").value;
  const emi=+document.getElementById("emi").value;
  const interest=+document.getElementById("interest").value||0;
  const start=document.getElementById("start").value;
  const tenure=+document.getElementById("tenure").value;

  if(!name||!amount||!emi||!start||!tenure) return alert("Fill all");

  let loan={name,amount,emi,interest,start,tenure,payments:[]};

  let d=new Date(start);
  for(let i=0;i<tenure;i++){
    let nd=new Date(d);
    nd.setMonth(d.getMonth()+i);
    loan.payments.push({paid:false,date:nd.toISOString().split("T")[0]});
  }

  loans.push(loan);
  await save();
  render();
}

// EDIT
function editLoan(i){
  let l=loans[i];
  l.name=prompt("Name",l.name);
  l.amount=+prompt("Amount",l.amount);
  l.emi=+prompt("EMI",l.emi);
  l.interest=+prompt("Interest",l.interest)||0;
  save(); render();
}

// DELETE
async function deleteLoan(i){
  if(!confirm("Delete?")) return;
  loans.splice(i,1);
  await save();
  render();
}

// EXPORT CSV
function exportToExcel(){
  let rows=[["Name","Amount","EMI","Interest"]];
  loans.forEach(l=>rows.push([l.name,l.amount,l.emi,l.interest]));
  let csv=rows.map(r=>r.join(",")).join("\n");

  let blob=new Blob([csv]);
  let a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="loans.csv";
  a.click();
}

// PDF
function generatePDF(){
  const { jsPDF }=window.jspdf;
  let doc=new jsPDF();

  doc.text("Loan Report",10,10);

  let y=20;
  loans.forEach(l=>{
    doc.text(`${l.name} ₹${l.amount} EMI ${l.emi}`,10,y);
    y+=10;
  });

  doc.save("loan-report.pdf");
}

// TAB
function switchTab(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// RENDER
function render(){
  let container=document.getElementById("loans");
  let dash=document.getElementById("loansDashboard");

  container.innerHTML="";
  dash.innerHTML="";

  loans.forEach((l,i)=>{
    let html=`
    <div class="box">
      <div style="display:flex;justify-content:space-between;">
        <h3>${l.name}</h3>
        <div>
          <button onclick="editLoan(${i})">✏️</button>
          <button class="delete" onclick="deleteLoan(${i})">🗑️</button>
        </div>
      </div>
      <p>₹${l.amount} | EMI ${l.emi}</p>
    </div>`;

    container.innerHTML+=html;
    dash.innerHTML+=html;
  });

  lucide.createIcons();
}
