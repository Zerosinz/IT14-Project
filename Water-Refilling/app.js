const A = "Owner/Admin",
  S = "Staff",
  D = "Delivery Personnel";
const $ = (s) => document.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs))
    k === "class"
      ? (e.className = v)
      : k.startsWith("on")
        ? e.addEventListener(k.slice(2), v)
        : (e[k] = v);
  kids.flat().forEach((c) => e.append(c ?? ""));
  return e;
};
const api = async (url, o = {}) => {
  const r = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...o,
    body: o.body && JSON.stringify(o.body),
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== "/api/login") location.reload();
  if (!r.ok) throw new Error(d.error || "Something went wrong.");
  return d;
};
const peso = (n) =>
  "₱" + (Number(n) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 });
const MONEY = [
  "total",
  "total_amount",
  "gross_salary",
  "deductions",
  "net_salary",
  "amount",
  "unit_price",
];
const fmt = (c, v) =>
  v == null
    ? ""
    : c === "delivery_required"
      ? +v
        ? "Yes"
        : "No"
      : MONEY.includes(c)
        ? peso(v)
        : v;
const YN = [
  ["1", "Yes"],
  ["0", "No"],
];
const cust = ["customers", "customer_id", (r) => r.customer_name];
const emp = ["employees", "employee_id", (r) => r.full_name];

