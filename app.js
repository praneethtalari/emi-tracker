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

/* ── AUTH ── */
function login() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).then(res => {
    user = res.user;
    showUserProfile(user);
    loadData();
  });
}

function showUserProfile(u) {
  document.getElementById("userName").innerText = u.displayName;
  document.getElementById("userEmail").innerText = u.email;
  document.getElementById("userPic").src = u.photoURL;
  document.getElementById("userProfile").classList.remove("hidden");
}

function logout() {
  auth.signOut().then(() => location.reload());
}

auth.onAuthStateChanged(u => {
  if (u) { user = u; showUserProfile(u); loadData(); }
});

/* ── DATA ── */
async function loadData() {
  const doc = await db.collection("loans").doc(user.uid).get();
  loans = doc.exists ? doc.data().loans || [] : [];
  render();
}

async function save() {
  await db.collection("loans").doc(user.uid).set({ loans });
}

/* ── EMI CALC ── */
function calculateEMI(amount, interest, tenure) {
  let r = interest / 100 / 12;
  if (r === 0) return Math.round(amount / tenure);
  return Math.round(amount * r * Math.pow(1 + r, tenure) / (Math.pow(1 + r, tenure) - 1));
}

function updateEMI() {
  const amount = +document.getElementById("amount").value;
  const interest = +document.getElementById("interest").value || 0;
  const tenure = +document.getElementById("tenure").value;
  if (amount && tenure) {
    document.getElementById("emi").value = "₹" + calculateEMI(amount, interest, tenure).toLocaleString('en-IN');
  }
}

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("amount").addEventListener("input", updateEMI);
  document.getElementById("interest").addEventListener("input", updateEMI);
  document.getElementById("tenure").addEventListener("input", updateEMI);
});

/* ── ADD LOAN ── */
async function addLoan() {
  const name = document.getElementById("name").value.trim();
  const amount = +document.getElementById("amount").value;
  const interest = +document.getElementById("interest").value || 0;
  const tenure = +document.getElementById("tenure").value;
  const start = document.getElementById("start").value;

  if (!name || !amount || !start || !tenure) {
    showToast("Please fill all fields", "error");
    return;
  }

  const emi = calculateEMI(amount, interest, tenure);
  let loan = { name, amount, emi, interest, start, tenure, payments: [], schedule: [] };
  generateSchedule(loan);
  loans.push(loan);
  await save();

  // Reset form
  ["name","amount","interest","tenure","emi","start"].forEach(id => document.getElementById(id).value = "");
  showToast("Loan added successfully!", "success");
  render();
}

/* ── AMORTIZATION ── */
function generateSchedule(loan) {
  let balance = loan.amount;
  let rate = loan.interest / 100 / 12;
  let d = new Date(loan.start);
  loan.schedule = [];
  loan.payments = [];

  for (let i = 0; i < loan.tenure; i++) {
    if (balance <= 0) break;
    let interest = balance * rate;
    let principal = Math.min(balance, loan.emi - interest);
    balance -= principal;

    let nd = new Date(d);
    nd.setMonth(d.getMonth() + i);

    loan.schedule.push({
      date: nd.toISOString().split("T")[0],
      interest: Math.round(interest),
      principal: Math.round(principal),
      balance: Math.max(0, Math.round(balance))
    });

    loan.payments.push({
      paid: false,
      date: nd.toISOString().split("T")[0]
    });
  }
}

/* ── STATS ── */
function calculateLoanStats(loan) {
  let paidPrincipal = 0, paidInterest = 0, remaining = loan.amount;
  loan.schedule.forEach((m, i) => {
    if (loan.payments[i]?.paid) {
      paidPrincipal += m.principal;
      paidInterest += m.interest;
      remaining = m.balance;
    }
  });
  return { paidPrincipal, paidInterest, totalPaid: paidPrincipal + paidInterest, remaining };
}

