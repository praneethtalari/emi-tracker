const firebaseConfig = {
  apiKey: "AIzaSyD8qs6TDKkN3-vdV7Xa3nA0YzydHklB3gQ",
  authDomain: "emi-tracker-9081d.firebaseapp.com",
  projectId: "emi-tracker-9081d"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

let loans = [];
let user;
let barChart, lineChart, pieChart;

/* ══════════════════════════════════════
   THEME
══════════════════════════════════════ */
function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  document.getElementById('themeToggleBtn').textContent = isLight ? '🌙' : '☀️';
  localStorage.setItem('emi-theme', isLight ? 'light' : 'dark');
}

// Apply saved theme as early as possible
(function applyStoredTheme() {
  if (localStorage.getItem('emi-theme') === 'light') {
    document.body.classList.add('light');
    // Icon will be set once DOM is ready
    const setIcon = () => {
      const btn = document.getElementById('themeToggleBtn');
      if (btn) btn.textContent = '🌙';
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setIcon);
    } else {
      setIcon();
    }
  }
})();

/* ══════════════════════════════════════
   AUTH
══════════════════════════════════════ */
function login() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).then(res => {
    user = res.user;
    showUserProfile(user);
    loadData();
  }).catch(err => {
    showToast('Login failed: ' + err.message, 'error');
  });
}

function showUserProfile(u) {
  document.getElementById('userName').innerText  = u.displayName;
  document.getElementById('userEmail').innerText = u.email;
  document.getElementById('userPic').src         = u.photoURL;
  document.getElementById('userProfile').classList.remove('hidden');
  document.getElementById('loginBtn').style.display = 'none';
}

function logout() {
  auth.signOut().then(() => {
    document.getElementById('userProfile').classList.add('hidden');
    document.getElementById('loginBtn').style.display = '';
    loans = [];
    render();
  });
}

auth.onAuthStateChanged(u => {
  if (u) { user = u; showUserProfile(u); loadData(); }
});

/* ══════════════════════════════════════
   DATA
══════════════════════════════════════ */
async function loadData() {
  const doc = await db.collection('loans').doc(user.uid).get();
  loans = doc.exists ? doc.data().loans || [] : [];
  render();
}

async function save() {
  await db.collection('loans').doc(user.uid).set({ loans });
}

/* ══════════════════════════════════════
   EMI CALCULATION
══════════════════════════════════════ */
function calculateEMI(amount, interest, tenure) {
  const r = interest / 100 / 12;
  if (r === 0) return Math.round(amount / tenure);
  return Math.round(amount * r * Math.pow(1+r,tenure) / (Math.pow(1+r,tenure)-1));
}

function updateEMI() {
  const amount   = +document.getElementById('amount').value;
  const interest = +document.getElementById('interest').value || 0;
  const tenure   = +document.getElementById('tenure').value;
  if (amount && tenure) {
    document.getElementById('emi').value = '₹' + calculateEMI(amount,interest,tenure).toLocaleString('en-IN');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('amount').addEventListener('input', updateEMI);
  document.getElementById('interest').addEventListener('input', updateEMI);
  document.getElementById('tenure').addEventListener('input', updateEMI);
});

/* ══════════════════════════════════════
   ADD LOAN
══════════════════════════════════════ */
async function addLoan() {
  const name     = document.getElementById('name').value.trim();
  const amount   = +document.getElementById('amount').value;
  const interest = +document.getElementById('interest').value || 0;
  const tenure   = +document.getElementById('tenure').value;
  const start    = document.getElementById('start').value;

  if (!name || !amount || !start || !tenure) {
    showToast('Please fill all fields', 'error');
    return;
  }

  const emi  = calculateEMI(amount, interest, tenure);
  const loan = { name, amount, emi, interest, start, tenure, payments:[], schedule:[] };
  generateSchedule(loan);
  loans.push(loan);
  await save();

  ['name','amount','interest','tenure','emi','start'].forEach(id => document.getElementById(id).value = '');
  showToast('Loan added successfully!', 'success');
  render();
}