// Field: [name, label, type, extra, newOnly]. Types: text, textarea, number, date, datetime, password, select (extra = options), ref (extra = [endpoint, key, label fn])
const M = [
  { k: "dashboard", t: "Dashboard", r: [A, S], run: dash },
  {
    k: "customers",
    t: "Customers",
    r: [A, S],
    w: [A, S],
    c: ["customer_id", "customer_name", "contact_number", "address", "notes"],
    f: [
      ["customer_name", "Name", "text"],
      ["contact_number", "Contact number", "text"],
      ["address", "Address", "textarea"],
      ["notes", "Notes", "textarea"],
    ],
  },
  {
    k: "orders",
    t: "Orders",
    r: [A, S],
    w: [A, S],
    c: [
      "order_id",
      "order_date",
      "customer_name",
      "order_channel",
      "delivery_required",
      "order_status",
      "total",
    ],
    f: [
      ["customer_id", "Customer", "ref", cust],
      [
        "order_channel",
        "Order channel",
        "select",
        ["Call", "Message", "Walk-in"],
      ],
      ["delivery_required", "Delivery needed?", "select", YN],
      ["delivery_address", "Delivery address", "textarea"],
      [
        "product_id",
        "Product",
        "ref",
        [
          "products",
          "product_id",
          (r) =>
            `${r.product_name} (${r.size_or_type}) ${peso(r.unit_price)}${r.stock_qty != null ? ", " + r.stock_qty + " in stock" : ""}`,
        ],
        1,
      ],
      ["quantity", "Quantity", "number", null, 1],
      [
        "order_status",
        "Status",
        "select",
        ["Pending", "Confirmed", "Preparing", "Completed", "Cancelled"],
      ],
      ["notes", "Notes", "textarea"],
    ],
  },
  {
    k: "deliveries",
    t: "Deliveries",
    r: [A, S, D],
    w: [A, S, D],
    add: [A, S],
    c: [
      "delivery_id",
      "customer_name",
      "delivery_address",
      "employee",
      "scheduled_at",
      "delivery_status",
      "remarks",
    ],
    f: [
      [
        "order_id",
        "Order",
        "ref",
        ["orders", "order_id", (r) => `#${r.order_id} ${r.customer_name}`],
      ],
      ["assigned_employee_id", "Assigned delivery personnel", "ref", emp],
      ["scheduled_at", "Scheduled date and time", "datetime"],
      [
        "delivery_status",
        "Status",
        "select",
        ["Scheduled", "Out for delivery", "Delivered", "Rescheduled"],
      ],
      ["remarks", "Remarks", "textarea"],
    ],
  },
  {
    k: "gallon_transactions",
    t: "Gallon ledger",
    r: [A, S, D],
    w: [A, S, D],
    c: [
      "gallon_txn_id",
      "transaction_date",
      "customer_name",
      "transaction_type",
      "quantity",
      "remarks",
    ],
    after: balances,
    f: [
      ["customer_id", "Customer", "ref", cust],
      ["transaction_type", "Type", "select", ["Borrow", "Return"]],
      ["quantity", "Number of gallons", "number"],
      ["remarks", "Remarks", "textarea"],
    ],
  },
  {
    k: "sales",
    t: "Sales",
    r: [A, S],
    w: [A, S],
    c: [
      "sale_id",
      "sale_date",
      "customer_name",
      "total_amount",
      "payment_status",
      "payment_method",
    ],
    f: [
      [
        "order_id",
        "Linked order (optional)",
        "ref",
        [
          "orders",
          "order_id",
          (r) => `#${r.order_id} ${r.customer_name} ${peso(r.total)}`,
        ],
      ],
      ["total_amount", "Amount (blank = total of linked order)", "number"],
      [
        "payment_status",
        "Payment status",
        "select",
        ["Paid", "Unpaid", "Partial"],
      ],
      ["payment_method", "Payment method", "text"],
    ],
  },
  {
    k: "complaints",
    t: "Customer concerns",
    r: [A, S],
    w: [A, S],
    c: [
      "complaint_id",
      "received_at",
      "customer_name",
      "category",
      "description",
      "handler",
      "status",
    ],
    f: [
      ["customer_id", "Customer", "ref", cust],
      [
        "category",
        "Category",
        "select",
        [
          "Gallon cleanliness",
          "Delivery concern",
          "Water quality",
          "Billing",
          "Other",
        ],
      ],
      ["description", "Concern details", "textarea"],
      ["resolution", "Action taken / resolution", "textarea"],
      ["status", "Status", "select", ["Open", "In progress", "Resolved"]],
    ],
  },
  { k: "chats", t: "Chat inbox", r: [A, S], run: chats },
  { k: "reports", t: "Reports", r: [A, S], run: reports },
  {
    k: "products",
    t: "Inventory and prices",
    r: [A, S],
    w: [A],
    c: [
      "product_id",
      "product_name",
      "size_or_type",
      "unit_price",
      "stock_qty",
      "reorder_level",
      "stock_status",
      "status",
    ],
    f: [
      ["product_name", "Product name", "text"],
      ["size_or_type", "Size / type", "text"],
      ["unit_price", "Unit price", "number"],
      ["stock_qty", "Stock on hand (leave blank if not tracked)", "number"],
      ["reorder_level", "Warn me when stock is at or below", "number"],
      ["status", "Status", "select", ["Active", "Inactive"]],
    ],
  },
  {
    k: "employees",
    t: "Employees",
    r: [A],
    w: [A],
    c: [
      "employee_id",
      "full_name",
      "contact_number",
      "job_title",
      "employment_status",
    ],
    f: [
      ["full_name", "Full name", "text"],
      ["contact_number", "Contact number", "text"],
      ["job_title", "Job title", "text"],
      ["employment_status", "Status", "select", ["Active", "Inactive"]],
    ],
  },
  {
    k: "salary_records",
    t: "Salaries",
    r: [A],
    w: [A],
    c: [
      "salary_record_id",
      "employee",
      "pay_period_start",
      "pay_period_end",
      "gross_salary",
      "deductions",
      "net_salary",
      "payment_status",
    ],
    f: [
      ["employee_id", "Employee", "ref", emp],
      ["pay_period_start", "Period start", "date"],
      ["pay_period_end", "Period end", "date"],
      ["gross_salary", "Gross salary", "number"],
      ["deductions", "Deductions", "number"],
      ["date_paid", "Date paid", "date"],
      ["payment_status", "Payment status", "select", ["Pending", "Paid"]],
    ],
  },
  {
    k: "expenses",
    t: "Expenses",
    r: [A],
    w: [A],
    c: ["expense_id", "expense_date", "category", "description", "amount"],
    f: [
      ["expense_date", "Date", "date"],
      ["category", "Category", "text"],
      ["description", "Description", "textarea"],
      ["amount", "Amount", "number"],
    ],
  },
  // LOGO: owner uploads the business logo on this page (see settings() below)
  { k: "settings", t: "Business settings", r: [A], run: settings },
  {
    k: "users",
    t: "User management",
    r: [A],
    w: [A],
    c: ["user_id", "full_name", "username", "role", "account_status"],
    f: [
      ["full_name", "Full name", "text"],
      ["username", "Username", "text"],
      ["password", "Password (leave blank to keep current)", "password"],
      ["role", "Role", "select", [A, S, D]],
      ["account_status", "Account status", "select", ["Active", "Inactive"]],
      [
        "employee_id",
        "Linked employee (needed for delivery personnel)",
        "ref",
        emp,
      ],
    ],
  },
];

let user, timer;
const ICON = {
  dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  customers:
    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  orders:
    "M9 2h6v4H9zM9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3M9 12h6M9 16h6",
  deliveries:
    "M1 3h15v13H1zM16 8h4l3 3v5h-7zM5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  gallon_transactions:
    "M12 2.7s7 7.2 7 12.3a7 7 0 0 1-14 0C5 9.9 12 2.7 12 2.7z",
  sales: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  complaints:
    "M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  chats: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  reports: "M18 20V10M12 20V4M6 20v-6",
  products: "M21 16V8l-9-5-9 5v8l9 5zM3.3 7L12 12l8.7-5M12 22V12",
  employees: "M2 7h20v14H2zM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",
  salary_records: "M1 4h22v16H1zM1 10h22",
  expenses: "M23 18l-9.500-9.500-5 5L1 6M17 18h6v-6",
  users: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  settings:
    "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v6l4 2",
};
const ico = (k) =>
  h("span", {
    class: "ico",
    innerHTML: `<svg viewBox="0 0 24 24"><path d="${ICON[k]}"/></svg>`,
  });
// color palettes and dark mode (saved in this browser)
const root = document.documentElement;
const SUN =
    "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  MOON = "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z";
