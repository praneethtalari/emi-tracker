/* ═══════════════════════════════════════
   FIREBASE INIT
═══════════════════════════════════════ */
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
let barChart, lineChart, pieChart, radarChart;

/* ═══════════════════════════════════════
   PARTICLES
═══════════════════════════════════════ */
function initParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 3 + 1;
    const colors = ['#00f5a0','#00d9f5','#a855f7','#ff9f43'];
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random()*100}%;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      animation-duration:${Math.random()*20+15}s;
      animation-delay:${Math.random()*15}s;
    `;
    container.appendChild(p);
  }
}

/* ═══════════════════════════════════════
   3D TILT EFFECT
═══════════════════════════════════════ */
function initTilt() {
  document.querySelectorAll('[data-tilt]').forEach(el => {
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width  - 0.5;
      const y = (e.clientY - r.top)  / r.height - 0.5;
      el.style.transform = `perspective(600px) rotateX(${-y*8}deg) rotateY(${x*8}deg) translateY(-4px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  });
}

/* ═══════════════════════════════════════
   THEME
═══════════════════════════════════════ */
function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  document.getElementById('themeToggleBtn').textContent = isLight ? '🌙' : '☀️';
  localStorage.setItem('emi-theme', isLight ? 'light' : 'dark');
  // re-draw charts with correct colors
  drawCharts();
}

(function applyStoredTheme() {
  if (localStorage.getItem('emi-theme') === 'light') {
    document.body.classList.add('light');
    const setIcon = () => {
      const btn = document.getElementById('themeToggleBtn');
      if (btn) btn.textContent = '🌙';
    };
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', setIcon)
      : setIcon();
  }
})();

/* ═══════════════════════════════════════
   AUTH
═══════════════════════════════════════ */
function login() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).then(res => {
    user = res.user;
    showUserProfile(user);
    loadData();
  }).catch(err => showToast('Login failed: ' + err.message, 'error'));
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
    loans = []; render();
  });
}

auth.onAuthStateChanged(u => {
  if (u) { user = u; showUserProfile(u); loadData(); }
});

/* ═══════════════════════════════════════
   DATA
═══════════════════════════════════════ */
async function loadData() {
  const doc = await db.collection('loans').doc(user.uid).get();
  loans = doc.exists ? doc.data().loans || [] : [];
  render();
}

async function save() {
  await db.collection('loans').doc(user.uid).set({ loans });
}

/* ═══════════════════════════════════════
   EMI CALCULATION
═══════════════════════════════════════ */
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
  ['amount','interest','tenure'].forEach(id =>
    document.getElementById(id)?.addEventListener('input', updateEMI)
  );
  initParticles();
  setTimeout(initTilt, 500);
});

/* ═══════════════════════════════════════
   ADD LOAN
═══════════════════════════════════════ */
async function addLoan() {
  const name     = document.getElementById('name').value.trim();
  const amount   = +document.getElementById('amount').value;
  const interest = +document.getElementById('interest').value || 0;
  const tenure   = +document.getElementById('tenure').value;
  const start    = document.getElementById('start').value;

  if (!name || !amount || !start || !tenure) {
    showToast('Please fill all fields', 'error'); return;
  }

  const emi  = calculateEMI(amount, interest, tenure);
  const loan = { name, amount, emi, interest, start, tenure, payments:[], schedule:[] };
  generateSchedule(loan);
  loans.push(loan);
  await save();
  ['name','amount','interest','tenure','emi','start'].forEach(id => document.getElementById(id).value = '');
  showToast('✓ Loan added successfully!', 'success');
  render();
}

/* ═══════════════════════════════════════
   AMORTIZATION SCHEDULE
═══════════════════════════════════════ */
function generateSchedule(loan) {
  let balance = loan.amount;
  const rate  = loan.interest / 100 / 12;
  const d     = new Date(loan.start);
  loan.schedule = []; loan.payments = [];

  for (let i = 0; i < loan.tenure; i++) {
    if (balance <= 0) break;
    const interest  = balance * rate;
    const principal = Math.min(balance, loan.emi - interest);
    balance -= principal;
    const nd = new Date(d); nd.setMonth(d.getMonth() + i);
    const dateStr = nd.toISOString().split('T')[0];
    loan.schedule.push({ date:dateStr, interest:Math.round(interest), principal:Math.round(principal), balance:Math.max(0,Math.round(balance)) });
    loan.payments.push({ paid:false, date:dateStr });
  }
}