/* ══════════════════════════════════════
   AMORTIZATION SCHEDULE
══════════════════════════════════════ */
function generateSchedule(loan) {
  let balance = loan.amount;
  const rate  = loan.interest / 100 / 12;
  const d     = new Date(loan.start);
  loan.schedule = [];
  loan.payments = [];

  for (let i = 0; i < loan.tenure; i++) {
    if (balance <= 0) break;
    const interest  = balance * rate;
    const principal = Math.min(balance, loan.emi - interest);
    balance -= principal;

    const nd = new Date(d);
    nd.setMonth(d.getMonth() + i);
    const dateStr = nd.toISOString().split('T')[0];

    loan.schedule.push({
      date:      dateStr,
      interest:  Math.round(interest),
      principal: Math.round(principal),
      balance:   Math.max(0, Math.round(balance))
    });
    loan.payments.push({ paid: false, date: dateStr });
  }
}

/* ══════════════════════════════════════
   STATS
══════════════════════════════════════ */
function calculateLoanStats(loan) {
  let paidPrincipal = 0, paidInterest = 0, remaining = loan.amount;
  loan.schedule.forEach((m, i) => {
    if (loan.payments[i]?.paid) {
      paidPrincipal += m.principal;
      paidInterest  += m.interest;
      remaining      = m.balance;
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
  if (!last) return '—';
  return last.toLocaleDateString('en-IN', { month:'short', year:'numeric' });
}

/* ══════════════════════════════════════
   NEXT PAYMENT DATE
══════════════════════════════════════ */
function getNextPaymentDate(loan) {
  for (let i = 0; i < loan.schedule.length; i++) {
    if (!loan.payments[i]?.paid) return loan.schedule[i].date;
  }
  return null;
}

function formatNextPayment(dateStr) {
  if (!dateStr) return { label:'Fully Paid ✓', status:'paid' };
  const today = new Date(); today.setHours(0,0,0,0);
  const due   = new Date(dateStr); due.setHours(0,0,0,0);
  const diff  = Math.round((due - today) / 86400000);
  const fmt   = due.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
  if (diff < 0)   return { label:`${fmt} (${Math.abs(diff)}d overdue)`, status:'overdue'  };
  if (diff === 0) return { label:`${fmt} (Due Today!)`,                  status:'today'    };
  if (diff <= 7)  return { label:`${fmt} (in ${diff}d)`,                 status:'soon'     };
  return               { label:`${fmt} (in ${diff}d)`,                   status:'upcoming' };
}

/* ══════════════════════════════════════
   LOAN ACTIONS
══════════════════════════════════════ */
function togglePayment(i, j) {
  loans[i].payments[j].paid = !loans[i].payments[j].paid;
  save(); render();
}

async function deleteLoan(i) {
  if (!confirm('Delete this loan?')) return;
  loans.splice(i, 1);
  await save(); render();
}

function editLoan(i) {
  const l    = loans[i];
  const name = prompt('Loan Name', l.name);
  if (!name) return;
  l.name     = name;
  l.amount   = +prompt('Amount',         l.amount)   || l.amount;
  l.interest = +prompt('Interest %',     l.interest) || 0;
  l.tenure   = +prompt('Tenure (months)',l.tenure)   || l.tenure;
  l.emi      = calculateEMI(l.amount, l.interest, l.tenure);
  generateSchedule(l);
  save(); render();
}

function toggleSchedule(id) {
  document.getElementById('sch-' + id).classList.toggle('open');
}

/* ══════════════════════════════════════
   EXPORT
══════════════════════════════════════ */
function exportToExcel() {
  const rows = [['Loan','Amount','EMI','Paid','Remaining','Interest Rate','Start']];
  loans.forEach(l => {
    const s = calculateLoanStats(l);
    rows.push([l.name, l.amount, l.emi, s.totalPaid, s.remaining, l.interest+'%', l.start]);
  });
  const csv  = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'emi-report.csv';
  a.click();
  showToast('CSV exported!', 'success');
}

function generatePDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFont('helvetica','bold'); doc.setFontSize(18);
  doc.text('EMI Tracker Report', 10, 15);
  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(120);
  doc.text(new Date().toLocaleDateString(), 10, 22);
  let y = 34;
  loans.forEach((l, idx) => {
    const s = calculateLoanStats(l);
    doc.setFont('helvetica','bold'); doc.setTextColor(0); doc.setFontSize(13);
    doc.text(`${idx+1}. ${l.name}`, 10, y); y += 7;
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(80);
    doc.text(`Amount: ₹${l.amount.toLocaleString('en-IN')}  |  EMI: ₹${l.emi.toLocaleString('en-IN')}  |  Rate: ${l.interest}%`, 14, y); y += 6;
    doc.text(`Paid: ₹${s.totalPaid.toLocaleString('en-IN')}  |  Remaining: ₹${s.remaining.toLocaleString('en-IN')}`, 14, y); y += 10;
    if (y > 270) { doc.addPage(); y = 20; }
  });
  doc.save('emi-report.pdf');
  showToast('PDF exported!', 'success');
}

/* ══════════════════════════════════════
   NAVIGATION
══════════════════════════════════════ */
function switchTab(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('nav-' + id)?.classList.add('active');
}

/* ══════════════════════════════════════
   TOAST
══════════════════════════════════════ */
function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.innerText = msg;
  const isOk = type === 'success';
  Object.assign(t.style, {
    position:'fixed', bottom:'100px', left:'50%', transform:'translateX(-50%)',
    background: isOk ? 'rgba(0,245,160,0.15)' : 'rgba(255,77,109,0.15)',
    border:`1px solid ${isOk ? 'rgba(0,245,160,0.3)' : 'rgba(255,77,109,0.3)'}`,
    color: isOk ? '#00f5a0' : '#ff4d6d',
    padding:'10px 20px', borderRadius:'12px', fontSize:'13px',
    backdropFilter:'blur(12px)', zIndex:'9999',
    fontFamily:"'Space Grotesk',sans-serif", fontWeight:'600',
    letterSpacing:'0.3px', whiteSpace:'nowrap', transition:'opacity 0.3s'
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2200);
}

/* ══════════════════════════════════════
   CHARTS
══════════════════════════════════════ */
const CD = {
  gridColor: 'rgba(255,255,255,0.04)',
  textColor: 'rgba(200,210,240,0.5)',
  font:      "'Space Grotesk',sans-serif"
};

function drawCharts() {
  const labels = loans.map(l => l.name);
  const data   = loans.map(l => calculateLoanStats(l).remaining);

  if (barChart) barChart.destroy();
  barChart = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: { labels, datasets:[{ label:'Remaining ₹', data, backgroundColor:'rgba(0,245,160,0.15)', borderColor:'#00f5a0', borderWidth:1.5, borderRadius:8, borderSkipped:false }] },
    options: { responsive:true, animation:{duration:800}, plugins:{legend:{display:false}},
      scales:{
        x:{ grid:{color:CD.gridColor}, ticks:{color:CD.textColor,font:{family:CD.font,size:11}} },
        y:{ grid:{color:CD.gridColor}, ticks:{color:CD.textColor,font:{family:CD.font,size:11},callback:v=>'₹'+v.toLocaleString('en-IN')} }
      }
    }
  });

  if (loans.length > 0) {
    const l = loans[0];
    const balances = l.schedule.map(m => m.balance);
    if (lineChart) lineChart.destroy();
    lineChart = new Chart(document.getElementById('lineChart'), {
      type: 'line',
      data: { labels:balances.map((_,i)=>'M'+(i+1)), datasets:[{ label:l.name+' balance', data:balances, tension:0.4, borderColor:'#00d9f5', borderWidth:2, pointRadius:0, fill:true, backgroundColor:'rgba(0,217,245,0.06)' }] },
      options: { responsive:true, animation:{duration:1000}, plugins:{legend:{display:false}},
        scales:{
          x:{ grid:{color:CD.gridColor}, ticks:{color:CD.textColor,font:{family:CD.font,size:10},maxTicksLimit:8} },
          y:{ grid:{color:CD.gridColor}, ticks:{color:CD.textColor,font:{family:CD.font,size:11},callback:v=>'₹'+v.toLocaleString('en-IN')} }
        }
      }
    });
  }

  let totalPrincipal = 0, totalInterest = 0;
  loans.forEach(l => { const s=calculateLoanStats(l); totalPrincipal+=s.paidPrincipal; totalInterest+=s.paidInterest; });

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(document.getElementById('pieChart'), {
    type: 'doughnut',
    data: { labels:['Principal Paid','Interest Paid'], datasets:[{ data:[totalPrincipal||1,totalInterest||0], backgroundColor:['rgba(0,245,160,0.8)','rgba(0,217,245,0.6)'], borderColor:['#00f5a0','#00d9f5'], borderWidth:1.5, hoverOffset:6 }] },
    options: { responsive:true, cutout:'65%', animation:{duration:900},
      plugins:{ legend:{ position:'bottom', labels:{color:CD.textColor,font:{family:CD.font,size:11},padding:20,usePointStyle:true,pointStyleWidth:8} } }
    }
  });
}

