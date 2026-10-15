# Salu – FinTech Mobile Web App Prototype

Salu is a digital paluwagan (rotating group savings). Members' contributions sit in a locked pot, payouts follow a fixed order, and a safety fund covers missed payments. *Ipon Together.*

FINT109 Mobile Web App Development – Final Project. All names, amounts and partners are fictional.

## How to run

1. Open the `Final_Project` folder.
2. Double-click `index.html` to open it in a browser (Chrome, Edge or Firefox).
3. Choose **Create an account**, or **Sign in** with the demo account: mobile `09171234567`, PIN `1234`.

No installation, server or internet connection is needed. (Fonts load from Google Fonts when online; otherwise similar system fonts are used.)

To publish it, push this folder to a GitHub repository and turn on **GitHub Pages** (Settings → Pages → deploy from the main branch). `index.html` is the start page.

## Views

| File | View | What it does |
| --- | --- | --- |
| `index.html` | Welcome | What Salu is, with **Create an account** and **Sign in** |
| `signup.html` | Create account | Full name, optional nickname, mobile number, PIN and confirmation |
| `signin.html` | Sign in | Mobile number and PIN |
| `profile.html` | Profile | Set, change or clear your nickname; view private account details; log out |
| `dashboard.html` | Dashboard | Your funds with progress bars, next contribution, total saved, Salu Score. Shows **Create your first fund** when you have none |
| `fund.html` | Fund page | Progress toward the goal, contribution schedule table, simulated payment, edit and delete |
| `create-fund.html` | Data-entry form | Create a fund, or edit one (`?edit=`): text, select, money, number, radio, date, tel, checkboxes, submit and reset |
| `confirmation.html` | Confirmation | Summary after a fund is created or updated |
| `help.html` | Help and privacy | How Salu works, FAQ, privacy notice, reset demo data |

The same navigation appears on every signed-in view: a bottom bar on phones and top links on desktop. Your nickname in the header opens your profile.

## Demo behaviour

- Accounts are **simulated**: they are saved only in this browser, not checked by a server. A real app would verify accounts on a secure server and never store a PIN in the browser.
- Your **nickname** is how the app greets you and how your groups see you (header, dashboard, group tables). Your full name stays private. With no nickname, your first name is used.
- **Funds:** every account starts with an empty list; no sample funds are added. A fund has a name, a savings goal, a purpose, the number of members (3–12), a schedule and a first due date. The goal is split evenly into each member's contribution (rounded up to the peso).
- **Progress** is how much of the goal you've contributed. Paying a contribution (simulated) updates the fund page, the dashboard and your Salu Score.
- **Editing:** name, purpose, payout order and wallet can always change. The goal, members and schedule lock once a contribution is paid. **Deleting** asks for confirmation on the page first.
- Signed-in pages send you to **Sign in** if no one is signed in. Help stays open to everyone.
- Paying early and creating a group are **simulated**. Nothing is sent anywhere and no money moves.
- Changes are saved only in this browser (`localStorage`). Use **Help → Reset demo data** to delete all your funds and start over.

## Files

```
Final_Project/
├── index.html, signup.html, signin.html, profile.html,
│   dashboard.html, fund.html, create-fund.html,
│   confirmation.html, help.html
├── css/style.css      shared styles (Salu brand colours, type, layout)
├── js/app.js          demo data, form validation, page behaviour
├── images/            Salu logo and wordmark (web-optimised)
└── Instructions/      project instructions
```

## Limitations

- No real authentication or payments. Full name and mobile number can't be changed in this demo.
- Other members can't really join; invite links are placeholders and only your own contributions are tracked.
- Data is per browser and is lost if browser storage is cleared.
