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
let barChart, lineChart, pieChart;

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
  userName.innerText=u.displayName;
  userEmail.innerText=u.email;
  userPic.src=u.photoURL;
  document.getElementById("userProfile").classList.remove("hidden");
}

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

// EMI CALCULATION
function calculateEMI(amount, interest, tenure){
  let r=interest/100/12;
  if(r===0) return Math.round(amount/tenure);
  return Math.round(amount*r*Math.pow(1+r,tenure)/(Math.pow(1+r,tenure)-1));
}

// AUTO UPDATE EMI
function updateEMI(){
  const amount=+document.getElementById("amount").value;
  const interest=+document.getElementById("interest").value||0;
  const tenure=+document.getElementById("tenure").value;

  if(amount&&tenure){
    document.getElementById("emi").value=calculateEMI(amount,interest,tenure);
  }
}

window.addEventListener("DOMContentLoaded",()=>{
  document.getElementById("amount").addEventListener("input",updateEMI);
  document.getElementById("interest").addEventListener("input",updateEMI);
  document.getElementById("tenure").addEventListener("input",updateEMI);
});

// ADD LOAN
async function addLoan(){
  const name=document.getElementById("name").value;
  const amount=+document.getElementById("amount").value;
  const interest=+document.getElementById("interest").value||0;
  const tenure=+document.getElementById("tenure").value;
  const start=document.getElementById("start").value;

  if(!name||!amount||!start||!tenure){
    alert("Fill all fields");
    return;
  }

  const emi=calculateEMI(amount,interest,tenure);

  let loan={name,amount,emi,interest,start,tenure,payments:[],schedule:[]};

  generateSchedule(loan);

  loans.push(loan);
  await save();
  render();
}

// AMORTIZATION
function generateSchedule(loan){
  let balance=loan.amount;
  let rate=loan.interest/100/12;
  let d=new Date(loan.start);

  loan.schedule=[];
  loan.payments=[];

  for(let i=0;i<loan.tenure;i++){
    if(balance<=0) break;

    let interest=balance*rate;
    let principal=Math.min(balance, loan.emi - interest);

    balance-=principal;

    let nd=new Date(d);
    nd.setMonth(d.getMonth()+i);

    loan.schedule.push({
      date:nd.toISOString().split("T")[0],
      interest:Math.round(interest),
      principal:Math.round(principal),
      balance:Math.max(0,Math.round(balance))
    });

    loan.payments.push({
      paid:false,
      date:nd.toISOString().split("T")[0]
    });
  }
}

// CALCULATIONS
function calculateLoanStats(loan){
  let paidPrincipal=0,paidInterest=0,remaining=loan.amount;

  loan.schedule.forEach((m,i)=>{
    if(loan.payments[i]?.paid){
      paidPrincipal+=m.principal;
      paidInterest+=m.interest;
      remaining=m.balance;
    }
  });

  return {
    paidPrincipal,
    paidInterest,
    totalPaid:paidPrincipal+paidInterest,
    remaining
  };
}

// DEBT FREE DATE
function getDebtFreeDate(){
  let last=null;
  loans.forEach(l=>{
    l.schedule.forEach((m,i)=>{
      if(!l.payments[i]?.paid) last=new Date(m.date);
    });
  });
  return last?last.toDateString():"-";
}

// TOGGLE EMI
function togglePayment(i,j){
  loans[i].payments[j].paid=!loans[i].payments[j].paid;
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
  l.interest=+prompt("Interest",l.interest)||0;
  l.tenure=+prompt("Months",l.tenure);

  l.emi=calculateEMI(l.amount,l.interest,l.tenure);
  generateSchedule(l);

  save();
  render();
}

// EXPORT CSV
function exportToExcel(){
  let rows=[["Loan","Remaining"]];
  loans.forEach(l=>{
    let s=calculateLoanStats(l);
    rows.push([l.name,s.remaining]);
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
  const {jsPDF}=window.jspdf;
  let doc=new jsPDF();

  doc.text("Loan Report",10,10);
  let y=20;

  loans.forEach(l=>{
    let s=calculateLoanStats(l);
    doc.text(`${l.name} Remaining ₹${s.remaining}`,10,y);
    y+=10;
  });

  doc.save("report.pdf");
}

// TAB SWITCH
function switchTab(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// CHARTS
function drawCharts(){

  let labels=loans.map(l=>l.name);
  let data=loans.map(l=>calculateLoanStats(l).remaining);

  if(barChart) barChart.destroy();

  barChart=new Chart(document.getElementById("barChart"),{
    type:"bar",
    data:{labels,datasets:[{label:"Remaining Balance",data}]},
    options:{animation:{duration:1200}}
  });

  if(loans.length>0){
    let l=loans[0];
    let balances=l.schedule.map(m=>m.balance);

    if(lineChart) lineChart.destroy();

    lineChart=new Chart(document.getElementById("lineChart"),{
      type:"line",
      data:{
        labels:balances.map((_,i)=>i+1),
        datasets:[{label:"Balance",data:balances,tension:0.4}]
      },
      options:{animation:{duration:1500}}
    });
  }

  let p=0,i=0;
  loans.forEach(l=>{
    let s=calculateLoanStats(l);
    p+=s.paidPrincipal;
    i+=s.paidInterest;
  });

  if(pieChart) pieChart.destroy();

  pieChart=new Chart(document.getElementById("pieChart"),{
    type:"pie",
    data:{
      labels:["Principal","Interest"],
      datasets:[{data:[p,i]}]
    },
    options:{animation:{duration:1200}}
  });
}

// RENDER
function render(){
  let container=document.getElementById("loans");
  let dash=document.getElementById("loansDashboard");

  container.innerHTML="";
  dash.innerHTML="";

  let totalPaid=0,totalRemaining=0,totalEMI=0;

  loans.forEach((l,i)=>{
    let s=calculateLoanStats(l);

    totalPaid+=s.totalPaid;
    totalRemaining+=s.remaining;
    totalEMI+=l.schedule.filter((_,j)=>!l.payments[j]?.paid).length;

    let html=`
    <div class="box">
      <div style="display:flex;justify-content:space-between;">
        <h3>${l.name}</h3>
        <div>
          <button onclick="editLoan(${i})">✏️</button>
          <button class="delete" onclick="deleteLoan(${i})">🗑️</button>
        </div>
      </div>
      <p>Remaining ₹${s.remaining}</p>
      <p>Paid ₹${s.totalPaid}</p>
    </div>`;

    container.innerHTML+=html;
    dash.innerHTML+=html;
  });

  document.getElementById("totalPaid").innerText=totalPaid;
  document.getElementById("totalRemaining").innerText=totalRemaining;
  document.getElementById("monthsLeft").innerText=totalEMI;
  document.getElementById("debtFreeDate").innerText=getDebtFreeDate();

  drawCharts();
  lucide.createIcons();
}
