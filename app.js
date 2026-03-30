// 🔥 FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyD8qs6TDKkN3-vdV7Xa3nA0YzydHklB3gQ",
  authDomain: "emi-tracker-9081d.firebaseapp.com",
  projectId: "emi-tracker-9081d",
  storageBucket: "emi-tracker-9081d.firebasestorage.app",
  messagingSenderId: "82834596580",
  appId: "1:82834596580:web:a31a74f033a1c8f7a842f1",
  measurementId: "G-TWZBXKF6V3"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

let user = null;
let loans = [];
let chart;

// 🔐 LOGIN
function login() {
  const provider = new firebase.auth.GoogleAuthProvider();

  auth.signInWithPopup(provider).then(result => {
    if (result.user.email !== "praneethtalari1@gmail.com") {
      alert("Access Denied");
      auth.signOut();
      return;
    }

    user = result.user;
    loadData();
  });
}

// ☁️ LOAD DATA
function loadData() {
  db.collection("loans").doc(user.uid).get().then(doc => {
    if (doc.exists) {
      loans = doc.data().loans;
    }
    render();
  });
}

// ☁️ SAVE DATA
function save() {
  if (!user) return;

  db.collection("loans").doc(user.uid).set({
    loans: loans
  });
}

// 📅 GENERATE EMI DATES
function generateDates(start, tenure) {
  let dates = [];
  let d = new Date(start);

  for (let i = 0; i < tenure; i++) {
    let newDate = new Date(d);
    newDate.setMonth(d.getMonth() + i);
    dates.push(newDate.toISOString().split("T")[0]);
  }

  return dates;
}

// ➕ ADD LOAN
function addLoan() {
  const loan = {
    name: name.value,
    amount: +amount.value,
    emi: +emi.value,
    start: start.value,
    tenure: +tenure.value,
    payments: []
  };

  let dates = generateDates(loan.start, loan.tenure);

  dates.forEach(date => {
    loan.payments.push({ paid: false, date });
  });

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

// 📊 RENDER CHART
function renderChart(paid, remaining) {
  const ctx = document.getElementById("chart");

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
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

// 🔄 RENDER UI
function render() {
  let container = document.getElementById("loans");
  container.innerHTML = "";

  let totalPaid = 0;
  let totalRemaining = 0;
  let monthsLeft = 0;

  loans.forEach((loan, i) => {
    let paidCount = loan.payments.filter(p => p.paid).length;
    let paid = paidCount * loan.emi;
    let percent = (paid / loan.amount) * 100;

    totalPaid += paid;
    totalRemaining += loan.amount - paid;
    monthsLeft += loan.payments.filter(p => !p.paid).length;

    let html = `
    <div class="loan">
      <h3>${loan.name}</h3>
      <p>₹${paid} / ₹${loan.amount}</p>
      <p>${paidCount}/${loan.tenure} EMIs</p>

      <div class="progress">
        <div class="progress-bar" style="width:${percent}%"></div>
      </div>
    `;

    loan.payments.forEach((p, j) => {
      let overdue = !p.paid && new Date(p.date) < new Date();

      html += `
      <div class="emi ${overdue ? "overdue" : ""}">
        <div>
          <input type="checkbox"
            ${p.paid ? "checked" : ""}
            onclick="togglePayment(${i}, ${j})">
          ${p.date}
        </div>
        <div>${overdue ? "❌ Overdue" : "₹" + loan.emi}</div>
      </div>`;
    });

    html += `</div>`;
    container.innerHTML += html;
  });

  document.getElementById("totalPaid").innerText = totalPaid;
  document.getElementById("totalRemaining").innerText = totalRemaining;
  document.getElementById("monthsLeft").innerText = monthsLeft;

  renderChart(totalPaid, totalRemaining);
}

function checkReminders() {
  let today = new Date();
  let tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  let messages = [];

  loans.forEach(loan => {
    loan.payments.forEach(p => {
      let emiDate = new Date(p.date);

      if (!p.paid) {
        // EMI tomorrow
        if (emiDate.toDateString() === tomorrow.toDateString()) {
          messages.push(`⚠️ EMI due tomorrow (${loan.name})`);
        }

        // Overdue
        if (emiDate < today) {
          messages.push(`❌ Overdue EMI (${loan.name})`);
        }
      }
    });
  });

  if (messages.length > 0) {
    alert(messages.join("\n"));
  }
}