function getDebtFreeDate() {
  let last = null;
  loans.forEach(l => {
    l.schedule.forEach((m, i) => {
      if (!l.payments[i]?.paid) last = new Date(m.date);
    });
  });
  if (!last) return "—";
  return last.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

/* ── ACTIONS ── */
function togglePayment(i, j) {
  loans[i].payments[j].paid = !loans[i].payments[j].paid;
  save();
  render();
}

async function deleteLoan(i) {
  if (!confirm("Delete this loan?")) return;
  loans.splice(i, 1);
  await save();
  render();
}

function editLoan(i) {
  let l = loans[i];
  const name = prompt("Loan Name", l.name);
  if (!name) return;
  l.name = name;
  l.amount = +prompt("Amount", l.amount) || l.amount;
  l.interest = +prompt("Interest %", l.interest) || 0;
  l.tenure = +prompt("Tenure (months)", l.tenure) || l.tenure;
  l.emi = calculateEMI(l.amount, l.interest, l.tenure);
  generateSchedule(l);
  save();
  render();
}

function toggleSchedule(id) {
  const el = document.getElementById("sch-" + id);
  el.classList.toggle("open");
}

/* ── EXPORT ── */
function exportToExcel() {
  let rows = [["Loan", "Amount", "EMI", "Paid", "Remaining", "Interest Rate", "Start"]];
  loans.forEach(l => {
    let s = calculateLoanStats(l);
    rows.push([l.name, l.amount, l.emi, s.totalPaid, s.remaining, l.interest + "%", l.start]);
  });
  let csv = rows.map(r => r.join(",")).join("\n");
  let blob = new Blob([csv], { type: "text/csv" });
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "emi-report.csv";
  a.click();
  showToast("CSV exported!", "success");
}

function generatePDF() {
  const { jsPDF } = window.jspdf;
  let doc = new jsPDF();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("EMI Tracker Report", 10, 15);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(new Date().toLocaleDateString(), 10, 22);
  let y = 34;
  loans.forEach((l, idx) => {
    let s = calculateLoanStats(l);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.setFontSize(13);
    doc.text(`${idx + 1}. ${l.name}`, 10, y); y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`Amount: ₹${l.amount.toLocaleString('en-IN')}  |  EMI: ₹${l.emi.toLocaleString('en-IN')}  |  Rate: ${l.interest}%`, 14, y); y += 6;
    doc.text(`Paid: ₹${s.totalPaid.toLocaleString('en-IN')}  |  Remaining: ₹${s.remaining.toLocaleString('en-IN')}`, 14, y); y += 10;
    if (y > 270) { doc.addPage(); y = 20; }
  });
  doc.save("emi-report.pdf");
  showToast("PDF exported!", "success");
}

/* ── TAB SWITCH ── */
function switchTab(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("nav-" + id)?.classList.add("active");
}

/* ── TOAST ── */
function showToast(msg, type = "success") {
  const t = document.createElement("div");
  t.innerText = msg;
  Object.assign(t.style, {
    position: "fixed", bottom: "100px", left: "50%", transform: "translateX(-50%)",
    background: type === "success" ? "rgba(0,245,160,0.15)" : "rgba(255,77,109,0.15)",
    border: `1px solid ${type === "success" ? "rgba(0,245,160,0.3)" : "rgba(255,77,109,0.3)"}`,
    color: type === "success" ? "#00f5a0" : "#ff4d6d",
    padding: "10px 20px", borderRadius: "12px", fontSize: "13px",
    backdropFilter: "blur(12px)", zIndex: "9999", fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: "600", letterSpacing: "0.3px", transition: "opacity 0.3s",
    whiteSpace: "nowrap"
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, 2200);
}

/* ── CHARTS ── */
const CHART_DEFAULTS = {
  color: "#00f5a0",
  color2: "#00d9f5",
  gridColor: "rgba(255,255,255,0.04)",
  textColor: "rgba(200,210,240,0.5)",
  font: "'Space Grotesk', sans-serif"
};

function drawCharts() {
  let labels = loans.map(l => l.name);
  let data = loans.map(l => calculateLoanStats(l).remaining);

  if (barChart) barChart.destroy();
  barChart = new Chart(document.getElementById("barChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Remaining ₹",
        data,
        backgroundColor: "rgba(0,245,160,0.15)",
        borderColor: "#00f5a0",
        borderWidth: 1.5,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      animation: { duration: 800 },
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: CHART_DEFAULTS.gridColor }, ticks: { color: CHART_DEFAULTS.textColor, font: { family: CHART_DEFAULTS.font, size: 11 } } },
        y: { grid: { color: CHART_DEFAULTS.gridColor }, ticks: { color: CHART_DEFAULTS.textColor, font: { family: CHART_DEFAULTS.font, size: 11 }, callback: v => "₹" + v.toLocaleString('en-IN') } }
      }
    }
  });

  if (loans.length > 0) {
    let l = loans[0];
    let balances = l.schedule.map(m => m.balance);

    if (lineChart) lineChart.destroy();
    lineChart = new Chart(document.getElementById("lineChart"), {
      type: "line",
      data: {
        labels: balances.map((_, i) => "M" + (i + 1)),
        datasets: [{
          label: l.name + " balance",
          data: balances,
          tension: 0.4,
          borderColor: "#00d9f5",
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          backgroundColor: "rgba(0,217,245,0.06)"
        }]
      },
      options: {
        responsive: true,
        animation: { duration: 1000 },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: CHART_DEFAULTS.gridColor }, ticks: { color: CHART_DEFAULTS.textColor, font: { family: CHART_DEFAULTS.font, size: 10 }, maxTicksLimit: 8 } },
          y: { grid: { color: CHART_DEFAULTS.gridColor }, ticks: { color: CHART_DEFAULTS.textColor, font: { family: CHART_DEFAULTS.font, size: 11 }, callback: v => "₹" + v.toLocaleString('en-IN') } }
        }
      }
    });
  }

  let totalPaid = 0, totalInterest = 0;
  loans.forEach(l => {
    let s = calculateLoanStats(l);
    totalPaid += s.paidPrincipal;
    totalInterest += s.paidInterest;
  });

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(document.getElementById("pieChart"), {
    type: "doughnut",
    data: {
      labels: ["Principal Paid", "Interest Paid"],
      datasets: [{
        data: [totalPaid || 1, totalInterest || 0],
        backgroundColor: ["rgba(0,245,160,0.8)", "rgba(0,217,245,0.6)"],
        borderColor: ["#00f5a0", "#00d9f5"],
        borderWidth: 1.5,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      cutout: "65%",
      animation: { duration: 900 },
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: CHART_DEFAULTS.textColor, font: { family: CHART_DEFAULTS.font, size: 11 }, padding: 20, usePointStyle: true, pointStyleWidth: 8 }
        }
      }
    }
  });
}

