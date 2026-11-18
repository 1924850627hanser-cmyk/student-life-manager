/* Student Life Manager · 학생 생활 관리 시스템 · 留学生活管理系统
 * HTML / CSS / JavaScript, localStorage persistence, KRW↔CNY converter.
 */

"use strict";

const STORAGE_KEY = "slm_data_v1";

const PRESET_WORDS = [
  { ko: "안녕하세요", zh: "你好（敬语）" },
  { ko: "감사합니다", zh: "谢谢" },
  { ko: "죄송합니다", zh: "对不起 / 抱歉" },
  { ko: "도와주세요", zh: "请帮帮我" },
  { ko: "화장실이 어디예요?", zh: "洗手间在哪里？" },
  { ko: "얼마예요?", zh: "多少钱？" },
  { ko: "맛있어요", zh: "好吃" },
  { ko: "주말에 뭐 해요?", zh: "周末做什么？" },
  { ko: "잘 먹었습니다", zh: "我吃得很好（饭后道谢）" },
  { ko: "다음에 또 만나요", zh: "下次再见" },
];

const PRESET_EXPRESSIONS = [
  { ko: "지하철역까지 어떻게 가요?", zh: "去地铁站怎么走？" },
  { ko: "학생증을 보여주세요", zh: "请出示学生证" },
  { ko: "계좌를 개설하고 싶어요", zh: "我想开一个银行账户" },
  { ko: "유심을 사고 싶어요", zh: "我想买一张手机 SIM 卡" },
  { ko: "이것을 좀 데워 주세요", zh: "请帮我加热这个" },
  { ko: "번호를 눌러 주세요", zh: "请按一下号码" },
];

const DEFAULT_STATE = {
  transactions: [], // { id, type, amount, date, category, note }
  budget: { monthly: 0 },
  todos: [],        // { id, text, done, createdAt }
  rate: 0.0052,     // 1 KRW = 0.0052 CNY (default, editable)
  words: PRESET_WORDS.slice(),
  expressions: PRESET_EXPRESSIONS.slice(),
};

let state = loadState();
let wordIndex = 0;

/* ---------- persistence ---------- */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_STATE), ...parsed };
  } catch (err) {
    console.error("데이터 불러오기 실패 · 读取数据失败:", err);
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatKRW(n) {
  return "₩" + Number(n || 0).toLocaleString("ko-KR");
}

function todayStr() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/* ---------- tabs ---------- */
$("tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
  btn.classList.add("active");
  $("panel-" + btn.dataset.tab).classList.add("active");
});

/* ---------- transactions ---------- */
$("tx-date").value = todayStr();

$("tx-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const type = $("tx-type").value;
  const amount = parseFloat($("tx-amount").value);
  const date = $("tx-date").value;
  const category = $("tx-category").value;
  const note = $("tx-note").value.trim();

  if (!(amount > 0) || !date) {
    alert("금액과 날짜를 확인해 주세요 · 请检查金额和日期");
    return;
  }

  state.transactions.push({ id: uid(), type, amount, date, category, note });
  saveState();
  renderTransactions();
  e.target.reset();
  $("tx-date").value = todayStr();
});

function deleteTransaction(id) {
  state.transactions = state.transactions.filter((t) => t.id !== id);
  saveState();
  renderTransactions();
}

function renderTransactions() {
  const list = $("tx-list");
  list.innerHTML = "";
  const empty = $("tx-empty");

  const sorted = state.transactions.slice().sort((a, b) => b.date.localeCompare(a.date));
  empty.style.display = sorted.length ? "none" : "block";

  let income = 0, expense = 0;
  for (const t of state.transactions) {
    if (t.type === "income") income += t.amount; else expense += t.amount;
  }

  $("sum-income").textContent = formatKRW(income);
  $("sum-expense").textContent = formatKRW(expense);
  $("sum-balance").textContent = formatKRW(income - expense);

  for (const t of sorted) {
    const li = document.createElement("li");
    const sign = t.type === "income" ? "+" : "-";
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `
      <span class="title">${escapeHtml(t.category)}${t.note ? " · " + escapeHtml(t.note) : ""}</span>
      <span class="sub">${escapeHtml(t.date)}</span>`;
    const right = document.createElement("div");
    right.className = "meta";
    right.style.flexDirection = "row";
    right.style.alignItems = "center";
    right.innerHTML = `<span class="amount ${t.type}">${sign}${formatKRW(t.amount)}</span>`;
    const del = document.createElement("button");
    del.className = "icon-btn";
    del.title = "삭제 · 删除";
    del.textContent = "🗑";
    del.addEventListener("click", () => deleteTransaction(t.id));
    right.appendChild(del);
    li.append(meta, right);
    list.appendChild(li);
  }

  renderBudget(income, expense);
}

/* ---------- budget ---------- */
$("budget-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = parseFloat($("budget-amount").value);
  if (!(amount >= 0)) {
    alert("예산 금액을 입력해 주세요 · 请输入预算金额");
    return;
  }
  state.budget.monthly = amount;
  saveState();
  renderBudget();
});

function renderBudget(income = 0, expense = 0) {
  const monthly = state.budget.monthly || 0;
  const totalExpense = state.transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const left = monthly - totalExpense;
  const ratio = monthly > 0 ? Math.min(100, (totalExpense / monthly) * 100) : 0;

  $("bud-set").textContent = formatKRW(monthly);
  $("bud-used").textContent = formatKRW(totalExpense);
  $("bud-left").textContent = formatKRW(left);
  const bar = $("bud-bar");
  bar.style.width = ratio + "%";
  bar.classList.toggle("over", left < 0);
  $("bud-ratio").textContent = `사용 비율 · 使用比例: ${ratio.toFixed(1)}%`;
}

