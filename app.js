let loans = JSON.parse(localStorage.getItem("loans")) || [];

function save() {
  localStorage.setItem("loans", JSON.stringify(loans));
}

function addLoan() {
  const loan = {
    name: document.getElementById("name").value,
    amount: +document.getElementById("amount").value,
    emi: +document.getElementById("emi").value,
    start: document.getElementById("start").value,
    tenure: +document.getElementById("tenure").value,
    payments: []
  };

  for (let i = 0; i < loan.tenure; i++) {
    loan.payments.push({ paid: false });
  }

  loans.push(loan);
  save();
  render();
}

function togglePayment(loanIndex, emiIndex) {
  loans[loanIndex].payments[emiIndex].paid =
    !loans[loanIndex].payments[emiIndex].paid;
  save();
  render();
}

function render() {
  const container = document.getElementById("loans");
  container.innerHTML = "";

  let totalPaid = 0;
  let totalRemaining = 0;

  loans.forEach((loan, i) => {
    let paid = 0;

    loan.payments.forEach(p => {
      if (p.paid) paid += loan.emi;
    });

    totalPaid += paid;
    totalRemaining += loan.amount - paid;

    let html = `<div class="loan">
      <h3>${loan.name}</h3>
      <p>Paid: ₹${paid} / ₹${loan.amount}</p>`;

    loan.payments.forEach((p, j) => {
      html += `
        <div>
          <input type="checkbox"
            ${p.paid ? "checked" : ""}
            onclick="togglePayment(${i}, ${j})">
          EMI ${j + 1}
        </div>`;
    });

    html += `</div>`;
    container.innerHTML += html;
  });

  document.getElementById("totalPaid").innerText = totalPaid;
  document.getElementById("totalRemaining").innerText = totalRemaining;
}

render();
