// Roderos Water Refilling Station Management System: demo version, no database server needed.
// All records are kept in data.json (same tables as the proposal's ERD).
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

const A = "Owner/Admin",
  S = "Staff",
  D = "Delivery Personnel";
const FILE = path.join(__dirname, "data.json");
const PK = {
  users: "user_id",
  employees: "employee_id",
  customers: "customer_id",
  products: "product_id",
  orders: "order_id",
  order_items: "order_item_id",
  deliveries: "delivery_id",
  sales: "sale_id",
  gallon_transactions: "gallon_txn_id",
  complaints: "complaint_id",
  expenses: "expense_id",
  salary_records: "salary_record_id",
  chat_messages: "id",
};

// ---------- Tiny data store ----------
let DB = { seq: {}, t: {} };
try {
  DB = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch (e) {}
DB.seq = DB.seq || {};
DB.t = DB.t || {};
Object.keys(PK).forEach((k) => (DB.t[k] = DB.t[k] || []));
const save = () => fs.writeFileSync(FILE, JSON.stringify(DB, null, 1));
const now = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 6e4)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
const all = (k) => DB.t[k];
const find = (k, id) => all(k).find((r) => r[PK[k]] == id);
const DEF = {
  customers: () => ({ date_added: now() }),
  products: () => ({ status: "Active" }),
  employees: () => ({ employment_status: "Active" }),
  users: () => ({ account_status: "Active" }),
  orders: () => ({
    order_date: now(),
    order_status: "Pending",
    delivery_required: 0,
  }),
  deliveries: () => ({ delivery_status: "Scheduled" }),
  sales: () => ({ sale_date: now(), payment_status: "Unpaid" }),
  gallon_transactions: () => ({ transaction_date: now() }),
  complaints: () => ({ received_at: now(), status: "Open" }),
  salary_records: () => ({ payment_status: "Pending", deductions: 0 }),
};
const ins = (k, row) => {
  const id = (DB.seq[k] || 0) + 1;
  DB.seq[k] = id;
  const clean = Object.fromEntries(
    Object.entries(row).filter(([, v]) => v != null),
  );
  const r = { [PK[k]]: id, ...(DEF[k] ? DEF[k]() : {}), ...clean };
  all(k).push(r);
  save();
  return r;
};

if (!all("users").length) {
  // starter data so every role can be tried right away
  const pw = (p) => bcrypt.hashSync(p, 10);
  const rider = ins("employees", {
    full_name: "Juan Dela Cruz",
    contact_number: "09123456789",
    job_title: "Delivery rider",
  });
  ins("users", {
    full_name: "Sophie Roderos",
    username: "owner",
    password_hash: pw(process.env.ADMIN_PASSWORD || "admin123"),
    role: A,
  });
  ins("users", {
    full_name: "Station Staff",
    username: "staff",
    password_hash: pw("staff123"),
    role: S,
  });
  ins("users", {
    full_name: "Juan Dela Cruz",
    username: "rider",
    password_hash: pw("rider123"),
    role: D,
    employee_id: rider.employee_id,
  });
  ins("products", {
    product_name: "Purified Water Refill",
    size_or_type: "5-gallon",
    unit_price: 25,
  }); // sample prices: confirm with the client
  ins("products", {
    product_name: "Purified Water Refill",
    size_or_type: "3-gallon",
    unit_price: 15,
  });
  ins("customers", {
    customer_name: "Maria Santos",
    contact_number: "09171234567",
    address: "Purok Ipil-Ipil, Visayan Village",
  });
  ins("customers", {
    customer_name: "Pedro Reyes",
    contact_number: "09281234567",
    address: "Visayan Village, Tagum",
  });
  console.log(
    "Demo logins -> owner/admin123 (Owner/Admin), staff/staff123 (Staff), rider/rider123 (Delivery Personnel)",
  );
}

// ---------- App setup ----------
const app = express();
app.use(express.json({ limit: "50kb" }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-this-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", maxAge: 8 * 3600e3 },
  }),
);
[
  ["/", "index.html"],
  ["/app.js", "app.js"],
  ["/chat", "chat.html"],
].forEach(([r, f]) =>
  app.get(r, (q, s) => s.sendFile(path.join(__dirname, f))),
);