/* ══════════════════════════════════════
   BUILD LOAN CARD
══════════════════════════════════════ */
function buildLoanCard(l, i, compact = false) {
  const s         = calculateLoanStats(l);
  const paidCount = l.payments.filter(p => p.paid).length;
  const pct       = Math.round((paidCount / l.tenure) * 100);

  const nextDateStr = getNextPaymentDate(l);
  const next        = formatNextPayment(nextDateStr);
  const ncMap = {
    overdue:  { bg:'rgba(255,77,109,0.12)',  border:'rgba(255,77,109,0.28)',  color:'#ff4d6d', icon:'⚠️' },
    today:    { bg:'rgba(255,214,10,0.12)',  border:'rgba(255,214,10,0.28)',  color:'#ffd60a', icon:'🔔' },
    soon:     { bg:'rgba(255,170,0,0.10)',   border:'rgba(255,170,0,0.25)',   color:'#ffaa00', icon:'⏰' },
    upcoming: { bg:'rgba(0,245,160,0.07)',   border:'rgba(0,245,160,0.20)',   color:'var(--accent)', icon:'📅' },
    paid:     { bg:'rgba(0,245,160,0.07)',   border:'rgba(0,245,160,0.20)',   color:'var(--accent)', icon:'✅' },
  };
  const nc = ncMap[next.status];

  const scheduleRows = l.schedule.map((m, j) => `
    <div class="sch-row ${l.payments[j]?.paid ? 'paid' : ''}">
      <span>${m.date}</span>
      <span>₹${m.principal.toLocaleString('en-IN')}</span>
      <span>₹${m.interest.toLocaleString('en-IN')}</span>
      <span>₹${m.balance.toLocaleString('en-IN')}</span>
      <button class="pay-btn" onclick="togglePayment(${i},${j})">${l.payments[j]?.paid ? '✓' : '·'}</button>
    </div>`).join('');

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

    <div style="margin-top:12px;padding:10px 14px;border-radius:12px;background:${nc.bg};border:1px solid ${nc.border};display:flex;align-items:center;gap:10px;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${nc.color};opacity:0.8;margin-bottom:3px;">Next Payment</div>
        <div style="font-size:13px;font-weight:700;font-family:'DM Mono',monospace;color:${nc.color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${next.label}</div>
      </div>
      <span style="font-size:18px;">${nc.icon}</span>
    </div>

    <div class="progress-wrap">
      <div class="progress-label"><span>Payment progress</span><span>${pct}%</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
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
  </div>`;
}

/* ══════════════════════════════════════
   RENDER
══════════════════════════════════════ */
function render() {
  const container = document.getElementById('loans');
  const dash      = document.getElementById('loansDashboard');
  container.innerHTML = '';
  dash.innerHTML      = '';

  let totalPaid = 0, totalRemaining = 0, totalEMIsLeft = 0;

  if (loans.length === 0) {
    const empty = `<div class="empty-state"><div class="empty-icon">◈</div><p>No loans yet. Add one above!</p></div>`;
    container.innerHTML = empty;
    dash.innerHTML      = empty;
  } else {
    loans.forEach((l, i) => {
      const s = calculateLoanStats(l);
      totalPaid      += s.totalPaid;
      totalRemaining += s.remaining;
      totalEMIsLeft  += l.schedule.filter((_,j) => !l.payments[j]?.paid).length;
      dash.innerHTML      += buildLoanCard(l, i, true);
      container.innerHTML += buildLoanCard(l, i, false);
    });
  }

  const totalMonthlyEMI = loans.reduce((sum, l) => {
    return sum + (l.payments.some(p => !p.paid) ? l.emi : 0);
  }, 0);

  document.getElementById('totalPaid').innerText       = totalPaid.toLocaleString('en-IN');
  document.getElementById('totalRemaining').innerText  = totalRemaining.toLocaleString('en-IN');
  document.getElementById('monthsLeft').innerText      = totalEMIsLeft;
  document.getElementById('debtFreeDate').innerText    = getDebtFreeDate();
  document.getElementById('totalMonthlyEMI').innerText = totalMonthlyEMI.toLocaleString('en-IN');

  drawCharts();
  lucide.createIcons();
}

/* ══════════════════════════════════════
   NAV AUTO-HIDE ON SCROLL
══════════════════════════════════════ */
let lastScroll = 0;
window.addEventListener('scroll', () => {
  const nav = document.querySelector('.nav');
  const cur = window.pageYOffset;
  nav.classList.toggle('hide', cur > lastScroll && cur > 60);
  lastScroll = cur;
});