/* ═══════════════════════════════════════
   STATS
═══════════════════════════════════════ */
function calculateLoanStats(loan) {
  let paidPrincipal=0, paidInterest=0, remaining=loan.amount;
  loan.schedule.forEach((m,i) => {
    if (loan.payments[i]?.paid) { paidPrincipal+=m.principal; paidInterest+=m.interest; remaining=m.balance; }
  });
  return { paidPrincipal, paidInterest, totalPaid:paidPrincipal+paidInterest, remaining };
}

function getLoanEndDate(loan) {
  if (!loan.schedule.length) return '—';
  const last = loan.schedule[loan.schedule.length-1];
  return new Date(last.date).toLocaleDateString('en-IN',{month:'short',year:'numeric'});
}

function getDebtFreeDate() {
  let last = null;
  loans.forEach(l => l.schedule.forEach((m,i) => { if (!l.payments[i]?.paid) last=new Date(m.date); }));
  return last ? last.toLocaleDateString('en-IN',{month:'short',year:'numeric'}) : '—';
}

/* ═══════════════════════════════════════
   NEXT PAYMENT
═══════════════════════════════════════ */
function getNextPaymentDate(loan) {
  for (let i=0; i<loan.schedule.length; i++) if (!loan.payments[i]?.paid) return loan.schedule[i].date;
  return null;
}

function formatNextPayment(dateStr) {
  if (!dateStr) return { label:'Fully Paid ✓', end:'', status:'paid' };
  const today=new Date(); today.setHours(0,0,0,0);
  const due=new Date(dateStr); due.setHours(0,0,0,0);
  const diff=Math.round((due-today)/86400000);
  const fmt=due.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
  if (diff<0)   return { label:fmt, end:`${Math.abs(diff)}d overdue`, status:'overdue' };
  if (diff===0) return { label:fmt, end:'Due Today!',                  status:'today'   };
  if (diff<=7)  return { label:fmt, end:`in ${diff} days`,             status:'soon'    };
  return               { label:fmt, end:`in ${diff} days`,             status:'upcoming'};
}

/* ═══════════════════════════════════════
   LOAN ACTIONS
═══════════════════════════════════════ */
function togglePayment(i, j) {
  loans[i].payments[j].paid = !loans[i].payments[j].paid;
  save(); render();
}

async function deleteLoan(i) {
  if (!confirm('Delete this loan?')) return;
  loans.splice(i,1); await save(); render();
}

function editLoan(i) {
  const l=loans[i];
  const name=prompt('Loan Name',l.name); if (!name) return;
  l.name=name;
  l.amount  = +prompt('Amount',l.amount)           || l.amount;
  l.interest= +prompt('Interest %',l.interest)     || 0;
  l.tenure  = +prompt('Tenure (months)',l.tenure)  || l.tenure;
  l.emi=calculateEMI(l.amount,l.interest,l.tenure);
  generateSchedule(l);
  save(); render();
}

function toggleSchedule(id) {
  document.getElementById('sch-'+id)?.classList.toggle('open');
}