const setTheme = (t) => {
  root.dataset.theme = t;
  localStorage.setItem("rw-theme", t);
  document
    .querySelectorAll(".pal button")
    .forEach((b) => b.setAttribute("aria-pressed", b.dataset.t === t));
};
const setMode = (m) => {
  root.dataset.mode = m;
  root.dataset.bsTheme = m;
  localStorage.setItem("rw-mode", m);
  document
    .querySelectorAll(".js-mode .ico")
    .forEach(
      (i) =>
        (i.innerHTML = `<svg viewBox="0 0 24 24"><path d="${m === "dark" ? SUN : MOON}"/></svg>`),
    );
};
const closePal = () =>
  document.querySelectorAll(".pal").forEach((p) => {
    p.hidden = true;
    p.previousElementSibling.setAttribute("aria-expanded", "false");
  });
// BUTTON 1 (light/dark) and BUTTON 2 (color palette list). They appear on the login screen and in the top bar.
document
  .querySelectorAll(".js-mode")
  .forEach((b) =>
    b.addEventListener("click", () =>
      setMode(root.dataset.mode === "dark" ? "light" : "dark"),
    ),
  );
document.querySelectorAll(".js-color").forEach((b) =>
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    const p = b.nextElementSibling,
      open = p.hidden;
    closePal();
    p.hidden = !open;
    b.setAttribute("aria-expanded", String(open));
  }),
);
document.querySelectorAll(".pal button").forEach((b) =>
  b.addEventListener("click", () => {
    setTheme(b.dataset.t);
    closePal();
  }),
);
document.addEventListener("click", closePal);
document.addEventListener("keydown", (e) => e.key === "Escape" && closePal());
setTheme(localStorage.getItem("rw-theme") || "ocean");
setMode(localStorage.getItem("rw-mode") || "light");
const GROUP = {
  customers: "Daily work",
  orders: "Daily work",
  deliveries: "Daily work",
  gallon_transactions: "Daily work",
  sales: "Daily work",
  complaints: "Support",
  chats: "Support",
  reports: "Business",
  settings: "Business",
  products: "Business",
  employees: "Business",
  salary_records: "Business",
  expenses: "Business",
  users: "Business",
};
const put = (k, id, b) => ["PUT", `${k}/${id}`, b];
// Quick actions per module: [label, request, show-when, toast]
const QUICK = {
  orders: [
    [
      "Complete",
      (r) => put("orders", r.order_id, { order_status: "Completed" }),
      (r) => !/Completed|Cancelled/.test(r.order_status),
      "Order completed.",
    ],
    [
      "Cancel order",
      (r) => put("orders", r.order_id, { order_status: "Cancelled" }),
      (r) => !/Completed|Cancelled/.test(r.order_status),
      "Order cancelled. Stock returned.",
      "btn-outline-danger",
    ],
    [
      "Create sale",
      (r) => [
        "POST",
        "sales",
        { order_id: r.order_id, payment_status: "Unpaid" },
      ],
      null,
      "Sale created from order.",
    ],
    [
      "Schedule delivery",
      (r) => ["POST", "deliveries", { order_id: r.order_id }],
      (r) => +r.delivery_required,
      "Delivery scheduled.",
    ],
  ],
  deliveries: [
    [
      "Start trip",
      (r) =>
        put("deliveries", r.delivery_id, {
          delivery_status: "Out for delivery",
        }),
      (r) => r.delivery_status === "Scheduled",
      "Trip started.",
    ],
    [
      "Mark delivered",
      (r) => put("deliveries", r.delivery_id, { delivery_status: "Delivered" }),
      (r) => r.delivery_status !== "Delivered",
      "Marked as delivered.",
    ],
  ],
  sales: [
    [
      "Mark paid",
      (r) => put("sales", r.sale_id, { payment_status: "Paid" }),
      (r) => r.payment_status !== "Paid",
      "Marked as paid.",
    ],
  ],
  complaints: [
    [
      "Resolve",
      (r) => put("complaints", r.complaint_id, { status: "Resolved" }),
      (r) => r.status !== "Resolved",
      "Concern resolved.",
    ],
  ],
};
const label = (c) => {
  const s = c.replace(/_/g, " ");
  return s[0].toUpperCase() + s.slice(1);
};
const pill = (v) =>
  h(
    "span",
    {
      class:
        "pill " +
        (/^(Completed|Paid|Delivered|Resolved|Active|Return|In stock)$/.test(v)
          ? "ok"
          : /^(Cancelled|Inactive|Out of stock)$/.test(v)
            ? "bad"
            : /^(Pending|Unpaid|Open|Scheduled|Rescheduled|Borrow|Low stock)$/.test(
                  v,
                )
              ? "warn"
              : "info"),
    },
    v,
  );