/* ---------- todos ---------- */
$("todo-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("todo-text").value.trim();
  if (!text) return;
  state.todos.push({ id: uid(), text, done: false, createdAt: Date.now() });
  saveState();
  renderTodos();
  e.target.reset();
});

function toggleTodo(id) {
  const t = state.todos.find((x) => x.id === id);
  if (t) { t.done = !t.done; saveState(); renderTodos(); }
}

function deleteTodo(id) {
  state.todos = state.todos.filter((x) => x.id !== id);
  saveState();
  renderTodos();
}

function renderTodos() {
  const list = $("todo-list");
  list.innerHTML = "";
  $("todo-empty").style.display = state.todos.length ? "none" : "block";

  for (const t of state.todos) {
    const li = document.createElement("li");
    li.className = "todo-item" + (t.done ? " done" : "");
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `<span class="title">${escapeHtml(t.text)}</span>`;
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "6px";

    const toggle = document.createElement("button");
    toggle.className = "icon-btn";
    toggle.title = "완료 표시 · 标记完成";
    toggle.textContent = t.done ? "✅" : "⬜";
    toggle.addEventListener("click", () => toggleTodo(t.id));

    const del = document.createElement("button");
    del.className = "icon-btn";
    del.title = "삭제 · 删除";
    del.textContent = "🗑";
    del.addEventListener("click", () => deleteTodo(t.id));

    actions.append(toggle, del);
    li.append(meta, actions);
    list.appendChild(li);
  }
}

/* ---------- exchange ---------- */
$("ex-rate").value = state.rate;

$("exchange-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = parseFloat($("ex-amount").value);
  const direction = $("ex-direction").value;
  const rate = parseFloat($("ex-rate").value);

  if (!(amount >= 0) || !(rate > 0)) {
    $("ex-result").textContent = "금액과 환율을 확인해 주세요 · 请检查金额和汇率";
    $("ex-result").classList.add("error");
    return;
  }
  state.rate = rate;
  saveState();

  let result, outLabel;
  if (direction === "krw-cny") {
    result = amount * rate;
    outLabel = `${formatKRW(amount)} ≈ ¥${result.toFixed(2)} CNY`;
  } else {
    result = amount / rate;
    outLabel = `¥${amount.toFixed(2)} CNY ≈ ${formatKRW(result)}`;
  }
  $("ex-result").textContent = "결과 · 结果: " + outLabel;
  $("ex-result").classList.remove("error");
});

/* ---------- korean learning ---------- */
function renderWord() {
  const words = state.words;
  if (!words.length) {
    $("word-index").textContent = "0 / 0";
    $("word-ko").textContent = "단어가 없습니다 · 暂无单词";
    $("word-zh").textContent = "";
    return;
  }
  wordIndex = (wordIndex + words.length) % words.length;
  const w = words[wordIndex];
  $("word-index").textContent = `${wordIndex + 1} / ${words.length}`;
  $("word-ko").textContent = w.ko;
  $("word-zh").textContent = w.zh;
}

$("word-prev").addEventListener("click", () => { wordIndex--; renderWord(); });
$("word-next").addEventListener("click", () => { wordIndex++; renderWord(); });

function renderExpressions() {
  const list = $("expr-list");
  list.innerHTML = "";
  for (const ex of state.expressions) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="ko">${escapeHtml(ex.ko)}</span><span class="zh">${escapeHtml(ex.zh)}</span>`;
    list.appendChild(li);
  }
}

/* ---------- data management ---------- */
function setMsg(text, isError = false) {
  const msg = $("data-msg");
  msg.textContent = text;
  msg.classList.toggle("error", isError);
}

$("btn-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `student-life-manager-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  setMsg("JSON을 내보냈습니다 · 已导出 JSON");
});

$("file-import").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (typeof data !== "object" || data === null) throw new Error("invalid");
      state = { ...structuredClone(DEFAULT_STATE), ...data };
      // 单词/表达为空时回退到预设，避免备份缺字段导致词库清空
      if (!Array.isArray(state.words) || !state.words.length) state.words = PRESET_WORDS.slice();
      if (!Array.isArray(state.expressions) || !state.expressions.length) state.expressions = PRESET_EXPRESSIONS.slice();
      saveState();
      refreshAll();
      setMsg("JSON을 가져왔습니다 · 已导入 JSON");
    } catch (err) {
      console.error(err);
      setMsg("파일 형식이 올바르지 않습니다 · 文件格式不正确", true);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

$("btn-clear").addEventListener("click", () => {
  if (!confirm("모든 데이터를 삭제할까요? 이 작업은 되돌릴 수 없습니다.\n确定要清空所有数据吗？此操作无法撤销。")) return;
  state = structuredClone(DEFAULT_STATE);
  saveState();
  refreshAll();
  setMsg("데이터를 모두 삭제했습니다 · 已清空全部数据");
});

/* ---------- misc ---------- */
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function refreshAll() {
  renderTransactions();
  renderTodos();
  renderWord();
  renderExpressions();
  $("ex-rate").value = state.rate;
}

refreshAll();
