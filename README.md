# 💰 EMI Tracker Pro

> A personal loan & EMI management app I built to stop losing track of my monthly payments. No more spreadsheets, no more forgetting due dates.

**Live Demo →** [praneethtalari.github.io/emi-tracker](https://praneethtalari.github.io/emi-tracker/)

---

## Why I Built This

I had 3 loans running at the same time and I kept forgetting which one was due when. Excel felt overkill and banking apps don't really show you the full picture — like how much interest you're bleeding every month, or exactly when you'll be debt-free.

So I built this. It's a simple web app that lives in your browser, syncs to your Google account, and gives you a clean view of all your loans in one place.

---

## What It Does

- **Add any loan** — enter the principal, interest rate, and tenure and it auto-calculates your EMI
- **Full amortization schedule** — see every single payment broken down into principal + interest + remaining balance
- **Next payment tracker** — tells you exactly when your next EMI is due, with color-coded urgency (overdue, due today, due soon, upcoming)
- **EMI end date** — every loan shows when it finally ends
- **Dashboard overview** — total paid, total remaining, EMIs left, debt-free date, and combined monthly outflow at a glance
- **Progress bars** — visual progress for each loan showing how far you've come
- **Analytics charts** — bar, line, donut, and radar charts to visualize your debt journey
- **Export to CSV or PDF** — download your loan report anytime
- **Light / Dark mode** — toggle with one click, preference is saved
- **Google login** — your data syncs across devices via Firebase

---

## Tech Stack

| What | Why |
|------|-----|
| Vanilla HTML + CSS + JS | No framework needed, keeps it fast and simple |
| Firebase Auth | Google login in one click |
| Firebase Firestore | Cloud sync so your data is safe |
| Chart.js | Clean, animated charts |
| Lucide Icons | Sharp minimal icons |
| jsPDF | PDF export in the browser |
| GitHub Pages | Free hosting |

---

## Screenshots

> Dark mode dashboard with animated glassmorphism cards, 3D tilt effects, and floating orb background

---

## Run It Locally

No build step, no npm install. Just clone and open.

```bash
git clone https://github.com/praneethtalari/emi-tracker.git
cd emi-tracker
# open index.html in your browser
```

That's it. The Firebase config is already in the code and points to a shared project — it works out of the box.

---

## File Structure

```
emi-tracker/
├── index.html      # All the markup and screen layouts
├── style.css       # Dark/light themes, animations, glassmorphism UI
├── app.js          # All logic — auth, calculations, charts, render
└── README.md
```

---

## How the Loan Calculation Works

Standard EMI formula:

```
EMI = P × r × (1 + r)^n / ((1 + r)^n - 1)

P = Principal amount
r = Monthly interest rate (annual rate ÷ 12 ÷ 100)
n = Tenure in months
```

Zero-interest loans are handled separately — EMI = Principal ÷ Tenure.

The amortization schedule is built month by month:
- Each month's interest = remaining balance × monthly rate
- Principal paid = EMI − interest
- Balance = previous balance − principal paid

---

## Features Roadmap

- [ ] Prepayment / part-payment support
- [ ] Push notifications for due dates
- [ ] Multiple currencies
- [ ] Loan comparison tool
- [ ] SMS / WhatsApp reminder integration

---

## Known Issues

- The app requires internet for login and data sync (Firebase)
- Charts may look cramped on very small screens (< 320px)
- PDF export uses basic styling (no color theme)

---

## Contributing

If you find a bug or want to add something, just open an issue or PR. This is a side project so I'll respond when I can.

---

## License

MIT — use it however you want.

---

Built by **Sai Krishna Praneeth Talari** · [GitHub](https://github.com/praneethtalari)