/* ── RENDER ── */
function buildLoanCard(l, i, compact = false) {
  let s = calculateLoanStats(l);
  let paidCount = l.payments.filter(p => p.paid).length;
  let pct = Math.round((paidCount / l.tenure) * 100);

  let scheduleRows = l.schedule.map((m, j) => `
    <div class="sch-row ${l.payments[j]?.paid ? 'paid' : ''}">
      <span>${m.date}</span>
      <span>₹${m.principal.toLocaleString('en-IN')}</span>
      <span>₹${m.interest.toLocaleString('en-IN')}</span>
      <span>₹${m.balance.toLocaleString('en-IN')}</span>
      <button class="pay-btn" onclick="togglePayment(${i},${j})">${l.payments[j]?.paid ? '✓' : '·'}</button>
    </div>
  `).join('');

  return `
  <div class="loan-card">
    <div class="loan-header">
      <div>
        <div class="loan-name">${l.name}</div>
        <span class="badge badge-green" style="margin-top:4px;">₹${l.emi.toLocaleString('en-IN')}/mo</span>
      </div>
      <div class="loan-actions">
        <button class="btn-icon" onclick="editLoan(${i})"><i data-lucide="pencil" style="width:14px;height:14px;"></i></button>
        <button class="btn-icon del" onclick="deleteLoan(${i})"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
      </div>
    </div>

    <div class="loan-stats">
      <div class="loan-stat-item">
        <div class="loan-stat-label">Paid</div>
        <div class="loan-stat-value green">₹${s.totalPaid.toLocaleString('en-IN')}</div>
      </div>
      <div class="loan-stat-item">
        <div class="loan-stat-label">Remaining</div>
        <div class="loan-stat-value red">₹${s.remaining.toLocaleString('en-IN')}</div>
      </div>
      <div class="loan-stat-item">
        <div class="loan-stat-label">Rate</div>
        <div class="loan-stat-value">${l.interest}%</div>
      </div>
      <div class="loan-stat-item">
        <div class="loan-stat-label">Progress</div>
        <div class="loan-stat-value">${paidCount}/${l.tenure} EMIs</div>
      </div>
    </div>

    <div class="progress-wrap">
      <div class="progress-label">
        <span>Payment progress</span>
        <span>${pct}%</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
    </div>

    <button class="schedule-toggle" onclick="toggleSchedule('${i}-${compact ? 'd' : 'l'}')">
      View amortization schedule ↓
    </button>
    <div class="schedule-wrap" id="sch-${i}-${compact ? 'd' : 'l'}">
      <div class="sch-row header-row">
        <span>Date</span><span>Principal</span><span>Interest</span><span>Balance</span><span></span>
      </div>
      ${scheduleRows}
    </div>
  </div>
  `;
}

function render() {
  let container = document.getElementById("loans");
  let dash = document.getElementById("loansDashboard");
  container.innerHTML = "";
  dash.innerHTML = "";

  let totalPaid = 0, totalRemaining = 0, totalEMIsLeft = 0;

  if (loans.length === 0) {
    const empty = `<div class="empty-state"><div class="empty-icon">◈</div><p>No loans yet. Add one above!</p></div>`;
    container.innerHTML = empty;
    dash.innerHTML = empty;
  } else {
    loans.forEach((l, i) => {
      let s = calculateLoanStats(l);
      totalPaid += s.totalPaid;
      totalRemaining += s.remaining;
      totalEMIsLeft += l.schedule.filter((_, j) => !l.payments[j]?.paid).length;

      dash.innerHTML += buildLoanCard(l, i, true);
      container.innerHTML += buildLoanCard(l, i, false);
    });
  }

  document.getElementById("totalPaid").innerText = totalPaid.toLocaleString('en-IN');
  document.getElementById("totalRemaining").innerText = totalRemaining.toLocaleString('en-IN');
  document.getElementById("monthsLeft").innerText = totalEMIsLeft;
  document.getElementById("debtFreeDate").innerText = getDebtFreeDate();

  drawCharts();
  lucide.createIcons();
}

/* ── NAV HIDE ON SCROLL ── */
let lastScroll = 0;
window.addEventListener("scroll", () => {
  const nav = document.querySelector(".nav");
  const cur = window.pageYOffset;
  nav.classList.toggle("hide", cur > lastScroll && cur > 60);
  lastScroll = cur;
});