function toast(msg, bad) {
  const t = h(
    "div",
    { class: "toast-x" + (bad ? " bad" : ""), role: "status" },
    msg,
  );
  $("#toasts").append(t);
  setTimeout(() => t.remove(), 3500);
}
const ask = (msg) =>
  new Promise((res) => {
    const d = h(
      "dialog",
      { class: "modal-x small" },
      h("p", {}, msg),
      h(
        "div",
        { class: "d-flex gap-2 justify-content-end" },
        h(
          "button",
          { class: "btn btn-outline-secondary", onclick: () => d.close("no") },
          "Keep it",
        ),
        h(
          "button",
          { class: "btn btn-danger", onclick: () => d.close("yes") },
          "Delete",
        ),
      ),
    );
    d.addEventListener("close", () => {
      res(d.returnValue === "yes");
      d.remove();
    });
    document.body.append(d);
    d.showModal();
  });
const isoDay = (d) =>
  new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

function start(u) {
  user = u;
  $("#login").hidden = true;
  $("#app").hidden = false;
  $("#who").textContent = u.name;
  $("#role").textContent = u.role;
  $("#av").textContent = u.name[0];
  const mods = M.filter((m) => m.r.includes(u.role)),
    items = [];
  let g = "";
  mods.forEach((m) => {
    const gg = GROUP[m.k] || "";
    if (gg && gg !== g) items.push(h("div", { class: "nav-group" }, gg));
    g = gg;
    items.push(
      h(
        "a",
        {
          href: "#",
          k: m.k,
          class: "nav-link-x",
          onclick: (e) => {
            e.preventDefault();
            show(m);
          },
        },
        ico(m.k),
        m.t,
      ),
    );
  });
  $("#nav").replaceChildren(...items);
  show(u.role === D ? M.find((m) => m.k === "deliveries") : mods[0]);
}

async function show(m) {
  clearInterval(timer);
  const el = $("#main");
  $("#crumb").textContent = m.t;
  document.title = m.t + " · Roderos Water";
  el.replaceChildren(h("div", { class: "page-head" }, h("h2", {}, m.t)));
  document
    .querySelectorAll("#nav a")
    .forEach((a) => a.classList.toggle("active", a.k === m.k));
  try {
    m.run ? await m.run(el) : await crud(m, el);
  } catch (e) {
    el.append(h("div", { class: "alert alert-danger" }, e.message));
  }
}

