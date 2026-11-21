const $ = (s) => document.querySelector(s);
let key = sessionStorage.getItem("wr-key") || "",
  current = null,
  timer;
const peso = (n) => "₱" + n.toLocaleString("en-PH");
const api = (url, opts = {}) =>
  fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-admin-key": key },
  });

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  key = $("#pw").value;
  const res = await api("/api/admin/orders");
  if (!res.ok) {
    $("#loginMsg").textContent = "Wrong password. Try again.";
    $("#loginMsg").className = "err";
    return;
  }
  sessionStorage.setItem("wr-key", key);
  start();
});

function start() {
  $("#loginForm").hidden = true;
  $("#loginMsg").textContent = "";
  $("#panel").hidden = false;
  refresh();
  clearInterval(timer);
  timer = setInterval(refresh, 4000);
}

async function refresh() {
  const [o, c] = await Promise.all([
    api("/api/admin/orders"),
    api("/api/admin/chats"),
  ]);
  if (!o.ok) return;
  renderOrders(await o.json());
  renderChats(await c.json());
}

function renderOrders({ orders, statuses }) {
  const body = $("#orders");
  if (document.activeElement && document.activeElement.closest("#orders"))
    return; // don't disturb an open dropdown
  body.innerHTML = "";
  if (!orders.length)
    body.innerHTML =
      '<tr><td colspan="5" class="muted">No orders yet.</td></tr>';
  orders.forEach((o) => {
    const tr = document.createElement("tr");
    const cells = [
      o.id,
      `${o.name}\n${o.phone}`,
      `${o.quantity} × ${o.product}\n${o.method === "delivery" ? "Deliver: " + o.address : "Pick-up"}${o.notes ? "\nNote: " + o.notes : ""}`,
      peso(o.total),
    ];
    cells.forEach((t) => {
      const td = document.createElement("td");
      td.style.whiteSpace = "pre-line";
      td.textContent = t;
      tr.appendChild(td);
    });
    const td = document.createElement("td"),
      sel = document.createElement("select");
    statuses.forEach((s) => sel.add(new Option(s, s, false, s === o.status)));
    sel.addEventListener("change", async () => {
      await api("/api/admin/orders/" + o.id, {
        method: "PATCH",
        body: JSON.stringify({ status: sel.value }),
      });
      sel.blur();
      refresh();
    });
    td.appendChild(sel);
    tr.appendChild(td);
    body.appendChild(tr);
  });
}

let chats = [];
function renderChats(list) {
  chats = list;
  const ul = $("#chatList");
  ul.innerHTML = "";
  if (!list.length) ul.innerHTML = '<li class="muted">No chats yet.</li>';
  list.forEach((c) => {
    const li = document.createElement("li"),
      b = document.createElement("button");
    b.textContent = c.name + (c.unread ? " " : "");
    if (c.unread) {
      const d = document.createElement("span");
      d.className = "dot";
      d.textContent = "● new";
      b.appendChild(d);
    }
    if (c.id === current) b.classList.add("active");
    b.addEventListener("click", () => {
      current = c.id;
      renderChats(chats);
    });
    li.appendChild(b);
    ul.appendChild(li);
  });
  const chat = list.find((c) => c.id === current);
  $("#replyForm").hidden = !chat;
  if (!chat) return;
  const log = $("#adminLog");
  log.innerHTML = "";
  chat.messages.forEach((m) => {
    const d = document.createElement("div");
    d.className = "msg" + (m.from === "staff" ? " me" : "");
    d.textContent = m.text;
    log.appendChild(d);
  });
  log.scrollTop = log.scrollHeight;
}

$("#replyForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  await api("/api/admin/chats/" + current, {
    method: "POST",
    body: JSON.stringify({ text: $("#replyText").value }),
  });
  $("#replyText").value = "";
  refresh();
});

if (key) api("/api/admin/orders").then((r) => r.ok && start());