const wrap = (fn) => async (q, s) => {
  try {
    await fn(q, s);
  } catch (e) {
    s.status(400).json({ error: e.message });
  }
};
const need =
  (...roles) =>
  (q, s, n) =>
    !q.session.user
      ? s.status(401).json({ error: "Please sign in." })
      : roles.includes(q.session.user.role)
        ? n()
        : s.status(403).json({ error: "Your role cannot do this." });

// ---------- Public customer chat (no login) ----------
app.post(
  "/api/chat",
  wrap((q, s) => {
    const { session_id: id, name, text } = q.body;
    if (!/^[\w-]{8,40}$/.test(id || "") || !String(text || "").trim())
      return s.status(400).json({ error: "Invalid message." });
    ins("chat_messages", {
      session_id: id,
      customer_name: String(name || "Customer").slice(0, 60),
      sender: "customer",
      message: String(text).slice(0, 500),
      created_at: now(),
    });
    s.json({ ok: true });
  }),
);
app.get("/api/chat/:id", (q, s) =>
  s.json(
    all("chat_messages")
      .filter((m) => m.session_id === q.params.id)
      .map(({ sender, message }) => ({ sender, message })),
  ),
);

// ---------- Login ----------
app.post(
  "/api/login",
  wrap((q, s) => {
    const u = all("users").find((x) => x.username === (q.body.username || ""));
    if (
      !u ||
      u.account_status !== "Active" ||
      !bcrypt.compareSync(q.body.password || "", u.password_hash)
    )
      return s.status(401).json({
        error: "Wrong username or password, or the account is inactive.",
      });
    q.session.user = {
      id: u.user_id,
      name: u.full_name,
      role: u.role,
      employee_id: u.employee_id ?? null,
    };
    s.json(q.session.user);
  }),
);
app.post("/api/logout", (q, s) =>
  q.session.destroy(() => s.json({ ok: true })),
);
app.get("/api/me", (q, s) =>
  q.session.user ? s.json(q.session.user) : s.status(401).json({}),
);

// ---------- Record modules ----------
// r = roles that can read, w = roles that can write, by = field that stores the logged-in user, req = required fields
const T = {
  customers: {
    cols: ["customer_name", "contact_number", "address", "notes"],
    r: [A, S, D],
    w: [A, S],
    req: ["customer_name"],
  },
  products: {
    cols: ["product_name", "size_or_type", "unit_price", "status"],
    r: [A, S],
    w: [A],
    req: ["product_name", "unit_price"],
  },
  employees: {
    cols: ["full_name", "contact_number", "job_title", "employment_status"],
    r: [A, S],
    w: [A],
    req: ["full_name"],
  },
  orders: {
    cols: [
      "customer_id",
      "order_channel",
      "delivery_required",
      "delivery_address",
      "order_status",
      "notes",
    ],
    r: [A, S],
    w: [A, S],
    by: "created_by",
    req: ["customer_id"],
  },
  deliveries: {
    cols: [
      "order_id",
      "assigned_employee_id",
      "scheduled_at",
      "delivery_status",
      "remarks",
    ],
    r: [A, S, D],
    w: [A, S, D],
    req: ["order_id"],
  },
  gallon_transactions: {
    cols: ["customer_id", "transaction_type", "quantity", "remarks"],
    r: [A, S, D],
    w: [A, S, D],
    by: "recorded_by",
    req: ["customer_id", "transaction_type", "quantity"],
  },
  sales: {
    cols: ["order_id", "total_amount", "payment_status", "payment_method"],
    r: [A, S],
    w: [A, S],
    by: "recorded_by",
    req: ["total_amount"],
  },
  complaints: {
    cols: ["customer_id", "category", "description", "resolution", "status"],
    r: [A, S],
    w: [A, S],
    by: "handled_by",
    req: ["customer_id", "description"],
  },
  expenses: {
    cols: ["expense_date", "category", "description", "amount"],
    r: [A],
    w: [A],
    by: "recorded_by",
    req: ["expense_date", "amount"],
  },
  salary_records: {
    cols: [
      "employee_id",
      "pay_period_start",
      "pay_period_end",
      "gross_salary",
      "deductions",
      "date_paid",
      "payment_status",
    ],
    r: [A],
    w: [A],
    by: "recorded_by",
    req: ["employee_id", "gross_salary"],
  },
  users: {
    cols: ["full_name", "username", "role", "account_status", "employee_id"],
    r: [A],
    w: [A],
    req: ["full_name", "username", "role"],
  },
};
const NUM = new Set([
  "customer_id",
  "employee_id",
  "assigned_employee_id",
  "order_id",
  "product_id",
  "delivery_required",
  "unit_price",
  "quantity",
  "total_amount",
  "amount",
  "gross_salary",
  "deductions",
]);
const UNIQ = {
  users: ["username"],
  deliveries: ["order_id"],
  sales: ["order_id"],
};
const REFS = {
  customers: [
    ["orders", "customer_id"],
    ["gallon_transactions", "customer_id"],
    ["complaints", "customer_id"],
  ],
  employees: [
    ["deliveries", "assigned_employee_id"],
    ["salary_records", "employee_id"],
    ["users", "employee_id"],
  ],
  products: [["order_items", "product_id"]],
  orders: [
    ["deliveries", "order_id"],
    ["sales", "order_id"],
  ],
};

