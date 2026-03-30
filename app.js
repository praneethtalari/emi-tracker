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
function login() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).then(res => {
    user = res.user;
    showUserProfile(user);
    loadData();
  });
}

// PROFILE
function showUserProfile(u) {
  document.getElementById("userProfile").classList.remove("hidden");
  document.getElementById("userName").innerText = u.displayName;
  document.getElementById("userEmail").innerText = u.email;
  document.getElementById("userPic").src = u.photoURL;
}

// LOGOUT
function logout() {
  auth.signOut().then(() => location.reload());
}

// AUTO LOGIN
auth.onAuthStateChanged(u => {
  if (u) {
    user = u;
    showUserProfile(u);
    loadData();
  }
});

// LOAD
function loadData() {
  db.collection("loans").doc(user.uid).get().then(doc => {
    if (doc.exists) loans = doc.data().loans || [];
    render();
  });
}

// SAVE
function save() {
  db.collection("loans").doc(user.uid).set({ loans });
}

// ADD LOAN ✅ FIXED
function addLoan() {
  const name = document.getElementById("name").value;
  const amount = +document.getElementById("amount").value;
  const emi = +document.getElementById("emi").value;
  const interest = +document.getElementById("interest").value || 0;
  const start = document.getElementById("start").value;
  const tenure = +document.getElementById("tenure").value;

  if (!name || !amount || !emi || !start || !tenure) {
    alert("Fill all fields");
    return;
  }

  let loan = { name, amount, emi, interest, start, tenure, payments: [] };

  let d = new Date(start);
  for (let i=0;i<tenure;i++){
    let nd=new Date(d);
    nd.setMonth(d.getMonth()+i);
    loan.payments.push({paid:false,date:nd.toISOString().split("T")[0]});
  }

  loans.push(loan);
  save();
  render();
}

// TOGGLE
function togglePayment(i,j){
  loans[i].payments[j].paid=!loans[i].payments[j].paid;
  save(); render();
}

// SIMULATE
function simulate(){
  let extra=+document.getElementById("extra").value||0;
  let months=0;

  loans.forEach(l=>{
    let rem=l.payments.filter(p=>!p.paid).length*l.emi;
    months+=Math.ceil(rem/(l.emi+extra));
  });

  document.getElementById("result").innerText=`${months} months`;
}

// CHARTS
function drawChart(paid,remain){
  if(chart) chart.destroy();
  chart=new Chart(document.getElementById("chart"),{
    type:"doughnut",
    data:{labels:["Paid","Remaining"],datasets:[{data:[paid,remain]}]}
  });
}

function drawAmort(){
  let p=0,i=0;
  loans.forEach(l=>{
    let paid=l.payments.filter(p=>p.paid).length*l.emi;
    p+=paid;
    i+=paid*(l.interest/100);
  });

  if(amortChart) amortChart.destroy();

  amortChart=new Chart(document.getElementById("amortChart"),{
    type:"bar",
    data:{labels:["Principal","Interest"],datasets:[{data:[p,i]}]}
  });
}

// TAB SWITCH
function switchTab(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// RENDER
function render(){
  let paid=0,remain=0,months=0;
  let container=document.getElementById("loans");
  container.innerHTML="";

  loans.forEach((l,i)=>{
    let paidCount=l.payments.filter(p=>p.paid).length;
    let p=paidCount*l.emi;

    paid+=p;
    remain+=l.amount-p;
    months+=l.payments.filter(p=>!p.paid).length;

    let html=`<div class="box"><h3>${l.name}</h3>`;
    l.payments.forEach((p,j)=>{
      html+=`<div>
      <input type="checkbox" ${p.paid?"checked":""}
      onclick="togglePayment(${i},${j})">
      ${p.date}
      </div>`;
    });
    html+="</div>";
    container.innerHTML+=html;
  });

  totalPaid.innerText=paid;
  totalRemaining.innerText=remain;
  monthsLeft.innerText=months;

  drawChart(paid,remain);
  drawAmort();
}