async function crud(m, el) {
  const rows = await api("/api/t/" + m.k),
    pk = m.c[0];
  const limited = user.role === D && m.k === "deliveries"; // delivery personnel may only change status and remarks
  const fields = m.f.filter(
    (f) => !limited || ["delivery_status", "remarks"].includes(f[0]),
  );
  const refs = {};
  await Promise.all(
    fields
      .filter((f) => f[2] === "ref")
      .map(async (f) => (refs[f[0]] = await api("/api/t/" + f[3][0]))),
  );
  const canEdit = m.w.includes(user.role),
    canAdd = (m.add || m.w).includes(user.role);
  const st = { q: "", f: "", col: null, dir: 1 },
    sc = m.c.find((c) => /status/.test(c));
  const slot = h("div");

  function openForm(row) {
    const inputs = {},
      err = h("div", { class: "text-danger small mb-2", role: "alert" });
    const field = ([n, l, t, x, newOnly]) => {
      if (row && newOnly) return "";
      let i;
      if (t === "textarea")
        i = h("textarea", { class: "form-control", rows: 2 });
      else if (t === "select" || t === "ref") {
        i = h("select", { class: "form-select" });
        i.add(new Option("", ""));
        (t === "ref"
          ? refs[n].map((r) => [r[x[1]], x[2](r)])
          : x.map((o) => (Array.isArray(o) ? o : [o, o]))
        ).forEach(([v, lb]) => i.add(new Option(lb, v)));
      } else
        i = h("input", {
          class: "form-control",
          type:
            {
              number: "number",
              date: "date",
              datetime: "datetime-local",
              password: "password",
            }[t] || "text",
        });
      if (t === "number") i.step = "any";
      if (row && row[n] != null && t !== "password")
        i.value =
          t === "datetime"
            ? String(row[n]).replace(" ", "T").slice(0, 16)
            : row[n];
      inputs[n] = i;
      return h(
        "div",
        { class: t === "textarea" ? "col-12" : "col-md-6" },
        h("label", { class: "form-label" }, l),
        i,
      );
    };
    const d = h("dialog", { class: "modal-x" }),
      form = h(
        "form",
        {
          onsubmit: async (e) => {
            e.preventDefault();
            const body = Object.fromEntries(
              Object.entries(inputs).map(([n, i]) => [n, i.value]),
            );
            try {
              await api("/api/t/" + m.k + (row ? "/" + row[pk] : ""), {
                method: row ? "PUT" : "POST",
                body,
              });
              d.close();
              toast(row ? "Changes saved." : "Record added.");
              show(m);
            } catch (x) {
              err.textContent = x.message;
            }
          },
        },
        h("h3", { class: "h5 mb-3" }, row ? "Edit record" : "New record"),
        h("div", { class: "row g-3 mb-3" }, fields.map(field)),
        err,
        h(
          "div",
          { class: "d-flex gap-2 justify-content-end" },
          h(
            "button",
            {
              type: "button",
              class: "btn btn-outline-secondary",
              onclick: () => d.close(),
            },
            "Cancel",
          ),
          h(
            "button",
            { class: "btn btn-primary" },
            row ? "Save changes" : "Add record",
          ),
        ),
      );
    if (inputs.customer_id && inputs.delivery_address && !row)
      inputs.customer_id.addEventListener("change", () => {
        // fill the address from the customer record
        const c = refs.customer_id.find(
          (x) => x.customer_id == inputs.customer_id.value,
        );
        if (c && !inputs.delivery_address.value)
          inputs.delivery_address.value = c.address || "";
      });
    d.append(form);
    d.addEventListener("close", () => d.remove());
    document.body.append(d);
    d.showModal();
  }

  const visible = () => {
    const q = st.q,
      v = rows.filter(
        (r) =>
          (!st.f || r[sc] === st.f) &&
          (!q ||
            m.c.some((c) =>
              String(r[c] ?? "")
                .toLowerCase()
                .includes(q),
            )),
      );
    if (st.col)
      v.sort(
        (a, b) =>
          st.dir *
          String(a[st.col] ?? "").localeCompare(
            String(b[st.col] ?? ""),
            undefined,
            { numeric: true },
          ),
      );
    return v;
  };
  const doQuick = async (qa, r) => {
    const [method, p, body] = qa[1](r);
    try {
      await api("/api/t/" + p, { method, body });
      toast(qa[3]);
      show(m);
    } catch (x) {
      toast(x.message, 1);
    }
  };
  const actions = (r) =>
    h(
      "td",
      {},
      h(
        "div",
        { class: "act" },
        m.k === "products" && r.stock_qty != null
          ? h(
              "button",
              { class: "btn btn-sm btn-primary", onclick: () => adjust(r) },
              "Adjust stock",
            )
          : "",
        ...(canEdit
          ? (QUICK[m.k] || [])
              .filter((qa) => !qa[2] || qa[2](r))
              .map((qa) =>
                h(
                  "button",
                  {
                    class: "btn btn-sm " + (qa[4] || "btn-primary"),
                    onclick: () => doQuick(qa, r),
                  },
                  qa[0],
                ),
              )
          : []),
        canEdit
          ? h(
              "button",
              {
                class: "btn btn-sm btn-outline-primary",
                onclick: () => openForm(r),
              },
              "Edit",
            )
          : "",
        user.role === A
          ? h(
              "button",
              {
                class: "btn btn-sm btn-outline-danger",
                onclick: async () => {
                  if (
                    !(await ask("Delete this record? This cannot be undone."))
                  )
                    return;
                  try {
                    await api(`/api/t/${m.k}/${r[pk]}`, { method: "DELETE" });
                    toast("Record deleted.");
                    show(m);
                  } catch (x) {
                    toast(x.message, 1);
                  }
                },
              },
              "Delete",
            )
          : "",
      ),
    );
  const adjust = (r) => {
    // add (+) or remove (-) stock without opening the full edit form
    const n = h("input", {
        class: "form-control",
        type: "number",
        step: 1,
        required: true,
        "aria-label": "Change in stock",
      }),
      err = h("div", { class: "text-danger small mt-2", role: "alert" });
    const d = h(
      "dialog",
      { class: "modal-x small" },
      h(
        "form",
        {
          onsubmit: async (e) => {
            e.preventDefault();
            try {
              await api("/api/stock/" + r.product_id, {
                method: "POST",
                body: { change: n.value },
              });
              d.close();
              toast("Stock updated.");
              show(m);
            } catch (x) {
              err.textContent = x.message;
            }
          },
        },
        h("h3", { class: "h5" }, `${r.product_name} (${r.size_or_type || ""})`),
        h(
          "p",
          { class: "muted" },
          `On hand: ${r.stock_qty}. Enter a positive number to add stock, or a negative number to remove it.`,
        ),
        n,
        err,
        h(
          "div",
          { class: "d-flex gap-2 justify-content-end mt-3" },
          h(
            "button",
            {
              type: "button",
              class: "btn btn-outline-secondary",
              onclick: () => d.close(),
            },
            "Cancel",
          ),
          h("button", { class: "btn btn-primary" }, "Update stock"),
        ),
      ),
    );
    d.addEventListener("close", () => d.remove());
    document.body.append(d);
    d.showModal();
  };
  const draw = () => {
    const v = visible();
    slot.replaceChildren(
      table(
        m.c,
        v,
        canEdit || user.role === A || m.k === "products" ? actions : null,
        {
          sort: st.col,
          dir: st.dir,
          onSort: (c) => {
            st.dir = st.col === c ? -st.dir : 1;
            st.col = c;
            draw();
          },
        },
      ),
      h("div", { class: "count" }, `Showing ${v.length} of ${rows.length}`),
    );
  };
  const exportCsv = () => {
    const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const t = [m.c.map(label), ...visible().map((r) => m.c.map((c) => r[c]))]
      .map((r) => r.map(q).join(","))
      .join("\n");
    h("a", {
      href: URL.createObjectURL(new Blob(["\ufeff" + t], { type: "text/csv" })),
      download: m.k + ".csv",
    }).click();
  };
  const low =
    m.k === "products"
      ? rows.filter((r) => /^(Low|Out)/.test(r.stock_status))
      : [];
  if (low.length)
    el.append(
      h(
        "div",
        { class: "alert-low", role: "alert" },
        h(
          "b",
          {},
          `${low.length} ${low.length > 1 ? "items need" : "item needs"} restocking: `,
        ),
        low
          .map((r) => `${r.product_name} (${r.size_or_type || ""})`)
          .join(", ") + ".",
      ),
    );
  el.append(
    h(
      "div",
      { class: "toolbar no-print" },
      h("input", {
        class: "form-control",
        type: "search",
        placeholder: "Search " + m.t.toLowerCase(),
        "aria-label": "Search",
        oninput: (e) => {
          st.q = e.target.value.toLowerCase();
          draw();
        },
      }),
      sc
        ? h(
            "select",
            {
              class: "form-select",
              "aria-label": "Filter by status",
              onchange: (e) => {
                st.f = e.target.value;
                draw();
              },
            },
            h("option", { value: "" }, "All statuses"),
            ...[...new Set(rows.map((r) => r[sc]).filter(Boolean))].map((v) =>
              h("option", { value: v }, v),
            ),
          )
        : "",
      h("span", { class: "grow" }),
      h(
        "button",
        { class: "btn btn-outline-secondary", onclick: exportCsv },
        "Export CSV",
      ),
      canAdd
        ? h(
            "button",
            { class: "btn btn-primary", onclick: () => openForm() },
            "Add new",
          )
        : "",
    ),
    slot,
  );
  draw();
  if (m.after) await m.after(el);
}