const cn = (id) => (find("customers", id) || {}).customer_name;
const byDate = (f) => (a, b) => (b[f] || "").localeCompare(a[f] || "");
const LIST = {
  customers: () => [...all("customers")].reverse(),
  products: () =>
    [...all("products")].sort((a, b) =>
      a.product_name.localeCompare(b.product_name),
    ),
  employees: () =>
    [...all("employees")].sort((a, b) =>
      a.full_name.localeCompare(b.full_name),
    ),
  orders: () =>
    all("orders")
      .map((o) => ({
        ...o,
        customer_name: cn(o.customer_id),
        total: all("order_items")
          .filter((i) => i.order_id === o.order_id)
          .reduce((a, i) => a + i.line_total, 0),
      }))
      .reverse(),
  deliveries: (u) =>
    all("deliveries")
      .filter(
        (d) =>
          u.role !== D ||
          (u.employee_id != null && d.assigned_employee_id === u.employee_id),
      ) // delivery staff see assigned records only
      .map((d) => {
        const o = find("orders", d.order_id) || {},
          e = find("employees", d.assigned_employee_id);
        return {
          ...d,
          customer_name: cn(o.customer_id),
          delivery_address: o.delivery_address,
          employee: e && e.full_name,
        };
      })
      .sort(byDate("scheduled_at")),
  gallon_transactions: () =>
    all("gallon_transactions")
      .map((g) => ({ ...g, customer_name: cn(g.customer_id) }))
      .reverse(),
  sales: () =>
    all("sales")
      .map((x) => ({
        ...x,
        customer_name: cn((find("orders", x.order_id) || {}).customer_id),
      }))
      .reverse(),
  complaints: () =>
    all("complaints")
      .map((c) => ({
        ...c,
        customer_name: cn(c.customer_id),
        handler: (find("users", c.handled_by) || {}).full_name,
      }))
      .reverse(),
  expenses: () =>
    [...all("expenses")].sort(
      (a, b) =>
        b.expense_date.localeCompare(a.expense_date) ||
        b.expense_id - a.expense_id,
    ),
  salary_records: () =>
    all("salary_records")
      .map((r) => ({
        ...r,
        employee: (find("employees", r.employee_id) || {}).full_name,
      }))
      .reverse(),
  users: () => all("users").map(({ password_hash, ...u }) => u),
};

const guard = (m) => (q, s, n) => {
  const t = T[q.params.k];
  if (!t) return s.status(404).json({ error: "Unknown module." });
  q.t = t;
  need(...t[m])(q, s, n);
};
const pick = (b, cols) => {
  const f = {};
  cols.forEach((c) => {
    if (!(c in b)) return;
    let v = b[c] === "" ? null : b[c];
    if (v != null && NUM.has(c)) {
      v = Number(v);
      if (isNaN(v)) throw new Error("Enter a valid number.");
    }
    f[c] = v;
  });
  return f;
};

