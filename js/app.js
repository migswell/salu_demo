/* Salu web app (demo prototype)
   Accounts and funds are saved only in this browser (localStorage).
   No real money moves and nothing is sent to a server. */

(function () {
  'use strict';

  var STORAGE_KEY = 'salu-funds-v1';        // funds, one list per account
  var ACCOUNTS_KEY = 'salu-demo-accounts';  // demo accounts (this browser only)
  var SESSION_KEY = 'salu-demo-session';    // mobile number of the signed-in account
  var FEE_RATE = 0.015; // demo service fee, 1.5% per contribution

  // Built-in demo account so the app can be tried without signing up.
  var DEMO_ACCOUNT = { legalName: 'Jayed Ramos', nickname: 'Jayed', mobile: '09171234567', pin: '1234' };

  /* ---------- Storage ---------- */

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw) { return JSON.parse(raw); }
    } catch (e) { /* storage blocked */ }
    return fallback;
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  /* ---------- Demo accounts ----------
     A real app would verify accounts on a secure server and never keep a PIN
     in the browser. This prototype only simulates sign-up and sign-in. */

  function getAccounts() {
    var list = readJson(ACCOUNTS_KEY, []);
    var hasDemo = list.some(function (a) { return a.mobile === DEMO_ACCOUNT.mobile; });
    if (!hasDemo) { list.unshift(Object.assign({}, DEMO_ACCOUNT)); }
    return list;
  }

  function findAccount(mobile) {
    return getAccounts().filter(function (a) { return a.mobile === mobile; })[0] || null;
  }

  function saveAccount(account) {
    var list = getAccounts().filter(function (a) { return a.mobile !== account.mobile; });
    list.push(account);
    writeJson(ACCOUNTS_KEY, list);
  }

  function startSession(mobile) {
    try { localStorage.setItem(SESSION_KEY, mobile); } catch (e) { /* ignore */ }
  }

  function endSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  }

  function currentAccount() {
    var mobile = null;
    try { mobile = localStorage.getItem(SESSION_KEY); } catch (e) { /* ignore */ }
    return mobile ? findAccount(mobile) : null;
  }

  // The name shown around the app: the nickname, or the first word of the legal name.
  function displayName(account) {
    if (!account) { return 'You'; }
    return account.nickname || account.legalName.split(' ')[0];
  }

  /* ---------- Funds data ----------
     Every account starts with an empty list. Nothing is added automatically. */

  function dataKey() {
    var acc = currentAccount();
    return STORAGE_KEY + ':' + (acc ? acc.mobile : 'guest');
  }

  function load() {
    var data = readJson(dataKey(), null);
    if (!data || !Array.isArray(data.funds)) {
      data = { funds: [], lastSavedId: null, lastAction: null, notice: null };
    }
    return data;
  }

  function save(data) {
    writeJson(dataKey(), data);
  }

  function reset() {
    try { localStorage.removeItem(dataKey()); } catch (e) { /* ignore */ }
  }

  function getFund(data, id) {
    return data.funds.filter(function (f) { return f.id === id; })[0] || null;
  }

  function urlParam(name) {
    var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(window.location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function fundUrl(f) { return 'fund.html?id=' + encodeURIComponent(f.id); }

  // Each member pays the goal split evenly, rounded up to the next peso.
  function contributionFor(goal, size) { return Math.ceil(goal / size); }
  function target(f) { return f.contribution * f.size; }            // what you will have saved
  function saved(f) { return f.payments.length * f.contribution; }   // what you have saved so far
  function percent(f) { return Math.round(saved(f) / target(f) * 100); }
  function nextTurn(f) { return f.payments.length < f.size ? f.payments.length + 1 : null; }

  /* ---------- Helpers ---------- */

  function $(sel, root) { return (root || document).querySelector(sel); }

  function peso(n) {
    return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function parseDate(iso) {
    var p = iso.split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function formatDate(iso) {
    return parseDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function toIso(d) {
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function todayIso() { return toIso(new Date()); }

  // Due date of a given turn (1-based) for a fund's schedule
  function turnDate(fund, turn) {
    var d = parseDate(fund.firstDate);
    var i = turn - 1;
    if (fund.frequency === 'Weekly') { d.setDate(d.getDate() + 7 * i); }
    else if (fund.frequency === 'Twice a month') { d.setDate(d.getDate() + 15 * i); }
    else { d.setMonth(d.getMonth() + i); }
    return toIso(d);
  }

  function setText(id, text) {
    var node = document.getElementById(id);
    if (node) { node.textContent = text; }
  }

  function el(tagName, attrs, text) {
    var node = document.createElement(tagName);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text !== undefined) { node.textContent = text; }
    return node;
  }

  function tag(label, kind) { return el('span', { 'class': 'tag tag-' + kind }, label); }

  function show(id, visible) {
    var node = document.getElementById(id);
    if (node) { node.hidden = !visible; }
  }

  /* ---------- Form validation ---------- */

  function fieldMessage(input) {
    var v = input.validity;
    if (v.valueMissing) { return input.dataset.required || 'This field is required.'; }
    if (v.patternMismatch) { return input.dataset.pattern || 'Please check the format.'; }
    if (v.rangeUnderflow || v.rangeOverflow || v.stepMismatch || v.badInput) {
      return input.dataset.range || 'Please enter a valid value.';
    }
    if (v.typeMismatch) { return 'Please check the format.'; }
    if (v.tooLong) { return 'This is too long.'; }
    return '';
  }

  // Shows an inline message under each invalid field and a summary at the top.
  function validate(form) {
    var summary = form.querySelector('.form-errors');
    var problems = [];
    var seenGroups = {};

    Array.prototype.forEach.call(form.elements, function (input) {
      if (!input.name || input.disabled || input.type === 'submit' || input.type === 'reset') { return; }
      var isGroup = input.type === 'radio';
      if (isGroup && seenGroups[input.name]) { return; }
      seenGroups[input.name] = true;

      var msg = fieldMessage(input);
      var errId = (isGroup ? input.name : input.id) + '-error';
      var errEl = document.getElementById(errId);
      var targets = isGroup ? form.querySelectorAll('[name="' + input.name + '"]') : [input];

      Array.prototype.forEach.call(targets, function (t) {
        if (msg) { t.setAttribute('aria-invalid', 'true'); } else { t.removeAttribute('aria-invalid'); }
      });
      if (errEl) { errEl.textContent = msg; errEl.hidden = !msg; }
      if (msg) { problems.push({ id: input.id, label: input.dataset.label || input.name, msg: msg }); }
    });

    if (summary) {
      summary.innerHTML = '';
      if (problems.length) {
        summary.appendChild(el('p', {}, 'Please fix ' + (problems.length === 1 ? '1 item' : problems.length + ' items') + ' before continuing:'));
        var ul = el('ul');
        problems.forEach(function (p) {
          var li = el('li');
          li.appendChild(el('a', { href: '#' + p.id }, p.label + ': ' + p.msg));
          ul.appendChild(li);
        });
        summary.appendChild(ul);
        summary.focus();
      }
    }
    return problems.length === 0;
  }

  function clearErrors(form) {
    Array.prototype.forEach.call(form.querySelectorAll('[aria-invalid]'), function (i) { i.removeAttribute('aria-invalid'); });
    Array.prototype.forEach.call(form.querySelectorAll('.error-text'), function (e) { e.textContent = ''; e.hidden = true; });
    var summary = form.querySelector('.form-errors');
    if (summary) { summary.innerHTML = ''; }
  }

  // Shows one error that only JavaScript can detect (e.g. wrong PIN).
  function fail(form, input, msg) {
    var errEl = document.getElementById(input.id + '-error');
    input.setAttribute('aria-invalid', 'true');
    if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
    var summary = form.querySelector('.form-errors');
    if (summary) {
      summary.innerHTML = '';
      var p = el('p');
      p.appendChild(el('a', { href: '#' + input.id }, msg));
      summary.appendChild(p);
      summary.focus();
    }
  }

  /* ---------- Shared pieces ---------- */

  function refreshNickname() {
    var name = displayName(currentAccount());
    Array.prototype.forEach.call(document.querySelectorAll('.js-nickname'), function (n) {
      n.textContent = name;
    });
  }

  // Header name, log out, and sign-in check on every signed-in page.
  // Help stays open to visitors who are not signed in.
  function initAccountUi() {
    var acc = currentAccount();
    var isAppPage = document.body.classList.contains('has-app-nav');
    if (isAppPage && !acc) {
      if (document.body.getAttribute('data-page') !== 'help') {
        window.location.replace('signin.html');
        return false;
      }
      document.body.classList.add('signed-out');
    }
    refreshNickname();
    Array.prototype.forEach.call(document.querySelectorAll('[data-logout]'), function (a) {
      a.addEventListener('click', endSession);
    });
    return true;
  }

  // One fund in a list: name, progress bar and what's next.
  function fundListItem(f) {
    var li = el('li', { 'class': 'fund-item' });
    var head = el('div', { 'class': 'fund-item-head' });
    var h3 = el('h3');
    h3.appendChild(el('a', { href: fundUrl(f) }, f.name));
    head.appendChild(h3);
    head.appendChild(el('span', { 'class': 'small muted' }, f.purpose));
    li.appendChild(head);

    var label = el('div', { 'class': 'progress-label' });
    label.appendChild(el('span', { 'class': 'money' }, peso(saved(f)) + ' of ' + peso(target(f))));
    label.appendChild(el('span', { 'class': 'muted' }, percent(f) + '%'));
    li.appendChild(label);

    var bar = el('progress', { max: String(target(f)), value: String(saved(f)), 'aria-label': f.name + ' progress' }, percent(f) + '%');
    li.appendChild(bar);

    var n = nextTurn(f);
    var note = n
      ? 'Next: ' + peso(f.contribution) + ' due ' + formatDate(turnDate(f, n))
      : 'Goal reached. All ' + f.size + ' contributions paid.';
    li.appendChild(el('p', { 'class': 'small muted m0' }, note));
    return li;
  }

  /* ---------- Pages ---------- */

  function initSignup() {
    var form = $('#signup-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate(form)) { return; }
      var mobile = form.mobile.value.trim();
      if (findAccount(mobile)) {
        fail(form, form.mobile, 'An account with this number already exists. Sign in instead.');
        return;
      }
      if (form.pin.value !== form.pinConfirm.value) {
        fail(form, form.pinConfirm, 'The PINs don’t match. Enter the same 4 digits twice.');
        return;
      }
      saveAccount({
        legalName: form.legalName.value.trim().replace(/\s+/g, ' '),
        nickname: form.nickname.value.trim().replace(/\s+/g, ' '),
        mobile: mobile,
        pin: form.pin.value
      });
      startSession(mobile);
      window.location.href = 'dashboard.html?welcome=1';
    });
  }

  function initSignin() {
    var form = $('#signin-form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate(form)) { return; }
      var acc = findAccount(form.mobile.value.trim());
      if (!acc) {
        fail(form, form.mobile, 'We couldn’t find an account with this number. Check it, or create an account.');
        return;
      }
      if (acc.pin !== form.pin.value) {
        fail(form, form.pin, 'That PIN is incorrect. Please try again.');
        form.pin.value = '';
        return;
      }
      startSession(acc.mobile);
      window.location.href = 'dashboard.html';
    });
  }

  function initProfile() {
    var acc = currentAccount();
    var form = $('#nickname-form');
    var status = $('#nickname-status');
    setText('p-legal', acc.legalName);
    setText('p-mobile', acc.mobile.slice(0, 4) + ' ••• ' + acc.mobile.slice(-4));
    form.nickname.value = acc.nickname || '';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.textContent = '';
      if (!validate(form)) { return; }
      acc.nickname = form.nickname.value.trim().replace(/\s+/g, ' ');
      saveAccount(acc);
      refreshNickname();
      status.textContent = acc.nickname
        ? 'Saved. Your groups will now see you as “' + acc.nickname + '”.'
        : 'Nickname removed. Your groups will see your first name, “' + displayName(acc) + '”.';
    });
  }

  function initDashboard() {
    var data = load();
    var welcome = urlParam('welcome') === '1';
    setText('greeting', (welcome ? 'Welcome to Salu, ' : 'Hi, ') + displayName(currentAccount()));

    if (data.notice) {
      setText('notice', data.notice);
      data.notice = null;
      save(data);
    }

    var hasFunds = data.funds.length > 0;
    show('empty', !hasFunds);
    show('summary', hasFunds);
    show('funds-section', hasFunds);
    setText('greeting-sub', hasFunds ? 'Here’s where your ipon stands today.' : 'Let’s set up your first savings goal.');
    if (!hasFunds) { return; }

    // Soonest unpaid contribution across all funds
    var next = null;
    data.funds.forEach(function (f) {
      var n = nextTurn(f);
      if (!n) { return; }
      var due = turnDate(f, n);
      if (!next || due < next.due) { next = { fund: f, turn: n, due: due }; }
    });

    var dueBox = $('#due-status');
    dueBox.innerHTML = '';
    if (next) {
      setText('due-group', next.fund.name);
      setText('due-amount', peso(next.fund.contribution));
      setText('due-date', formatDate(next.due));
      var late = next.due < todayIso();
      dueBox.appendChild(late ? tag('Late', 'now') : tag('Scheduled', 'due'));
      dueBox.appendChild(document.createTextNode(' Auto-Hulog will collect it from your ' + next.fund.wallet +
        ' (plus ' + peso(next.fund.contribution * FEE_RATE) + ' fee).'));
      $('#pay-link').setAttribute('href', fundUrl(next.fund) + '#pay');
      show('due-open', true);
      show('due-done', false);
    } else {
      show('due-open', false);
      show('due-done', true);
    }

    var totalSaved = 0, payments = 0, onTime = 0;
    data.funds.forEach(function (f) {
      totalSaved += saved(f);
      f.payments.forEach(function (p) {
        payments += 1;
        if (p.date <= turnDate(f, p.turn)) { onTime += 1; }
      });
    });
    setText('fact-saved', peso(totalSaved));
    setText('fact-funds', String(data.funds.length));
    setText('fact-score', payments ? onTime + ' of ' + payments + ' payments on time' : 'No payments yet');

    var list = $('#fund-list');
    list.innerHTML = '';
    data.funds.forEach(function (f) { list.appendChild(fundListItem(f)); });
  }

  function initFund() {
    var data = load();
    var f = getFund(data, urlParam('id'));
    if (!f) {
      show('fund-content', false);
      show('fund-missing', true);
      return;
    }
    var form = $('#pay-form');

    function render() {
      var n = nextTurn(f);
      document.title = f.name + ' | Salu';
      setText('fund-name', f.name);
      setText('fund-meta', f.purpose + ' · ' + peso(f.contribution) + ' ' + f.frequency.toLowerCase() + ' · ' + f.size + ' members');
      setText('fund-members', displayName(currentAccount()) + ' (you) and ' + (f.size - 1) + ' invited members. Payout order: ' + f.order + '.');
      $('#edit-link').setAttribute('href', 'create-fund.html?edit=' + encodeURIComponent(f.id));

      setText('progress-title', percent(f) + '% of your goal');
      setText('progress-saved', peso(saved(f)) + ' of ' + peso(target(f)) + ' saved');
      setText('progress-count', f.payments.length + ' of ' + f.size + ' contributions');
      var bar = $('#fund-progress');
      bar.max = target(f);
      bar.value = saved(f);
      bar.textContent = percent(f) + '%';

      // Contribution schedule
      var body = $('#schedule-body');
      body.innerHTML = '';
      for (var t = 1; t <= f.size; t++) {
        var due = turnDate(f, t);
        var paid = f.payments.filter(function (p) { return p.turn === t; })[0];
        var tr = el('tr', t === n ? { 'class': 'is-you' } : {});
        tr.appendChild(el('td', {}, String(t)));
        tr.appendChild(el('td', {}, formatDate(due)));
        tr.appendChild(el('td', { 'class': 'num money hide-sm' }, peso(f.contribution)));
        tr.appendChild(el('td', {}, paid ? formatDate(paid.date) : '—'));
        var cell = el('td');
        if (paid) { cell.appendChild(tag('Paid', 'paid')); }
        else if (t === n) { cell.appendChild(due < todayIso() ? tag('Late', 'now') : tag('Next', 'due')); }
        else { cell.appendChild(tag('Upcoming', 'wait')); }
        tr.appendChild(cell);
        body.appendChild(tr);
      }

      // Pay form
      if (!n) {
        form.hidden = true;
        show('pay-complete', true);
        setText('pay-complete-text', 'All ' + f.size + ' contributions are paid. You’ve saved ' + peso(target(f)) + ' toward ' + f.name + '.');
        return;
      }
      var fee = f.contribution * FEE_RATE;
      setText('pay-turn', 'Contribution ' + n + ' of ' + f.size + ', due ' + formatDate(turnDate(f, n)) + '.');
      setText('pay-amount', peso(f.contribution));
      setText('pay-fee', peso(fee));
      setText('pay-total', peso(f.contribution + fee));
      setText('pay-submit', 'Pay ' + peso(f.contribution + fee));
      form.confirm.checked = false;
      Array.prototype.forEach.call(form.wallet, function (r) { r.checked = r.value === f.wallet; });
    }

    render();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate(form)) { return; }
      var n = nextTurn(f);
      if (!n) { return; }
      f.payments.push({ turn: n, date: todayIso() });
      f.wallet = form.wallet.value;
      save(data);
      var ref = 'SALU-DEMO-' + Math.floor(100000 + Math.random() * 900000);
      setText('pay-done-text', 'Payment received: ' + peso(f.contribution) + ' (+ ' + peso(f.contribution * FEE_RATE) +
        ' fee) from your ' + f.wallet + '. Reference ' + ref + '. This is a simulated payment.');
      show('pay-done', true);
      render();
      $('#pay-done').focus();
    });

    // Delete with an on-page confirmation step
    $('#delete-start').addEventListener('click', function () {
      show('delete-confirm', true);
      $('#delete-start').hidden = true;
      $('#delete-cancel').focus();
    });
    $('#delete-cancel').addEventListener('click', function () {
      show('delete-confirm', false);
      $('#delete-start').hidden = false;
      $('#delete-start').focus();
    });
    $('#delete-yes').addEventListener('click', function () {
      data.funds = data.funds.filter(function (x) { return x.id !== f.id; });
      data.notice = '“' + f.name + '” was deleted.';
      save(data);
      window.location.href = 'dashboard.html';
    });
  }

  function initFundForm() {
    var form = $('#fund-form');
    var data = load();
    var editId = urlParam('edit');
    var f = editId ? getFund(data, editId) : null;
    var acc = currentAccount();

    if (editId && !f) {
      show('form-content', false);
      show('fund-missing', true);
      return;
    }

    function setDefault(input, value) {
      input.value = value;
      input.defaultValue = value;
    }

    if (f) {
      // Edit mode: fill the form with the fund's current details
      document.title = 'Edit ' + f.name + ' | Salu';
      setText('form-title', 'Edit fund');
      setText('form-sub', 'Update the details of “' + f.name + '”.');
      setText('form-submit', 'Save changes');
      setText('form-reset', 'Undo changes');
      show('cancel-edit', true);
      $('#cancel-edit').setAttribute('href', fundUrl(f));
      setDefault(form.fundName, f.name);
      Array.prototype.forEach.call(form.purpose.options, function (o) { o.defaultSelected = o.value === f.purpose; });
      setDefault(form.goal, String(f.goal || target(f)));
      setDefault(form.size, String(f.size));
      Array.prototype.forEach.call(form.frequency, function (r) { r.defaultChecked = r.value === f.frequency; });
      setDefault(form.firstDate, f.firstDate);
      Array.prototype.forEach.call(form.order, function (r) { r.defaultChecked = r.value === f.order; });
      Array.prototype.forEach.call(form.wallet.options, function (o) { o.defaultSelected = o.value === f.wallet; });
      setDefault(form.mobile, f.mobile || (acc ? acc.mobile : ''));
      form.autohulog.defaultChecked = true;
      form.terms.defaultChecked = true;
      form.reset();

      // Once money has moved, the amounts and schedule are locked.
      if (f.payments.length) {
        [form.goal, form.size, form.firstDate].forEach(function (i) { i.disabled = true; });
        Array.prototype.forEach.call(form.frequency, function (r) { r.disabled = true; });
        show('locked-note', true);
      }
      var today = todayIso();
      form.firstDate.min = f.firstDate < today ? f.firstDate : today;
    } else {
      form.firstDate.min = todayIso();
      if (acc) { setDefault(form.mobile, acc.mobile); }
    }

    function updateEstimate() {
      var goal = Number(form.goal.value);
      var size = Number(form.size.value);
      var ok = goal >= 1000 && goal <= 600000 && size >= 3 && size <= 12;
      if (!ok) {
        setText('est-contribution', '—');
        setText('est-payout', '—');
        setText('est-end', '—');
        return;
      }
      var c = contributionFor(goal, size);
      setText('est-contribution', peso(c));
      setText('est-payout', peso(c * size));
      var freq = form.querySelector('[name="frequency"]:checked');
      if (form.firstDate.value && freq) {
        setText('est-end', formatDate(turnDate({ firstDate: form.firstDate.value, frequency: freq.value }, size)));
      } else {
        setText('est-end', '—');
      }
    }
    form.addEventListener('input', updateEstimate);
    form.addEventListener('change', updateEstimate);
    form.addEventListener('reset', function () {
      clearErrors(form);
      setTimeout(updateEstimate, 0);
    });
    updateEstimate();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate(form)) { return; }
      var fund = f || { id: 'fund-' + Date.now(), payments: [], createdOn: todayIso() };
      fund.name = form.fundName.value.trim().replace(/\s+/g, ' ');
      fund.purpose = form.purpose.value;
      fund.order = form.order.value;
      fund.wallet = form.wallet.value;
      fund.mobile = form.mobile.value.trim();
      if (!fund.payments.length) {
        fund.size = Number(form.size.value);
        fund.goal = Number(form.goal.value);
        fund.contribution = contributionFor(Number(form.goal.value), fund.size);
        fund.frequency = form.frequency.value;
        fund.firstDate = form.firstDate.value;
      }
      if (!f) { data.funds.push(fund); }
      data.lastSavedId = fund.id;
      data.lastAction = f ? 'updated' : 'created';
      save(data);
      window.location.href = 'confirmation.html';
    });
  }

  function initConfirmation() {
    var data = load();
    var f = getFund(data, data.lastSavedId);
    if (!f) {
      show('confirm-content', false);
      show('confirm-empty', true);
      return;
    }
    var created = data.lastAction !== 'updated';
    setText('c-alert', created ? 'Your fund is ready.' : 'Changes saved.');
    setText('c-alert-sub', created ? ' Share the invite link so members can join.' : ' Here are the updated details.');
    show('next-section', created);
    setText('c-name', f.name);
    setText('c-goal', peso(target(f)));
    setText('c-purpose', f.purpose);
    setText('c-amount', peso(f.contribution) + ' per member');
    setText('c-frequency', f.frequency);
    setText('c-size', f.size + ' members');
    setText('c-first', formatDate(f.firstDate));
    setText('c-last', formatDate(turnDate(f, f.size)));
    setText('c-order', f.order);
    setText('c-wallet', f.wallet + ' · ' + peso(f.contribution * FEE_RATE) + ' fee per contribution');
    setText('c-link', 'salu.app/join/' + f.id.replace('fund-', '').slice(-6));
    $('#view-fund').setAttribute('href', fundUrl(f));
  }

  function initHelp() {
    var btn = $('#reset-demo');
    if (!btn) { return; }
    btn.addEventListener('click', function () {
      reset();
      setText('reset-status', 'Demo data cleared. All your funds were deleted. Your account is still signed in.');
    });
  }

  /* ---------- Start ---------- */

  var page = document.body.getAttribute('data-page');
  var pages = {
    signup: initSignup,
    signin: initSignin,
    profile: initProfile,
    dashboard: initDashboard,
    fund: initFund,
    'fund-form': initFundForm,
    confirmation: initConfirmation,
    help: initHelp
  };
  if (initAccountUi() && pages[page]) { pages[page](); }
})();