function table(cols, rows, actions, o = {}) {
  const th = (c) =>
    h(
      "th",
      {
        class: o.onSort ? "sortable" : "",
        ...(o.onSort ? { onclick: () => o.onSort(c) } : {}),
      },
      label(c) + (o.sort === c ? (o.dir > 0 ? " ↑" : " ↓") : ""),
    );
  const cell = (r, c) =>
    h(
      "td",
      { class: MONEY.includes(c) ? "num" : "" },
      /status|transaction_type/.test(c) && r[c]
        ? pill(r[c])
        : String(fmt(c, r[c])),
    );
  return h(
    "div",
    { class: "tbl-card" },
    h(
      "div",
      { class: "table-responsive" },
      h(
        "table",
        { class: "table tbl" },
        h("thead", {}, h("tr", {}, cols.map(th), actions ? h("th") : "")),
        h(
          "tbody",
          {},
          rows.length
            ? rows.map((r) =>
                h(
                  "tr",
                  {},
                  cols.map((c) => cell(r, c)),
                  actions ? actions(r) : "",
                ),
              )
            : h(
                "tr",
                {},
                h(
                  "td",
                  { colSpan: cols.length + 1 },
                  h(
                    "div",
                    { class: "empty" },
                    "Nothing here yet. Add a record or change your search.",
                  ),
                ),
              ),
        ),
      ),
    ),
  );
}

async function balances(el) {
  const rows = await api("/api/gallon-balance");
  el.append(
    h("h3", { class: "h5 mt-4 mb-3" }, "Outstanding gallons per customer"),
    table(["customer_name", "borrowed", "returned", "outstanding"], rows),
  );
}