function prep(k, f, b, isNew) {
  if (k === "users") {
    if (f.role && ![A, S, D].includes(f.role))
      throw new Error("Choose a valid role.");
    if (b.password) f.password_hash = bcrypt.hashSync(b.password, 10);
    else if (isNew) throw new Error("Password is required.");
  }
  if (k === "salary_records")
    f.net_salary = (f.gross_salary || 0) - (f.deductions || 0);
  if (k === "complaints" && f.status)
    f.resolved_at = f.status === "Resolved" ? now() : null;
  if (k === "deliveries" && f.delivery_status === "Delivered")
    f.delivered_at = now();
  if (k === "sales" && isNew && !f.total_amount) {
    if (!f.order_id) throw new Error("Enter an amount or link an order.");
    f.total_amount = all("order_items")
      .filter((i) => i.order_id === f.order_id)
      .reduce((a, i) => a + i.line_total, 0); // automatic total from the order
  }
  return f;
}
function check(k, f, id, isNew) {
  const missing = T[k].req.filter(
    (c) => (isNew || c in f) && (f[c] == null || f[c] === ""),
  );
  if (missing.length)
    throw new Error(
      "Please fill in: " + missing.join(", ").replace(/_/g, " ") + ".",
    );
  (UNIQ[k] || []).forEach((c) => {
    if (f[c] != null && all(k).some((r) => r[c] === f[c] && r[PK[k]] !== id))
      throw new Error(
        c === "username"
          ? "That username is already taken."
          : "A record for this order already exists.",
      );
  });
}

app.get("/api/t/:k", guard("r"), (q, s) =>
  s.json(LIST[q.params.k](q.session.user)),
);

app.post(
  "/api/t/:k",
  guard("w"),
  wrap((q, s) => {
    const k = q.params.k,
      u = q.session.user,
      b = q.body;
    if (u.role === D && k === "deliveries")
      return s.status(403).json({
        error: "Delivery personnel can only update assigned deliveries.",
      });
    const f = prep(k, pick(b, q.t.cols), b, true);
    if (q.t.by) f[q.t.by] = u.id;
    check(k, f, null, true);
    let prod, n;
    if (k === "orders") {
      // an order is saved together with its item and the price at the time of order
      prod = find("products", b.product_id);
      n = parseInt(b.quantity, 10);
      if (!prod || !(n > 0))
        throw new Error("Choose a product and a quantity.");
    }
    const r = ins(k, f);
    if (k === "orders")
      ins("order_items", {
        order_id: r.order_id,
        product_id: prod.product_id,
        quantity: n,
        unit_price: prod.unit_price,
        line_total: prod.unit_price * n,
      });
    s.status(201).json({ id: r[PK[k]] });
  }),
);

app.put(
  "/api/t/:k/:id",
  guard("w"),
  wrap((q, s) => {
    const k = q.params.k,
      u = q.session.user,
      rec = find(k, q.params.id);
    if (!rec) return s.status(404).json({ error: "Record not found." });
    let cols = q.t.cols;
    if (u.role === D && k === "deliveries") {
      if (u.employee_id == null || rec.assigned_employee_id !== u.employee_id)
        return s
          .status(404)
          .json({ error: "Record not found, or not assigned to you." });
      cols = ["delivery_status", "remarks"]; // delivery personnel can only change status and remarks
    }
    const f = prep(k, pick(q.body, cols), q.body, false);
    check(k, f, rec[PK[k]], false);
    Object.assign(rec, f);
    save();
    s.json({ ok: true });
  }),
);

app.delete(
  "/api/t/:k/:id",
  need(A),
  wrap((q, s) => {
    const k = q.params.k,
      rec = T[k] && find(k, q.params.id);
    if (!rec) return s.status(404).json({ error: "Record not found." });
    if (k === "users" && rec.user_id === q.session.user.id)
      throw new Error("You cannot delete your own account.");
    if (
      (REFS[k] || []).some(([t, c]) => all(t).some((r) => r[c] === rec[PK[k]]))
    )
      throw new Error(
        "This record is linked to other records and cannot be deleted.",
      );
    if (k === "orders")
      DB.t.order_items = all("order_items").filter(
        (i) => i.order_id !== rec.order_id,
      );
    DB.t[k] = all(k).filter((r) => r !== rec);
    save();
    s.json({ ok: true });
  }),
);

