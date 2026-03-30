// 🔥 FIREBASE CONFIG (YOURS)
const firebaseConfig = {
  apiKey: "AIzaSyD...",
  authDomain: "emi-tracker-9081d.firebaseapp.com",
  projectId: "emi-tracker-9081d"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

let loans = [];
let user;
let chart, amortChart;

// 🔐 LOGIN
function login() {
  const provider = new firebase.auth.GoogleAuthProvider();

  auth.signInWithPopup(provider).then(res => {
    if (res.user.email !== "praneethtalari1@gmail.com") {
      alert("Access denied");
      auth.signOut();
      return;
    }
    user = res.user;
    loadData();
  });
}

// ☁️ LOAD
function loadData() {
  db.collection("loans").doc(user.uid).get().then(doc => {
    if (doc.exists) loans = doc.data().loans;
    render();
  });
}

// 💾 SAVE
function save() {
  db.collection("loans").doc(user.uid).set({ loans });
}

// ➕ ADD LOAN
function addLoan() {
  const loan = {
    name: name.value,
    amount: +amount.value,
    emi: +emi.value,
    interest: +interest.value || 0,
    start: start.value,
    tenure: +tenure.value,
    payments: []
  };

  let d = new Date(loan.start);
  for (let i=0;i<loan.tenure;i++){
    let nd=new Date(d);
    nd.setMonth(d.getMonth()+i);
    loan.payments.push({paid:false,date:nd.toISOString().split("T")[0]});
  }

  loans.push(loan);
  save();
  render();
}

// ✅ TOGGLE
function togglePayment(i,j){
  loans[i].payments[j].paid=!loans[i].payments[j].paid;
  save(); render();
}

// 📅 DEBT FREE
function debtFree(){
  let max=null;
  loans.forEach(l=>{
    l.payments.forEach(p=>{
      if(!p.paid){
        let d=new Date(p.date);
        if(!max||d>max) max=d;
      }
    });
  });
  return max?max.toDateString():"-";
}

// 💸 SIMULATOR
function simulate(){
  let extra=+extraInput.value||0;
  let months=0;

  loans.forEach(l=>{
    let rem=l.payments.filter(p=>!p.paid).length*l.emi;
    months+=Math.ceil(rem/(l.emi+extra));
  });

  result.innerText=`New payoff: ${months} months`;
}

// 📊 AMORTIZATION
function amortization(){
  let principal=0, interest=0;

  loans.forEach(l=>{
    let paid=l.payments.filter(p=>p.paid).length*l.emi;
    principal+=paid;
    interest+=paid*(l.interest/100);
  });

  if(amortChart) amortChart.destroy();

  amortChart=new Chart(amortChartCanvas,{
    type:"bar",
    data:{
      labels:["Principal","Interest"],
      datasets:[{
        data:[principal,interest],
        backgroundColor:["#22c55e","#ef4444"]
      }]
    }
  });
}

// 📊 MAIN CHART
function drawChart(paid,remain){
  if(chart) chart.destroy();
  chart=new Chart(chartCanvas,{
    type:"doughnut",
    data:{
      labels:["Paid","Remaining"],
      datasets:[{data:[paid,remain]}]
    }
  });
}

// 🧠 AI INSIGHTS (Gemini via REST)
async function getAIInsights(){
  let summary=JSON.stringify(loans);

  let res=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_API_KEY",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      contents:[{
        parts:[{text:`Analyze loans and suggest payoff strategy: ${summary}`}]
      }]
    })
  });

  let data=await res.json();

  aiBox.innerText=data.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
}

// 🔄 RENDER
function render(){
  let totalPaid=0,totalRemain=0,months=0;

  loans.forEach((l,i)=>{
    let paid=l.payments.filter(p=>p.paid).length*l.emi;
    totalPaid+=paid;
    totalRemain+=l.amount-paid;
    months+=l.payments.filter(p=>!p.paid).length;
  });

  totalPaidEl.innerText=totalPaid;
  totalRemainingEl.innerText=totalRemain;
  monthsLeft.innerText=months;
  debtFreeDate.innerText=debtFree();

  drawChart(totalPaid,totalRemain);
  amortization();

  loansDiv.innerHTML="";
  loans.forEach((l,i)=>{
    let html=`<div class="loan"><h3>${l.name}</h3>`;
    l.payments.forEach((p,j)=>{
      html+=`<div class="emi">
        <input type="checkbox" ${p.paid?"checked":""}
        onclick="togglePayment(${i},${j})">
        ${p.date}
      </div>`;
    });
    html+=`</div>`;
    loansDiv.innerHTML+=html;
  });
}
