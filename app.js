let loans = JSON.parse(localStorage.getItem("loans")) || [];
let chart;

function save() {
  localStorage.setItem("loans", JSON.stringify(loans));
}

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

function togglePayment(i, j) {
  loans[i].payments[j].paid = !loans[i].payments[j].paid;
  save();
  render();
}

function calculateMonthsLeft() {
  let remaining = 0;
  loans.forEach(loan => {
    remaining += loan.payments.filter(p => !p.paid).length;
  });
  return remaining;
}

function renderChart(totalPaid, totalRemaining) {
  const ctx = document.getElementById("overallChart");

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Paid', 'Remaining'],
      datasets: [{
        data: [totalPaid, totalRemaining],
        backgroundColor: ['#22c55e', '#ef4444']
      }]
    }
  });
}

function render() {
  let container = document.getElementById("loans");
  container.innerHTML = "";

  let totalPaid = 0;
  let totalRemaining = 0;

  loans.forEach((loan, i) => {
    let paid = loan.payments.filter(p => p.paid).length * loan.emi;
    let percent = (paid / loan.amount) * 100;

    totalPaid += paid;
    totalRemaining += loan.amount - paid;

    let html = `
    <div class="loan">
      <h3>${loan.name}</h3>
      <p>₹${paid} / ₹${loan.amount}</p>
      <p>${loan.payments.filter(p=>p.paid).length}/${loan.tenure} EMIs paid</p>

      <div class="progress">
        <div class="progress-bar" style="width:${percent}%"></div>
      </div>
    `;

    loan.payments.forEach((p, j) => {
      let overdue = !p.paid && new Date(p.date) < new Date();

      html += `
      <div class="emi ${overdue ? 'overdue' : ''}">
        <div>
          <input type="checkbox"
            ${p.paid ? "checked" : ""}
            onclick="togglePayment(${i}, ${j})">
          ${p.date}
        </div>
        <div>${overdue ? "❌ Overdue" : "₹"+loan.emi}</div>
      </div>`;
    });

    html += `</div>`;
    container.innerHTML += html;
  });

  document.getElementById("totalPaid").innerText = totalPaid;
  document.getElementById("totalRemaining").innerText = totalRemaining;

  let monthsLeft = calculateMonthsLeft();
  document.getElementById("monthsLeft").innerText = monthsLeft;

  renderChart(totalPaid, totalRemaining);
}

render();