// ---------- Dashboard, gallon balances, reports ----------
app.get("/api/dashboard", need(A, S), (q, s) => {
  const today = now().slice(0, 10),
    sum = (rows, f) => rows.reduce((a, r) => a + (Number(r[f]) || 0), 0);
  const d = {
    sales_today: sum(
      all("sales").filter((x) => (x.sale_date || "").startsWith(today)),
      "total_amount",
    ),
    pending_orders: all("orders").filter((o) => o.order_status === "Pending")
      .length,
    pending_deliveries: all("deliveries").filter((x) =>
      ["Scheduled", "Out for delivery"].includes(x.delivery_status),
    ).length,
    gallons_out: all("gallon_transactions").reduce(
      (a, g) =>
        a + (g.transaction_type === "Borrow" ? g.quantity : -g.quantity),
      0,
    ),
    open_concerns: all("complaints").filter((c) => c.status !== "Resolved")
      .length,
  };
  if (q.session.user.role === A)
    d.expenses_month = sum(
      all("expenses").filter(
        (e) => e.expense_date.slice(0, 7) === today.slice(0, 7),
      ),
      "amount",
    ); // admin-only
  s.json(d);
});

app.get("/api/gallon-balance", need(A, S, D), (q, s) => {
  const g = {};
  all("gallon_transactions").forEach((t) => {
    const x = (g[t.customer_id] = g[t.customer_id] || {
      customer_name: cn(t.customer_id),
      borrowed: 0,
      returned: 0,
      outstanding: 0,
    });
    if (t.transaction_type === "Borrow") {
      x.borrowed += t.quantity;
      x.outstanding += t.quantity;
    } else {
      x.returned += t.quantity;
      x.outstanding -= t.quantity;
    }
  });
  s.json(Object.values(g).sort((a, b) => b.outstanding - a.outstanding));
});

const REP = {
  // name: [roles, source, date field, columns]
  sales: [
    [A, S],
    "sales",
    "sale_date",
    [
      "sale_id",
      "sale_date",
      "customer_name",
      "total_amount",
      "payment_status",
      "payment_method",
    ],
  ],
  orders: [
    [A, S],
    "orders",
    "order_date",
    [
      "order_id",
      "order_date",
      "customer_name",
      "order_channel",
      "order_status",
      "total",
    ],
  ],
  deliveries: [
    [A, S],
    "deliveries",
    "scheduled_at",
    [
      "delivery_id",
      "order_id",
      "customer_name",
      "employee",
      "scheduled_at",
      "delivery_status",
    ],
  ],
  gallons: [
    [A, S],
    "gallon_transactions",
    "transaction_date",
    [
      "gallon_txn_id",
      "transaction_date",
      "customer_name",
      "transaction_type",
      "quantity",
    ],
  ],
  complaints: [
    [A, S],
    "complaints",
    "received_at",
    [
      "complaint_id",
      "received_at",
      "customer_name",
      "category",
      "status",
      "resolution",
    ],
  ],
  expenses: [
    [A],
    "expenses",
    "expense_date",
    ["expense_id", "expense_date", "category", "description", "amount"],
  ],
  salaries: [
    [A],
    "salary_records",
    "pay_period_end",
    [
      "employee",
      "pay_period_start",
      "pay_period_end",
      "gross_salary",
      "deductions",
      "net_salary",
      "payment_status",
    ],
  ],
};
app.get("/api/report/:n", need(A, S), (q, s) => {
  const r = REP[q.params.n];
  if (!r || !r[0].includes(q.session.user.role))
    return s.status(403).json({ error: "Your role cannot open this report." });
  const from = q.query.from || "0000-01-01",
    to = q.query.to || "9999-12-31";
  s.json(
    LIST[r[1]](q.session.user)
      .filter((x) => {
        const d = (x[r[2]] || "").slice(0, 10);
        return d >= from && d <= to;
      })
      .map((x) => Object.fromEntries(r[3].map((c) => [c, x[c] ?? ""]))),
  );
});

// ---------- Staff side of customer chat ----------
app.get("/api/chats", need(A, S), (q, s) =>
  s.json(all("chat_messages").slice(-500)),
);
app.post(
  "/api/chats/reply",
  need(A, S),
  wrap((q, s) => {
    const { session_id: id, text } = q.body,
      m = all("chat_messages").find((x) => x.session_id === id);
    if (!m || !String(text || "").trim())
      return s.status(400).json({ error: "Invalid reply." });
    ins("chat_messages", {
      session_id: id,
      customer_name: m.customer_name,
      sender: "staff",
      message: String(text).slice(0, 500),
      created_at: now(),
    });
    s.json({ ok: true });
  }),
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("Roderos system running on http://localhost:" + PORT),
);
