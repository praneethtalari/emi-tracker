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

// AUTO LOGIN
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

// ADD LOAN
async function addLoan(){
  const name=document.getElementById("name").value;
  const amount=+document.getElementById("amount").value;
  const emi=+document.getElementById("emi").value;
  const interest=+document.getElementById("interest").value || 0;
  const start=document.getElementById("start").value;
  const tenure=+document.getElementById("tenure").value;

  if(!name||!amount||!emi||!start||!tenure) return alert("Fill all");

  let loan={
    name,
    amount,
    emi,
    interest,
    start,
    tenure,
    payments:[],
    schedule:[] // 🔥 new amortization
  };

  generateSchedule(loan);

  loans.push(loan);
  await save();
  render();
}

// 🔥 GENERATE AMORTIZATION SCHEDULE
function generateSchedule(loan){
  let balance = loan.amount;
  let rate = loan.interest / 100 / 12;

  loan.schedule = [];

  for(let i=0;i<loan.tenure;i++){
    let interest = balance * rate;
    let principal = loan.emi - interest;

    if(balance <= 0) break;

    balance -= principal;

    loan.schedule.push({
      month:i+1,
      interest: Math.round(interest),
      principal: Math.round(principal),
      balance: Math.max(0, Math.round(balance))
    });

    loan.payments.push({paid:false});
  }
}

// TOGGLE EMI
function togglePayment(i,j){
  loans[i].payments[j].paid = !loans[i].payments[j].paid;
  save();
  render();
}

// DELETE
async function deleteLoan(i){
  if(!confirm("Delete loan?")) return;
  loans.splice(i,1);
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

  l.payments=[];
  generateSchedule(l);

  save();
  render();
}

// EXPORT
function exportToExcel(){
  let rows=[["Loan","Balance","EMI","Interest"]];
  loans.forEach(l=>{
    let remaining=getRemainingBalance(l);
    rows.push([l.name,remaining,l.emi,l.interest]);
  });

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
    let remaining=getRemainingBalance(l);
    doc.text(`${l.name} | Remaining ₹${remaining}`,10,y);
    y+=10;
  });

  doc.save("loan-report.pdf");
}

// 🔥 REMAINING BALANCE CALCULATION
function getRemainingBalance(loan){
  let balance = loan.amount;

  loan.schedule.forEach((m,i)=>{
    if(loan.payments[i]?.paid){
      balance = m.balance;
    }
  });

  return Math.max(0, Math.round(balance));
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

  let totalPaid=0;
  let totalRemaining=0;

  loans.forEach((l,i)=>{
    let remaining=getRemainingBalance(l);
    totalRemaining += remaining;

    let html=`
    <div class="box">
      <div style="display:flex;justify-content:space-between;">
        <h3>${l.name}</h3>
        <div>
          <button onclick="editLoan(${i})">✏️</button>
          <button class="delete" onclick="deleteLoan(${i})">🗑️</button>
        </div>
      </div>
      <p>Remaining ₹${remaining}</p>
    `;

    l.schedule.forEach((m,j)=>{
      html+=`
      <div>
        <input type="checkbox" ${l.payments[j]?.paid?"checked":""}
        onclick="togglePayment(${i},${j})">
        EMI ${j+1} | Interest ₹${m.interest} | Balance ₹${m.balance}
      </div>`;
    });

    html+="</div>";

    container.innerHTML+=html;
    dash.innerHTML+=html;
  });

  document.getElementById("totalRemaining").innerText = totalRemaining;

  lucide.createIcons();
}
