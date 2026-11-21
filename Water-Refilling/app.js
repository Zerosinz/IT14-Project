const A = 'Owner/Admin', S = 'Staff', D = 'Delivery Personnel';
const $ = s => document.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k === 'class' ? e.className = v : k.startsWith('on') ? e.addEventListener(k.slice(2), v) : e[k] = v;
  kids.flat().forEach(c => e.append(c ?? ''));
  return e;
};
const api = async (url, o = {}) => {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...o, body: o.body && JSON.stringify(o.body) });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== '/api/login') location.reload();
  if (!r.ok) throw new Error(d.error || 'Something went wrong.');
  return d;
};
const peso = n => '₱' + (Number(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const MONEY = ['total', 'total_amount', 'gross_salary', 'deductions', 'net_salary', 'amount', 'unit_price'];
const fmt = (c, v) => v == null ? '' : c === 'delivery_required' ? (+v ? 'Yes' : 'No') : MONEY.includes(c) ? peso(v) : v;
const YN = [['1', 'Yes'], ['0', 'No']];
const cust = ['customers', 'customer_id', r => r.customer_name];
const emp = ['employees', 'employee_id', r => r.full_name];

// Field: [name, label, type, extra, newOnly]. Types: text, textarea, number, date, datetime, password, select (extra = options), ref (extra = [endpoint, key, label fn])
const M = [
  { k: 'dashboard', t: 'Dashboard', r: [A, S], run: dash },
  { k: 'customers', t: 'Customers', r: [A, S], w: [A, S], c: ['customer_id', 'customer_name', 'contact_number', 'address', 'notes'],
    f: [['customer_name', 'Name', 'text'], ['contact_number', 'Contact number', 'text'], ['address', 'Address', 'textarea'], ['notes', 'Notes', 'textarea']] },
  { k: 'orders', t: 'Orders', r: [A, S], w: [A, S], c: ['order_id', 'order_date', 'customer_name', 'order_channel', 'delivery_required', 'order_status', 'total'],
    f: [['customer_id', 'Customer', 'ref', cust], ['order_channel', 'Order channel', 'select', ['Call', 'Message', 'Walk-in']], ['delivery_required', 'Delivery needed?', 'select', YN],
        ['delivery_address', 'Delivery address', 'textarea'], ['product_id', 'Product', 'ref', ['products', 'product_id', r => `${r.product_name} (${r.size_or_type}) ${peso(r.unit_price)}`], 1],
        ['quantity', 'Quantity', 'number', null, 1], ['order_status', 'Status', 'select', ['Pending', 'Confirmed', 'Preparing', 'Completed', 'Cancelled']], ['notes', 'Notes', 'textarea']] },
  { k: 'deliveries', t: 'Deliveries', r: [A, S, D], w: [A, S, D], add: [A, S], c: ['delivery_id', 'customer_name', 'delivery_address', 'employee', 'scheduled_at', 'delivery_status', 'remarks'],
    f: [['order_id', 'Order', 'ref', ['orders', 'order_id', r => `#${r.order_id} ${r.customer_name}`]], ['assigned_employee_id', 'Assigned delivery personnel', 'ref', emp],
        ['scheduled_at', 'Scheduled date and time', 'datetime'], ['delivery_status', 'Status', 'select', ['Scheduled', 'Out for delivery', 'Delivered', 'Rescheduled']], ['remarks', 'Remarks', 'textarea']] },
  { k: 'gallon_transactions', t: 'Gallon ledger', r: [A, S, D], w: [A, S, D], c: ['gallon_txn_id', 'transaction_date', 'customer_name', 'transaction_type', 'quantity', 'remarks'], after: balances,
    f: [['customer_id', 'Customer', 'ref', cust], ['transaction_type', 'Type', 'select', ['Borrow', 'Return']], ['quantity', 'Number of gallons', 'number'], ['remarks', 'Remarks', 'textarea']] },
  { k: 'sales', t: 'Sales', r: [A, S], w: [A, S], c: ['sale_id', 'sale_date', 'customer_name', 'total_amount', 'payment_status', 'payment_method'],
    f: [['order_id', 'Linked order (optional)', 'ref', ['orders', 'order_id', r => `#${r.order_id} ${r.customer_name} ${peso(r.total)}`]], ['total_amount', 'Amount (blank = total of linked order)', 'number'],
        ['payment_status', 'Payment status', 'select', ['Paid', 'Unpaid', 'Partial']], ['payment_method', 'Payment method', 'text']] },
  { k: 'complaints', t: 'Customer concerns', r: [A, S], w: [A, S], c: ['complaint_id', 'received_at', 'customer_name', 'category', 'description', 'handler', 'status'],
    f: [['customer_id', 'Customer', 'ref', cust], ['category', 'Category', 'select', ['Gallon cleanliness', 'Delivery concern', 'Water quality', 'Billing', 'Other']],
        ['description', 'Concern details', 'textarea'], ['resolution', 'Action taken / resolution', 'textarea'], ['status', 'Status', 'select', ['Open', 'In progress', 'Resolved']]] },
  { k: 'chats', t: 'Chat inbox', r: [A, S], run: chats },
  { k: 'reports', t: 'Reports', r: [A, S], run: reports },
  { k: 'products', t: 'Products and prices', r: [A], w: [A], c: ['product_id', 'product_name', 'size_or_type', 'unit_price', 'status'],
    f: [['product_name', 'Product name', 'text'], ['size_or_type', 'Size / type', 'text'], ['unit_price', 'Unit price', 'number'], ['status', 'Status', 'select', ['Active', 'Inactive']]] },
  { k: 'employees', t: 'Employees', r: [A], w: [A], c: ['employee_id', 'full_name', 'contact_number', 'job_title', 'employment_status'],
    f: [['full_name', 'Full name', 'text'], ['contact_number', 'Contact number', 'text'], ['job_title', 'Job title', 'text'], ['employment_status', 'Status', 'select', ['Active', 'Inactive']]] },
  { k: 'salary_records', t: 'Salaries', r: [A], w: [A], c: ['salary_record_id', 'employee', 'pay_period_start', 'pay_period_end', 'gross_salary', 'deductions', 'net_salary', 'payment_status'],
    f: [['employee_id', 'Employee', 'ref', emp], ['pay_period_start', 'Period start', 'date'], ['pay_period_end', 'Period end', 'date'], ['gross_salary', 'Gross salary', 'number'],
        ['deductions', 'Deductions', 'number'], ['date_paid', 'Date paid', 'date'], ['payment_status', 'Payment status', 'select', ['Pending', 'Paid']]] },
  { k: 'expenses', t: 'Expenses', r: [A], w: [A], c: ['expense_id', 'expense_date', 'category', 'description', 'amount'],
    f: [['expense_date', 'Date', 'date'], ['category', 'Category', 'text'], ['description', 'Description', 'textarea'], ['amount', 'Amount', 'number']] },
  { k: 'users', t: 'User management', r: [A], w: [A], c: ['user_id', 'full_name', 'username', 'role', 'account_status'],
    f: [['full_name', 'Full name', 'text'], ['username', 'Username', 'text'], ['password', 'Password (leave blank to keep current)', 'password'], ['role', 'Role', 'select', [A, S, D]],
        ['account_status', 'Account status', 'select', ['Active', 'Inactive']], ['employee_id', 'Linked employee (needed for delivery personnel)', 'ref', emp]] }
];

let user, timer;

function start(u) {
  user = u; $('#login').hidden = true; $('#app').hidden = false; $('#who').textContent = `${u.name} (${u.role})`;
  const mods = M.filter(m => m.r.includes(u.role));
  $('#nav').replaceChildren(...mods.map(m => h('a', { href: '#', k: m.k, class: 'list-group-item list-group-item-action', onclick: e => { e.preventDefault(); show(m); } }, m.t)));
  show(u.role === D ? M.find(m => m.k === 'deliveries') : mods[0]);
}

async function show(m) {
  clearInterval(timer);
  const el = $('#main');
  el.replaceChildren(h('h2', { class: 'h4 mb-3' }, m.t));
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', a.k === m.k));
  try { m.run ? await m.run(el) : await crud(m, el); }
  catch (e) { el.append(h('div', { class: 'alert alert-danger' }, e.message)); }
}

async function crud(m, el) {
  const rows = await api('/api/t/' + m.k), pk = m.c[0];
  const limited = user.role === D && m.k === 'deliveries'; // delivery personnel may only change status and remarks
  const fields = m.f.filter(f => !limited || ['delivery_status', 'remarks'].includes(f[0]));
  const refs = {};
  await Promise.all(fields.filter(f => f[2] === 'ref').map(async f => refs[f[0]] = await api('/api/t/' + f[3][0])));
  const slot = h('div'), canEdit = m.w.includes(user.role);

  function openForm(row) {
    const inputs = {}, err = h('div', { class: 'text-danger small mb-2', role: 'alert' });
    const field = ([n, l, t, x, newOnly]) => {
      if (row && newOnly) return '';
      let i;
      if (t === 'textarea') i = h('textarea', { class: 'form-control', rows: 2 });
      else if (t === 'select' || t === 'ref') {
        i = h('select', { class: 'form-select' }); i.add(new Option('', ''));
        (t === 'ref' ? refs[n].map(r => [r[x[1]], x[2](r)]) : x.map(o => Array.isArray(o) ? o : [o, o])).forEach(([v, lb]) => i.add(new Option(lb, v)));
      } else i = h('input', { class: 'form-control', type: { number: 'number', date: 'date', datetime: 'datetime-local', password: 'password' }[t] || 'text' });
      if (t === 'number') i.step = 'any';
      if (row && row[n] != null && t !== 'password') i.value = t === 'datetime' ? String(row[n]).replace(' ', 'T').slice(0, 16) : row[n];
      inputs[n] = i;
      return h('div', { class: 'col-md-6' }, h('label', { class: 'form-label' }, l), i);
    };
    const form = h('form', { class: 'card card-body mb-3', onsubmit: async e => {
      e.preventDefault();
      const body = Object.fromEntries(Object.entries(inputs).map(([n, i]) => [n, i.value]));
      try { await api('/api/t/' + m.k + (row ? '/' + row[pk] : ''), { method: row ? 'PUT' : 'POST', body }); show(m); }
      catch (x) { err.textContent = x.message; }
    } }, h('div', { class: 'row g-3 mb-3' }, fields.map(field)), err,
      h('div', {}, h('button', { class: 'btn btn-primary me-2' }, row ? 'Save changes' : 'Add record'), h('button', { type: 'button', class: 'btn btn-outline-secondary', onclick: () => slot.replaceChildren() }, 'Cancel')));
    slot.replaceChildren(form); form.scrollIntoView({ block: 'nearest' });
  }

  if ((m.add || m.w).includes(user.role)) el.append(h('button', { class: 'btn btn-primary mb-3', onclick: () => openForm() }, 'Add new'));
  el.append(slot, table(m.c, rows, r => h('td', { class: 'text-nowrap' },
    canEdit ? h('button', { class: 'btn btn-sm btn-outline-primary me-1', onclick: () => openForm(r) }, 'Edit') : '',
    user.role === A ? h('button', { class: 'btn btn-sm btn-outline-danger', onclick: async () => {
      if (!confirm('Delete this record?')) return;
      try { await api(`/api/t/${m.k}/${r[pk]}`, { method: 'DELETE' }); show(m); } catch (x) { alert(x.message); } } }, 'Delete') : '')));
  if (m.after) await m.after(el);
}

function table(cols, rows, actions) {
  return h('div', { class: 'table-responsive' }, h('table', { class: 'table table-sm table-striped bg-white align-middle' },
    h('thead', {}, h('tr', {}, cols.map(c => h('th', {}, c.replace(/_/g, ' '))), actions ? h('th') : '')),
    h('tbody', {}, rows.length ? rows.map(r => h('tr', {}, cols.map(c => h('td', {}, String(fmt(c, r[c]))), ), actions ? actions(r) : ''))
      : h('tr', {}, h('td', { colSpan: cols.length + 1, class: 'text-muted' }, 'No records yet.')))));
}

async function balances(el) {
  const rows = await api('/api/gallon-balance');
  el.append(h('h3', { class: 'h5 mt-4' }, 'Outstanding gallons per customer'), table(['customer_name', 'borrowed', 'returned', 'outstanding'], rows));
}

async function dash(el) {
  const d = await api('/api/dashboard');
  const card = (l, v) => h('div', { class: 'col-6 col-lg-4' }, h('div', { class: 'card card-body' }, h('div', { class: 'text-muted small' }, l), h('div', { class: 'fs-3 fw-semibold' }, v)));
  el.append(h('div', { class: 'row g-3' }, card('Sales today', peso(d.sales_today)), card('Pending orders', d.pending_orders), card('Active deliveries', d.pending_deliveries),
    card('Gallons not yet returned', d.gallons_out), card('Unresolved concerns', d.open_concerns), d.expenses_month !== undefined ? card('Expenses this month', peso(d.expenses_month)) : ''));
}

async function reports(el) {
  const all = [['sales', 'Sales', [A, S]], ['orders', 'Orders', [A, S]], ['deliveries', 'Deliveries', [A, S]], ['gallons', 'Gallon transactions', [A, S]],
    ['complaints', 'Customer concerns', [A, S]], ['expenses', 'Expenses', [A]], ['salaries', 'Salaries', [A]]].filter(r => r[2].includes(user.role));
  const type = h('select', { class: 'form-select' }, all.map(r => h('option', { value: r[0] }, r[1])));
  const iso = d => d.toISOString().slice(0, 10), today = new Date();
  const from = h('input', { type: 'date', class: 'form-control', value: iso(new Date(today.getFullYear(), today.getMonth(), 1)) });
  const to = h('input', { type: 'date', class: 'form-control', value: iso(today) });
  const out = h('div');
  const run = async e => {
    e && e.preventDefault();
    try {
      const rows = await api(`/api/report/${type.value}?from=${from.value}&to=${to.value}`);
      const sum = rows.length && ['total_amount', 'amount', 'net_salary'].find(k => k in rows[0]);
      out.replaceChildren(h('h3', { class: 'h5' }, `${all.find(r => r[0] === type.value)[1]}: ${from.value} to ${to.value}`),
        table(rows.length ? Object.keys(rows[0]) : ['no_data'], rows),
        sum ? h('p', { class: 'fw-semibold' }, `Total ${sum.replace(/_/g, ' ')}: ${peso(rows.reduce((a, r) => a + Number(r[sum]), 0))}`) : '');
    } catch (x) { out.replaceChildren(h('div', { class: 'alert alert-danger' }, x.message)); }
  };
  el.append(h('form', { class: 'row g-2 mb-3 no-print', onsubmit: run }, h('div', { class: 'col-md-3' }, type), h('div', { class: 'col-md-3' }, from), h('div', { class: 'col-md-3' }, to),
    h('div', { class: 'col-md-3' }, h('button', { class: 'btn btn-primary me-2' }, 'Generate'), h('button', { type: 'button', class: 'btn btn-outline-secondary', onclick: () => print() }, 'Print'))), out);
  run();
}

async function chats(el) {
  let cur, g = {};
  const list = h('div', { class: 'list-group' }), log = h('div', { class: 'border rounded bg-white p-2 mb-2', style: 'height:300px;overflow:auto' });
  const txt = h('input', { class: 'form-control', placeholder: 'Type a reply' });
  const form = h('form', { class: 'd-flex gap-2', onsubmit: async e => {
    e.preventDefault(); if (!cur) return;
    await api('/api/chats/reply', { method: 'POST', body: { session_id: cur, text: txt.value } }); txt.value = ''; load();
  } }, txt, h('button', { class: 'btn btn-primary' }, 'Reply'));
  const draw = () => {
    list.replaceChildren(...Object.keys(g).reverse().map(id => h('button', { class: 'list-group-item list-group-item-action' + (id === cur ? ' active' : ''), onclick: () => { cur = id; draw(); } }, g[id][0].customer_name)));
    log.replaceChildren(...(g[cur] || []).map(m => h('div', { class: 'mb-1 ' + (m.sender === 'staff' ? 'text-end' : '') },
      h('span', { class: 'badge text-wrap ' + (m.sender === 'staff' ? 'text-bg-primary' : 'text-bg-light border text-dark') }, m.message))));
    log.scrollTop = log.scrollHeight;
  };
  const load = async () => { g = {}; (await api('/api/chats')).forEach(m => (g[m.session_id] = g[m.session_id] || []).push(m)); draw(); };
  el.append(h('p', { class: 'text-muted' }, 'Messages sent from the customer chat page (/chat). To keep a formal record, also add the concern under Customer concerns.'),
    h('div', { class: 'row g-3' }, h('div', { class: 'col-md-4' }, list), h('div', { class: 'col-md-8' }, log, form)));
  await load(); timer = setInterval(() => load().catch(() => {}), 5000);
}

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  try { start(await api('/api/login', { method: 'POST', body: { username: $('#user').value, password: $('#pass').value } })); }
  catch (x) { $('#loginErr').textContent = x.message; }
});
$('#logout').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }); location.reload(); });
fetch('/api/me').then(r => r.ok && r.json()).then(u => u && start(u));
