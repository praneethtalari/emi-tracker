// 🔥 FIREBASE CONFIG
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

// 🔐 LOGIN (MULTI USER)
function login() {
  const provider = new firebase.auth.GoogleAuthProvider();

  auth.signInWithPopup(provider).then(res => {
    user = res.user;

    showUserProfile(user);
    loadData();
  });
}

// 👤 SHOW USER PROFILE
function showUserProfile(u) {
  document.getElementById("userProfile").classList.remove("hidden");

  document.getElementById("userName").innerText = u.displayName;
  document.getElementById("userEmail").innerText = u.email;
  document.getElementById("userPic").src = u.photoURL;
}

// 🚪 LOGOUT
function logout() {
  auth.signOut().then(() => {
    location.reload();
  });
}

// 🔄 AUTO LOGIN
auth.onAuthStateChanged(u => {
  if (u) {
    user = u;
    showUserProfile(u);
    loadData();
  }
});

// ☁️ LOAD DATA
function loadData() {
  db.collection("loans").doc(user.uid).get().then(doc => {
    if (doc.exists) loans = doc.data().loans || [];
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

  for (let i = 0; i < loan.tenure; i++) {
    let nd = new Date(d);
    nd.setMonth(d.getMonth() + i);

    loan.payments.push({
      paid: false,
      date: nd.toISOString().split("T")[0]
    });
  }

  loans.push(loan);
  save();
  render();
}

// ✅ TOGGLE EMI
function togglePayment(i, j) {
  loans[i].payments[j].paid = !loans[i].payments[j].paid;
  save();
  render();
}

// 📅 DEBT FREE DATE
function debtFree() {
  let max = null;

  loans.forEach(l => {
    l.payments.forEach(p => {
      if (!p.paid) {
        let d = new Date(p.date);
        if (!max || d > max) max = d;
      }
    });
  });

  return max ? max.toDateString() : "-";
}

// 💸 PREPAYMENT SIMULATOR
function simulate() {
  let extra = +document.getElementById("extra").value || 0;
  let months = 0;

  loans.forEach(l => {
    let remaining = l.payments.filter(p => !p.paid).length * l.emi;
    months += Math.ceil(remaining / (l.emi + extra));
  });

  document.getElementById("result").innerText =
    `New payoff time: ${months} months`;
}

// 📊 AMORTIZATION
function drawAmort() {
  let principal = 0, interest = 0;

  loans.forEach(l => {
    let paid = l.payments.filter(p => p.paid).length * l.emi;
    principal += paid;
    interest += paid * (l.interest / 100);
  });

  if (amortChart) amortChart.destroy();

  amortChart = new Chart(document.getElementById("amortChart"), {
    type: "bar",
    data: {
      labels: ["Principal", "Interest"],
      datasets: [{
        data: [principal, interest],
        backgroundColor: ["#22c55e", "#ef4444"]
      }]
    }
  });
}

// 📊 MAIN CHART
function drawChart(paid, remaining) {
  if (chart) chart.destroy();

  chart = new Chart(document.getElementById("chart"), {
    type: "doughnut",
    data: {
      labels: ["Paid", "Remaining"],
      datasets: [{
        data: [paid, remaining],
        backgroundColor: ["#22c55e", "#ef4444"]
      }]
    }
  });
}

// 🔔 REMINDERS
function checkReminders() {
  let today = new Date();
  let tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  let msgs = [];

  loans.forEach(l => {
    l.payments.forEach(p => {
      let d = new Date(p.date);

      if (!p.paid) {
        if (d.toDateString() === tomorrow.toDateString())
          msgs.push(`⚠️ EMI tomorrow (${l.name})`);

        if (d < today)
          msgs.push(`❌ Overdue EMI (${l.name})`);
      }
    });
  });

  if (msgs.length) alert(msgs.join("\n"));
}

// 📊 STRATEGY
function showStrategy() {
  let data = loans.map(l => {
    let paid = l.payments.filter(p => p.paid).length * l.emi;
    return { name: l.name, remaining: l.amount - paid };
  });

  let snowball = [...data].sort((a,b)=>a.remaining-b.remaining);
  let avalanche = [...data].sort((a,b)=>b.remaining-a.remaining);

  let msg = "📊 Strategy\n\n🟢 Snowball:\n";
  snowball.forEach(l => msg += `- ${l.name}\n`);

  msg += "\n🔴 Avalanche:\n";
  avalanche.forEach(l => msg += `- ${l.name}\n`);

  alert(msg);
}

// 🔄 RENDER
function render() {
  let totalPaid = 0, totalRemain = 0, months = 0;

  let container = document.getElementById("loans");
  container.innerHTML = "";

  loans.forEach((l,i)=>{
    let paidCount = l.payments.filter(p=>p.paid).length;
    let paid = paidCount * l.emi;

    totalPaid += paid;
    totalRemain += l.amount - paid;
    months += l.payments.filter(p=>!p.paid).length;

    let html = `
    <div class="loan">
      <h3>${l.name} (${l.interest}%)</h3>
      <p>₹${paid} / ₹${l.amount}</p>
    `;

    l.payments.forEach((p,j)=>{
      html += `
      <div class="emi">
        <input type="checkbox" ${p.paid?"checked":""}
        onclick="togglePayment(${i},${j})">
        ${p.date}
      </div>`;
    });

    html += "</div>";
    container.innerHTML += html;
  });

  document.getElementById("totalPaid").innerText = totalPaid;
  document.getElementById("totalRemaining").innerText = totalRemain;
  document.getElementById("monthsLeft").innerText = months;
  document.getElementById("debtFreeDate").innerText = debtFree();

  drawChart(totalPaid,totalRemain);
  drawAmort();
  checkReminders();
}