async function dash(el) {
  const [d, sales, orders, cs, prods] = await Promise.all([
    api("/api/dashboard"),
    api("/api/t/sales"),
    api("/api/t/orders"),
    api("/api/t/complaints"),
    api("/api/t/products"),
  ]);
  const days = [...Array(7)].map(
    (_, i) => new Date(Date.now() - (6 - i) * 864e5),
  );
  const tot = days.map((x) =>
      sales
        .filter((s) => (s.sale_date || "").startsWith(isoDay(x)))
        .reduce((a, s) => a + Number(s.total_amount), 0),
    ),
    max = Math.max(...tot, 1);
  const stat = (l, v, k, t) =>
    h(
      "div",
      { class: "stat" },
      h("div", { class: "tile", style: "--t:" + t }, ico(k)),
      h("div", {}, h("span", {}, l), h("b", {}, v)),
    );
  const go = (k) => () => show(M.find((m) => m.k === k));
  const list = (title, items, k, line) =>
    h(
      "div",
      { class: "panel" },
      h("h3", {}, title),
      items.length
        ? items
            .slice(0, 5)
            .map((i) => h("div", { class: "row-link" }, ...line(i)))
        : h("p", { class: "muted mb-0" }, "All clear."),
      h(
        "button",
        { class: "btn btn-sm btn-outline-primary mt-3", onclick: go(k) },
        "Open " + M.find((m) => m.k === k).t.toLowerCase(),
      ),
    );
  el.append(
    h(
      "p",
      { class: "muted" },
      new Date().toLocaleDateString("en-PH", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    ),
    h(
      "div",
      { class: "stats" },
      stat("Sales today", peso(d.sales_today), "sales", "#16a34a"),
      stat("Pending orders", d.pending_orders, "orders", "#d97706"),
      stat("Active deliveries", d.pending_deliveries, "deliveries", "#2563eb"),
      stat(
        "Gallons not yet returned",
        d.gallons_out,
        "gallon_transactions",
        "#0891b2",
      ),
      stat("Unresolved concerns", d.open_concerns, "complaints", "#e11d48"),
      stat("Low-stock items", d.low_stock, "products", "#ea580c"),
      d.expenses_month !== undefined
        ? stat(
            "Expenses this month",
            peso(d.expenses_month),
            "expenses",
            "#7c3aed",
          )
        : "",
    ),
    h(
      "div",
      { class: "dash-grid" },
      h(
        "div",
        { class: "panel" },
        h(
          "h3",
          {},
          `Sales, last 7 days: ${peso(tot.reduce((a, b) => a + b, 0))}`,
        ),
        h(
          "div",
          {
            class: "chart",
            role: "img",
            "aria-label": "Bar chart of daily sales for the last 7 days",
          },
          days.map((x, i) =>
            h(
              "div",
              { class: "bar" + (i === 6 ? " today" : "") },
              h("span", {}, tot[i] ? "₱" + Math.round(tot[i]) : ""),
              h(
                "div",
                { class: "bar-track" },
                h("i", { style: `height:${(tot[i] / max) * 100}%` }),
              ),
              h(
                "span",
                {},
                x.toLocaleDateString("en-PH", { weekday: "short" }),
              ),
            ),
          ),
        ),
      ),
      h(
        "div",
        { class: "d-grid gap-3" },
        list(
          "Orders waiting",
          orders.filter((o) => o.order_status === "Pending"),
          "orders",
          (o) => [`#${o.order_id} ${o.customer_name}`, peso(o.total)],
        ),
        list(
          "Open concerns",
          cs.filter((c) => c.status !== "Resolved"),
          "complaints",
          (c) => [c.customer_name, pill(c.status)],
        ),
        list(
          "Low stock",
          prods.filter((p) => /^(Low|Out)/.test(p.stock_status)),
          "products",
          (p) => [
            `${p.product_name} (${p.size_or_type || ""})`,
            pill(p.stock_status),
          ],
        ),
      ),
    ),
  );
}

// ===== LOGO UPLOAD (Owner > Business settings) =====
// The owner picks an image, it is shrunk to max 256px in the browser, then saved on the server (POST /api/logo).
// The logo then shows automatically at: login screen, sidebar, customer chat page (all load <img src="/logo">).
// To use it next time: sign in as owner, open Business settings, choose the logo file, press Upload logo.
async function settings(el) {
  const pick = (f) =>
    new Promise((ok, no) => {
      const r = new FileReader();
      r.onload = () => {
        const i = new Image();
        i.onload = () => {
          const k = Math.min(1, 256 / Math.max(i.width, i.height)),
            c = document.createElement("canvas");
          c.width = Math.round(i.width * k);
          c.height = Math.round(i.height * k);
          c.getContext("2d").drawImage(i, 0, 0, c.width, c.height);
          ok(c.toDataURL("image/png"));
        };
        i.onerror = () => no(new Error("That file is not a valid image."));
        i.src = r.result;
      };
      r.readAsDataURL(f);
    });
  const file = h("input", {
    type: "file",
    accept: "image/png,image/jpeg,image/webp",
    class: "form-control",
    "aria-label": "Logo file",
  });
  const prev = h("img", {
    class: "logo-prev",
    src: "/logo?v=" + Date.now(),
    alt: "Current logo",
    onerror: (e) =>
      e.target.replaceWith(
        h("div", { class: "logo-prev none" }, "No logo yet"),
      ),
  });
  const upload = async () => {
    if (!file.files[0]) return toast("Choose an image first.", 1);
    try {
      await api("/api/logo", {
        method: "POST",
        body: { url: await pick(file.files[0]) },
      });
      toast("Logo saved.");
      setTimeout(() => location.reload(), 600);
    } catch (x) {
      toast(x.message, 1);
    }
  };
  const remove = async () => {
    if (!(await ask("Remove the logo and go back to the default icon?")))
      return;
    await api("/api/logo", { method: "DELETE" });
    toast("Logo removed.");
    setTimeout(() => location.reload(), 600);
  };
  el.append(
    h(
      "div",
      { class: "panel logo-panel" },
      h("h3", {}, "Business logo"),
      h(
        "div",
        { class: "logo-row" },
        prev,
        h(
          "div",
          {},
          h(
            "p",
            { class: "muted" },
            "Best results: a square or wide PNG with a transparent background, at least 256 px. It appears on the login screen, the sidebar and the customer chat page.",
          ),
          file,
          h(
            "div",
            { class: "d-flex gap-2 mt-3" },
            h(
              "button",
              { class: "btn btn-primary", onclick: upload },
              "Upload logo",
            ),
            h(
              "button",
              { class: "btn btn-outline-secondary", onclick: remove },
              "Remove logo",
            ),
          ),
        ),
      ),
    ),
  );
}

async function reports(el) {
  const all = [
    ["sales", "Sales", [A, S]],
    ["orders", "Orders", [A, S]],
    ["deliveries", "Deliveries", [A, S]],
    ["gallons", "Gallon transactions", [A, S]],
    ["complaints", "Customer concerns", [A, S]],
    ["expenses", "Expenses", [A]],
    ["salaries", "Salaries", [A]],
  ].filter((r) => r[2].includes(user.role));
  const type = h(
    "select",
    { class: "form-select" },
    all.map((r) => h("option", { value: r[0] }, r[1])),
  );
  const iso = (d) => d.toISOString().slice(0, 10),
    today = new Date();
  const from = h("input", {
    type: "date",
    class: "form-control",
    value: iso(new Date(today.getFullYear(), today.getMonth(), 1)),
  });
  const to = h("input", {
    type: "date",
    class: "form-control",
    value: iso(today),
  });
  const out = h("div");
  const run = async (e) => {
    e && e.preventDefault();
    try {
      const rows = await api(
        `/api/report/${type.value}?from=${from.value}&to=${to.value}`,
      );
      const sum =
        rows.length &&
        ["total_amount", "amount", "net_salary"].find((k) => k in rows[0]);
      out.replaceChildren(
        h(
          "h3",
          { class: "h5" },
          `${all.find((r) => r[0] === type.value)[1]}: ${from.value} to ${to.value}`,
        ),
        table(rows.length ? Object.keys(rows[0]) : ["no_data"], rows),
        sum
          ? h(
              "p",
              { class: "fw-semibold" },
              `Total ${sum.replace(/_/g, " ")}: ${peso(rows.reduce((a, r) => a + Number(r[sum]), 0))}`,
            )
          : "",
      );
    } catch (x) {
      out.replaceChildren(h("div", { class: "alert alert-danger" }, x.message));
    }
  };
  el.append(
    h(
      "form",
      { class: "row g-2 mb-3 no-print", onsubmit: run },
      h("div", { class: "col-md-3" }, type),
      h("div", { class: "col-md-3" }, from),
      h("div", { class: "col-md-3" }, to),
      h(
        "div",
        { class: "col-md-3" },
        h("button", { class: "btn btn-primary me-2" }, "Generate"),
        h(
          "button",
          {
            type: "button",
            class: "btn btn-outline-secondary",
            onclick: () => print(),
          },
          "Print",
        ),
      ),
    ),
    out,
  );
  run();
}

async function chats(el) {
  let cur,
    g = {};
  const list = h("div", { class: "list-group" }),
    log = h("div", {
      class: "border rounded bg-white p-2 mb-2",
      style: "height:300px;overflow:auto",
    });
  const txt = h("input", {
    class: "form-control",
    placeholder: "Type a reply",
  });
  const form = h(
    "form",
    {
      class: "d-flex gap-2",
      onsubmit: async (e) => {
        e.preventDefault();
        if (!cur) return;
        await api("/api/chats/reply", {
          method: "POST",
          body: { session_id: cur, text: txt.value },
        });
        txt.value = "";
        load();
      },
    },
    txt,
    h("button", { class: "btn btn-primary" }, "Reply"),
  );
  const draw = () => {
    list.replaceChildren(
      ...Object.keys(g)
        .reverse()
        .map((id) =>
          h(
            "button",
            {
              class:
                "list-group-item list-group-item-action" +
                (id === cur ? " active" : ""),
              onclick: () => {
                cur = id;
                draw();
              },
            },
            g[id][0].customer_name,
          ),
        ),
    );
    log.replaceChildren(
      ...(g[cur] || []).map((m) =>
        h(
          "div",
          { class: "mb-1 " + (m.sender === "staff" ? "text-end" : "") },
          h(
            "span",
            {
              class:
                "badge text-wrap " +
                (m.sender === "staff"
                  ? "text-bg-primary"
                  : "text-bg-light border text-dark"),
            },
            m.message,
          ),
        ),
      ),
    );
    log.scrollTop = log.scrollHeight;
  };
  const load = async () => {
    g = {};
    (await api("/api/chats")).forEach((m) =>
      (g[m.session_id] = g[m.session_id] || []).push(m),
    );
    draw();
  };
  el.append(
    h(
      "p",
      { class: "text-muted" },
      "Messages sent from the customer chat page (/chat). To keep a formal record, also add the concern under Customer concerns.",
    ),
    h(
      "div",
      { class: "row g-3" },
      h("div", { class: "col-md-4" }, list),
      h("div", { class: "col-md-8" }, log, form),
    ),
  );
  await load();
  timer = setInterval(() => load().catch(() => {}), 5000);
}

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    start(
      await api("/api/login", {
        method: "POST",
        body: { username: $("#user").value, password: $("#pass").value },
      }),
    );
  } catch (x) {
    $("#loginErr").textContent = x.message;
  }
});
document.querySelectorAll("[data-u]").forEach(
  (b) =>
    (b.onclick = () => {
      $("#user").value = b.dataset.u;
      $("#pass").value = b.dataset.p;
    }),
);
$("#logout").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  location.reload();
});
fetch("/api/me")
  .then((r) => r.ok && r.json())
  .then((u) => u && start(u));
