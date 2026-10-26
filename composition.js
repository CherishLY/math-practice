const composition = { selection: 0, queue: [], index: 0, running: false, answered: false, attempts: [], right: 0, wrong: 0, next: null, retry: false };
const compositionElement = id => document.getElementById(id);
const compositionStorageKey = "mathCompositionHistory.v1";
let compositionRecords = [];
let compositionRetryQuestions = [];
try { const saved = JSON.parse(localStorage.getItem(compositionStorageKey)); if (Array.isArray(saved)) compositionRecords = saved.filter(record => record && Array.isArray(record.attempts)).slice(0, 10); } catch { /* Keep current practice available without storage. */ }
function compositionQuestions(number) {
  const questions = [];
  for (let total = number || 1; total <= (number || 9); total++) {
    for (let left = 0; left <= total; left++) questions.push({ total, left, right: total - left, blank: randomInt(0, 1) });
  }
  return questions;
}
function shuffleComposition(items) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) { const j = randomInt(0, i); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
function compositionStats() {
  compositionElement("compositionRight").textContent = composition.right;
  compositionElement("compositionWrong").textContent = composition.wrong;
  compositionElement("compositionProgress").textContent = `${composition.attempts.length}/${composition.queue.length}`;
}
function renderCompositionQuestion() {
  clearTimeout(composition.next);
  const q = composition.queue[composition.index];
  if (!q) return;
  composition.answered = false;
  compositionElement("compositionTotal").textContent = q.total;
  ["compositionLeft", "compositionRightPart"].forEach((id, i) => {
    const part = compositionElement(id);
    part.textContent = q.blank === i ? "□" : i === 0 ? q.left : q.right;
    part.className = `composition-part${q.blank === i ? " missing" : ""}`;
  });
  compositionElement("compositionFeedback").textContent = "";
  compositionElement("compositionSession").textContent = composition.running ? `${composition.retry ? "错题重做" : composition.selection ? `${composition.selection}的组成` : "1–9混合"} · 第${composition.index + 1}题` : "准备开始";
  compositionElement("compositionKeypad").querySelectorAll("button").forEach(button => button.disabled = !composition.running);
}
function prepareComposition() {
  clearTimeout(composition.next);
  composition.running = false; composition.retry = false; composition.attempts = []; composition.index = 0; composition.right = 0; composition.wrong = 0;
  composition.queue = shuffleComposition(compositionQuestions(composition.selection));
  compositionElement("compositionStart").disabled = false;
  compositionElement("compositionFinish").disabled = true;
  compositionElement("compositionRetry").disabled = compositionRetryQuestions.length === 0;
  compositionStats(); renderCompositionQuestion();
}
function beginComposition(questions = null) {
  const selected = questions ? questions.map(q => ({ total: q.total, left: q.left, right: q.right, blank: q.blank })) : null;
  prepareComposition();
  if (selected) { composition.queue = shuffleComposition(selected); composition.retry = true; }
  composition.running = true;
  compositionElement("compositionStart").disabled = true;
  compositionElement("compositionFinish").disabled = false;
  compositionElement("compositionRetry").disabled = true;
  compositionStats(); renderCompositionQuestion();
}
function submitComposition(selected) {
  if (activePage !== "composition" || !composition.running || composition.answered || !Number.isInteger(selected) || selected < 0 || selected > 9) return;
  const q = composition.queue[composition.index], answer = q.blank === 0 ? q.left : q.right;
  const correct = selected === answer;
  composition.answered = true; composition[correct ? "right" : "wrong"]++;
  if (correct) rewardCorrectAnswer();
  composition.attempts.push({ ...q, selected, correct });
  const part = compositionElement(q.blank === 0 ? "compositionLeft" : "compositionRightPart");
  part.textContent = selected; part.className = `composition-part ${correct ? "good" : "bad"}`;
  compositionElement("compositionFeedback").textContent = `${correct ? "答对了！" : "再记一记："}${q.total}由${q.left}和${q.right}组成，${q.left} + ${q.right} = ${q.total}。`;
  compositionElement("compositionKeypad").querySelectorAll("button").forEach(button => button.disabled = true);
  compositionStats();
  if (composition.attempts.length === composition.queue.length) { finishComposition(); return; }
  composition.next = setTimeout(() => { if (composition.running) { composition.index++; renderCompositionQuestion(); } }, 900);
}
function finishComposition() {
  if (!composition.running) return;
  clearTimeout(composition.next); composition.running = false;
  compositionRetryQuestions = composition.attempts.filter(attempt => !attempt.correct);
  compositionElement("compositionRetry").disabled = compositionRetryQuestions.length === 0;
  compositionElement("compositionFinish").disabled = true;
  compositionElement("compositionStart").disabled = false;
  compositionElement("compositionKeypad").querySelectorAll("button").forEach(button => button.disabled = true);
  compositionElement("compositionSession").textContent = "练习结束";
  compositionElement("compositionFeedback").textContent = `本次完成${composition.attempts.length}题，答对${composition.right}题，答错${composition.wrong}题。`;
  if (!composition.retry && composition.attempts.length > 0) {
    compositionRecords.unshift({ selection: composition.selection, label: composition.selection ? `${composition.selection}的组成` : "1–9混合", date: new Date().toLocaleString("zh-CN"), right: composition.right, wrong: composition.wrong, attempts: composition.attempts.slice() });
    compositionRecords = compositionRecords.slice(0, 10);
    try { localStorage.setItem(compositionStorageKey, JSON.stringify(compositionRecords)); } catch { compositionElement("compositionFeedback").textContent += " 本次成绩无法保存到本地。"; }
    renderCompositionHistory();
  }
}
function renderCompositionHistory() {
  const list = compositionElement("compositionHistory"); list.replaceChildren();
  if (!compositionRecords.length) list.textContent = "暂无成绩";
  compositionRecords.forEach(record => {
    const row = document.createElement("div"); row.className = "composition-record";
    const summary = document.createElement("span"); summary.textContent = `${record.label} · ${record.date} · 对${record.right}题 / 错${record.wrong}题`;
    const button = document.createElement("button"); button.type = "button"; button.className = "action secondary";
    const wrong = record.attempts.filter(q => !q.correct);
    button.textContent = wrong.length ? `重做错题（${wrong.length}题）` : "全部答对"; button.disabled = !wrong.length;
    button.addEventListener("click", () => {
      composition.selection = Number.isInteger(record.selection) ? record.selection : 0;
      compositionElement("compositionNumbers").querySelectorAll("button").forEach((item, index) => { const active = index === composition.selection; item.classList.toggle("active", active); item.setAttribute("aria-pressed", String(active)); });
      beginComposition(wrong);
    }); row.append(summary, button); list.appendChild(row);
  });
}
for (let number = 0; number <= 9; number++) {
  const button = document.createElement("button"); button.type = "button"; button.className = `mode-button${number === 0 ? " active" : ""}`; button.textContent = number || "混合"; button.setAttribute("aria-pressed", String(number === 0));
  button.addEventListener("click", () => { composition.selection = number; compositionElement("compositionNumbers").querySelectorAll("button").forEach(item => { item.classList.toggle("active", item === button); item.setAttribute("aria-pressed", String(item === button)); }); prepareComposition(); });
  compositionElement("compositionNumbers").appendChild(button);
}
for (let digit = 0; digit <= 9; digit++) {
  const button = document.createElement("button"); button.type = "button"; button.textContent = digit; button.setAttribute("aria-label", `答案${digit}`); button.addEventListener("click", () => submitComposition(digit)); compositionElement("compositionKeypad").appendChild(button);
}
for (let number = 1; number <= 9; number++) {
  const section = document.createElement("section"), heading = document.createElement("h2"), body = document.createElement("p"); heading.textContent = `${number}的组成`;
  body.textContent = "";
  compositionQuestions(number).forEach(q => { const line = document.createElement("span"); line.textContent = `${q.total} = ${q.left} + ${q.right}`; body.append(line, document.createElement("br")); });
  section.append(heading, body); compositionElement("compositionChart").appendChild(section);
}
compositionElement("compositionStart").addEventListener("click", () => beginComposition());
compositionElement("compositionFinish").addEventListener("click", finishComposition);
compositionElement("compositionRetry").addEventListener("click", () => { if (compositionRetryQuestions.length) beginComposition(compositionRetryQuestions); });
document.addEventListener("keydown", event => {
  if (activePage !== "composition" || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat || !/^\d$/.test(event.key)) return;
  if (event.target && (event.target.matches("input, textarea, select") || event.target.isContentEditable)) return;
  event.preventDefault(); submitComposition(Number(event.key));
});
renderCompositionHistory(); prepareComposition();