/* ═══════════════════════════════════════
   EXPORT
═══════════════════════════════════════ */
function exportToExcel() {
  const rows=[['Loan','Amount','EMI','Paid','Remaining','Interest%','Start','End Date']];
  loans.forEach(l => {
    const s=calculateLoanStats(l);
    rows.push([l.name,l.amount,l.emi,s.totalPaid,s.remaining,l.interest+'%',l.start,getLoanEndDate(l)]);
  });
  const csv=rows.map(r=>r.join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download='emi-report.csv'; a.click();
  showToast('✓ CSV exported!','success');
}

function generatePDF() {
  const {jsPDF}=window.jspdf, doc=new jsPDF();
  doc.setFillColor(5,12,26); doc.rect(0,0,210,297,'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(20); doc.setTextColor(0,245,160);
  doc.text('EMI Tracker Pro — Report',10,18);
  doc.setFontSize(10); doc.setTextColor(150,170,200);
  doc.text('Generated: '+new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'}),10,26);
  let y=38;
  loans.forEach((l,idx) => {
    const s=calculateLoanStats(l);
    doc.setFillColor(20,30,50); doc.roundedRect(8,y-5,194,38,4,4,'F');
    doc.setFont('helvetica','bold'); doc.setTextColor(0,245,160); doc.setFontSize(13);
    doc.text(`${idx+1}. ${l.name}`,12,y+4); y+=10;
    doc.setFont('helvetica','normal'); doc.setTextColor(180,200,230); doc.setFontSize(9);
    doc.text(`Amount: ₹${l.amount.toLocaleString('en-IN')}  |  EMI: ₹${l.emi.toLocaleString('en-IN')}  |  Rate: ${l.interest}%  |  End: ${getLoanEndDate(l)}`,12,y+4); y+=8;
    doc.text(`Paid: ₹${s.totalPaid.toLocaleString('en-IN')}  |  Remaining: ₹${s.remaining.toLocaleString('en-IN')}`,12,y+4); y+=16;
    if (y>260) { doc.addPage(); doc.setFillColor(5,12,26); doc.rect(0,0,210,297,'F'); y=20; }
  });
  doc.save('emi-tracker-pro-report.pdf');
  showToast('✓ PDF exported!','success');
}

/* ═══════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════ */
function switchTab(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('nav-'+id)?.classList.add('active');
  if (id==='chartsScreen') setTimeout(drawCharts,100);
  setTimeout(initTilt,300);
}

/* ═══════════════════════════════════════
   TOAST
═══════════════════════════════════════ */
function showToast(msg, type='success') {
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  const t=document.createElement('div');
  t.className=`toast ${type}`; t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity 0.3s'; setTimeout(()=>t.remove(),300); },2500);
}

/* ═══════════════════════════════════════
   CHARTS
═══════════════════════════════════════ */
function getChartColors() {
  const isLight = document.body.classList.contains('light');
  return {
    grid:  isLight ? 'rgba(0,0,0,0.06)'      : 'rgba(255,255,255,0.04)',
    text:  isLight ? 'rgba(13,27,62,0.5)'    : 'rgba(200,220,255,0.5)',
    bg:    isLight ? 'rgba(255,255,255,0.8)' : 'rgba(5,12,26,0.0)',
  };
}

function drawCharts() {
  if (!loans.length) return;
  const C = getChartColors();
  const font = "'Space Grotesk',sans-serif";

  const baseOpts = {
    responsive:true, animation:{duration:900,easing:'easeOutQuart'},
    plugins:{ legend:{ labels:{ color:C.text, font:{family:font,size:11}, padding:16, usePointStyle:true, pointStyleWidth:8 } } },
  };
  const scaleOpts = {
    x:{ grid:{color:C.grid,drawBorder:false}, ticks:{color:C.text,font:{family:font,size:11}} },
    y:{ grid:{color:C.grid,drawBorder:false}, ticks:{color:C.text,font:{family:font,size:11},callback:v=>'₹'+v.toLocaleString('en-IN')}, border:{dash:[4,4]} }
  };

  const labels = loans.map(l=>l.name);
  const remaining = loans.map(l=>calculateLoanStats(l).remaining);
  const paid      = loans.map(l=>calculateLoanStats(l).totalPaid);

  /* BAR CHART */
  if (barChart) barChart.destroy();
  barChart = new Chart(document.getElementById('barChart'), {
    type:'bar',
    data:{
      labels,
      datasets:[
        { label:'Remaining', data:remaining,
          backgroundColor:'rgba(0,217,245,0.2)', borderColor:'#00d9f5', borderWidth:2,
          borderRadius:8, borderSkipped:false },
        { label:'Paid', data:paid,
          backgroundColor:'rgba(0,245,160,0.2)', borderColor:'#00f5a0', borderWidth:2,
          borderRadius:8, borderSkipped:false }
      ]
    },
    options:{...baseOpts,
      plugins:{...baseOpts.plugins,
        tooltip:{ backgroundColor:'rgba(5,12,26,0.9)', titleColor:'#e8f0fe', bodyColor:'#a0b0d0', padding:12, cornerRadius:10, titleFont:{family:font,weight:'bold'}, callbacks:{label:ctx=>' ₹'+ctx.raw.toLocaleString('en-IN')} }
      },
      scales:scaleOpts
    }
  });

  /* LINE CHART */
  if (lineChart) lineChart.destroy();
  const lineDatasets = loans.map((l,i)=>{
    const colors = ['#00f5a0','#00d9f5','#a855f7','#ff9f43','#ff4d6d','#ffd60a'];
    const c = colors[i % colors.length];
    return {
      label:l.name,
      data:l.schedule.map(m=>m.balance),
      tension:0.4, borderColor:c, borderWidth:2.5, pointRadius:0,
      fill:true, backgroundColor:c.replace('#','rgba(').replace(')',',0.06)')+'',
    };
  });
  // patch fill backgrounds
  loans.forEach((l,i)=>{
    const fills=['rgba(0,245,160,0.06)','rgba(0,217,245,0.06)','rgba(168,85,247,0.06)','rgba(255,159,67,0.06)'];
    lineDatasets[i].backgroundColor = fills[i % fills.length];
  });

  lineChart = new Chart(document.getElementById('lineChart'), {
    type:'line',
    data:{ labels:loans[0].schedule.map((_,i)=>'M'+(i+1)), datasets:lineDatasets },
    options:{...baseOpts,
      plugins:{...baseOpts.plugins,
        tooltip:{ mode:'index', intersect:false, backgroundColor:'rgba(5,12,26,0.9)', titleColor:'#e8f0fe', bodyColor:'#a0b0d0', padding:12, cornerRadius:10, titleFont:{family:font,weight:'bold'}, callbacks:{label:ctx=>` ${ctx.dataset.label}: ₹${ctx.raw.toLocaleString('en-IN')}`} }
      },
      interaction:{mode:'index',intersect:false},
      scales:{
        x:{ ...scaleOpts.x, ticks:{...scaleOpts.x.ticks,maxTicksLimit:10} },
        y:scaleOpts.y
      }
    }
  });

  /* DONUT CHART */
  let totalPrincipal=0, totalInterest=0;
  loans.forEach(l=>{const s=calculateLoanStats(l); totalPrincipal+=s.paidPrincipal; totalInterest+=s.paidInterest;});

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(document.getElementById('pieChart'), {
    type:'doughnut',
    data:{
      labels:['Principal Paid','Interest Paid','Remaining'],
      datasets:[{
        data:[totalPrincipal||0, totalInterest||0, remaining.reduce((a,b)=>a+b,0)||1],
        backgroundColor:['rgba(0,245,160,0.85)','rgba(0,217,245,0.85)','rgba(124,58,237,0.7)'],
        borderColor:['#00f5a0','#00d9f5','#7c3aed'],
        borderWidth:2, hoverOffset:8, hoverBorderWidth:3,
      }]
    },
    options:{...baseOpts, cutout:'68%',
      plugins:{...baseOpts.plugins,
        tooltip:{ backgroundColor:'rgba(5,12,26,0.9)', titleColor:'#e8f0fe', bodyColor:'#a0b0d0', padding:12, cornerRadius:10, callbacks:{label:ctx=>` ${ctx.label}: ₹${ctx.raw.toLocaleString('en-IN')}`} }
      }
    }
  });

  /* RADAR CHART */
  if (radarChart) radarChart.destroy();
  const radarData = loans.map(l=>l.emi);
  const rColors   = ['rgba(0,245,160,0.7)','rgba(0,217,245,0.7)','rgba(168,85,247,0.7)','rgba(255,159,67,0.7)'];

  radarChart = new Chart(document.getElementById('radarChart'), {
    type:'radar',
    data:{
      labels:loans.map(l=>l.name.length>10?l.name.slice(0,9)+'…':l.name),
      datasets:[{
        label:'Monthly EMI ₹',
        data:radarData,
        backgroundColor:'rgba(0,245,160,0.12)',
        borderColor:'#00f5a0', borderWidth:2,
        pointBackgroundColor:'#00f5a0', pointBorderColor:'#050c1a', pointRadius:5,
      }]
    },
    options:{...baseOpts,
      scales:{
        r:{
          grid:{color:C.grid}, angleLines:{color:C.grid},
          ticks:{color:C.text, font:{family:font,size:10}, backdropColor:'transparent', callback:v=>'₹'+v.toLocaleString('en-IN')},
          pointLabels:{color:C.text, font:{family:font,size:11}},
        }
      }
    }
  });

  /* Update analytics summary */
  const totalBorrowed = loans.reduce((a,l)=>a+l.amount,0);
  const totalInt = loans.reduce((a,l)=>{
    const s=calculateLoanStats(l); return a+s.paidInterest;
  },0);
  document.getElementById('csTotalBorrowed').textContent = '₹'+totalBorrowed.toLocaleString('en-IN');
  document.getElementById('csTotalInterest').textContent = '₹'+totalInt.toLocaleString('en-IN');
  document.getElementById('csLoansCount').textContent    = loans.length;
}

/* ═══════════════════════════════════════
   BUILD LOAN CARD
═══════════════════════════════════════ */
function buildLoanCard(l, i, compact=false) {
  const s         = calculateLoanStats(l);
  const paidCount = l.payments.filter(p=>p.paid).length;
  const pct       = Math.round((paidCount/l.tenure)*100);
  const endDate   = getLoanEndDate(l);

  const nextStr = getNextPaymentDate(l);
  const next    = formatNextPayment(nextStr);

  const ncMap = {
    overdue:  {bg:'rgba(255,77,109,0.12)', border:'rgba(255,77,109,0.28)', color:'#ff4d6d', icon:'⚠️'},
    today:    {bg:'rgba(255,214,10,0.12)', border:'rgba(255,214,10,0.28)', color:'#ffd60a', icon:'🔔'},
    soon:     {bg:'rgba(255,170,0,0.10)',  border:'rgba(255,170,0,0.25)',  color:'#ffaa00', icon:'⏰'},
    upcoming: {bg:'rgba(0,245,160,0.07)',  border:'rgba(0,245,160,0.20)',  color:'var(--accent)', icon:'📅'},
    paid:     {bg:'rgba(0,245,160,0.07)',  border:'rgba(0,245,160,0.20)',  color:'var(--accent)', icon:'✅'},
  };
  const nc = ncMap[next.status];

  const schedRows = l.schedule.map((m,j) => `
    <div class="sch-row ${l.payments[j]?.paid?'paid':''}">
      <span>${m.date}</span>
      <span>₹${m.principal.toLocaleString('en-IN')}</span>
      <span>₹${m.interest.toLocaleString('en-IN')}</span>
      <span>₹${m.balance.toLocaleString('en-IN')}</span>
      <span style="color:var(--text-2);font-size:10px;">${m.date.slice(0,7)}</span>
      <button class="pay-btn" onclick="togglePayment(${i},${j})">${l.payments[j]?.paid?'✓':'·'}</button>
    </div>`).join('');

  const uid = `${i}-${compact?'d':'l'}`;
  return `
  <div class="loan-card" style="animation-delay:${i*0.07}s">
    <div class="loan-card-accent"></div>

    <div class="loan-top">
      <div class="loan-name-wrap">
        <div class="loan-name">${l.name}</div>
        <span class="loan-emi-badge">
          <i data-lucide="refresh-cw" style="width:11px;height:11px;"></i>
          ₹${l.emi.toLocaleString('en-IN')}/mo
        </span>
      </div>
      <div class="loan-actions">
        <button onclick="editLoan(${i})" title="Edit"><i data-lucide="pencil"></i></button>
        <button class="del-btn" onclick="deleteLoan(${i})" title="Delete"><i data-lucide="trash-2"></i></button>
      </div>
    </div>

    <div class="loan-stats">
      <div class="lst">
        <div class="lst-label">Paid</div>
        <div class="lst-val g">₹${s.totalPaid.toLocaleString('en-IN')}</div>
      </div>
      <div class="lst">
        <div class="lst-label">Remaining</div>
        <div class="lst-val r">₹${s.remaining.toLocaleString('en-IN')}</div>
      </div>
      <div class="lst">
        <div class="lst-label">Rate</div>
        <div class="lst-val">${l.interest}%</div>
      </div>
      <div class="lst">
        <div class="lst-label">End Date</div>
        <div class="lst-val" style="font-size:11px;">${endDate}</div>
      </div>
    </div>

    <div class="next-pay" style="background:${nc.bg};border:1px solid ${nc.border};">
      <div class="next-pay-left">
        <div class="next-pay-tag" style="color:${nc.color};">Next Payment</div>
        <div class="next-pay-date" style="color:${nc.color};">${next.label}</div>
        ${next.end ? `<div class="next-pay-end" style="color:${nc.color};">${next.end}</div>` : ''}
      </div>
      <div class="next-pay-icon">${nc.icon}</div>
    </div>

    <div class="loan-prog-wrap">
      <div class="loan-prog-top">
        <span class="loan-prog-label">${paidCount} of ${l.tenure} EMIs paid</span>
        <span class="loan-prog-pct">${pct}%</span>
      </div>
      <div class="prog-track"><div class="prog-fill" style="width:${pct}%"></div></div>
    </div>

    <button class="sch-toggle" onclick="toggleSchedule('${uid}')">
      <i data-lucide="list" style="width:13px;height:13px;"></i>
      Amortization Schedule
    </button>
    <div class="sch-wrap" id="sch-${uid}">
      <div class="sch-row hr">
        <span>Date</span><span>Principal</span><span>Interest</span><span>Balance</span><span>Month</span><span></span>
      </div>
      ${schedRows}
    </div>
  </div>`;
}

/* ═══════════════════════════════════════
   RING ANIMATION
═══════════════════════════════════════ */
function animateRing(pct) {
  const ring = document.getElementById('heroRing');
  const label = document.getElementById('ringPct');
  if (!ring || !label) return;
  const circumference = 239;
  const offset = circumference - (pct / 100) * circumference;
  ring.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)';
  ring.style.strokeDashoffset = offset;
  let cur = 0;
  const target = Math.round(pct);
  const step = () => {
    if (cur < target) { cur++; label.textContent = cur + '%'; requestAnimationFrame(step); }
    else label.textContent = target + '%';
  };
  requestAnimationFrame(step);
}

/* ═══════════════════════════════════════
   RENDER
═══════════════════════════════════════ */
function render() {
  const container = document.getElementById('loans');
  const dash      = document.getElementById('loansDashboard');
  container.innerHTML = ''; dash.innerHTML = '';

  let totalPaid=0, totalRemaining=0, totalEMIsLeft=0;

  if (loans.length === 0) {
    const empty = `
      <div class="empty-state">
        <span class="empty-icon">◈</span>
        <h3>No Loans Yet</h3>
        <p>Add your first loan above to start tracking</p>
      </div>`;
    container.innerHTML = empty; dash.innerHTML = empty;
  } else {
    loans.forEach((l,i) => {
      const s = calculateLoanStats(l);
      totalPaid      += s.totalPaid;
      totalRemaining += s.remaining;
      totalEMIsLeft  += l.schedule.filter((_,j) => !l.payments[j]?.paid).length;
      const card = buildLoanCard(l,i,false);
      dash.innerHTML      += buildLoanCard(l,i,true);
      container.innerHTML += card;
    });
  }

  const totalMonthlyEMI = loans.reduce((sum,l) => sum + (l.payments.some(p=>!p.paid) ? l.emi : 0), 0);
  const totalBorrowed   = loans.reduce((sum,l) => sum + l.amount, 0);
  const paidPct = totalBorrowed > 0 ? (totalPaid / totalBorrowed) * 100 : 0;

  document.getElementById('totalPaid').textContent       = '₹'+totalPaid.toLocaleString('en-IN');
  document.getElementById('totalRemaining').textContent  = '₹'+totalRemaining.toLocaleString('en-IN');
  document.getElementById('monthsLeft').textContent      = totalEMIsLeft;
  document.getElementById('debtFreeDate').textContent    = getDebtFreeDate();
  document.getElementById('totalMonthlyEMI').textContent = totalMonthlyEMI.toLocaleString('en-IN');

  animateRing(paidPct);
  drawCharts();
  lucide.createIcons();
  setTimeout(initTilt, 200);
}

/* ═══════════════════════════════════════
   NAV HIDE ON SCROLL
═══════════════════════════════════════ */
let lastScroll = 0;
window.addEventListener('scroll', () => {
  const nav = document.querySelector('.nav');
  const cur = window.pageYOffset;
  nav.classList.toggle('hide', cur > lastScroll && cur > 80);
  lastScroll = cur;
}, { passive:true });
