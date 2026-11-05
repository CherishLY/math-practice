const compositionMaxNumber = 10;
const composition = { selection: 0, kind: "mixed", queue: [], index: 0, running: false, answered: false, typedAnswer: "", attempts: [], right: 0, wrong: 0, next: null, retry: false, startedAt: 0, pausedAt: null, elapsedMilliseconds: 0, timer: null };
const compositionKindLabels = { mixed: "分与合混合", split: "练分", combine: "练合" };
const compositionElement = id => document.getElementById(id);
const compositionStorageKey = "mathCompositionHistory.v1";
let compositionRecords = [];
let compositionRetryQuestions = [];
try { const saved = JSON.parse(localStorage.getItem(compositionStorageKey)); if (Array.isArray(saved)) compositionRecords = saved.filter(record => record && Array.isArray(record.attempts)).slice(0, 10); } catch { /* Keep current practice available without storage. */ }
function compositionQuestions(number, kind = composition.kind) {
  const questions = [];
  const offset = randomInt(0, 1);
  for (let total = number || 1; total <= (number || compositionMaxNumber); total++) {
    for (let left = 0; left <= total; left++) {
      const combine = kind === "combine" || (kind === "mixed" && (questions.length + offset) % 2 === 0);
      questions.push({ total, left, right: total - left, blank: combine ? 2 : randomInt(0, 1) });
    }
  }
  return questions;
}
function compositionAnswer(question) {
  return question.blank === 2 ? question.total : question.blank === 0 ? question.left : question.right;
}
function compositionAnswerElement(question) {
  return compositionElement(question.blank === 2 ? "compositionTotal" : question.blank === 0 ? "compositionLeft" : "compositionRightPart");
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
function updateCompositionTime() {
  if (composition.running) composition.elapsedMilliseconds = Math.max(0, (composition.pausedAt === null ? Date.now() : composition.pausedAt) - composition.startedAt);
  compositionElement("compositionTime").textContent = formatTime(composition.elapsedMilliseconds);
}
function syncCompositionTiming() {
  if (!composition.running) return;
  if (activePage !== "composition" && composition.pausedAt === null) {
    composition.pausedAt = Date.now();
  } else if (activePage === "composition" && composition.pausedAt !== null) {
    composition.startedAt += Date.now() - composition.pausedAt;
    composition.pausedAt = null;
  }
  updateCompositionTime();
}
function renderCompositionQuestion() {
  clearTimeout(composition.next);
  const q = composition.queue[composition.index];
  if (!q) return;
  composition.answered = false;
  composition.typedAnswer = "";
  const total = compositionElement("compositionTotal");
  total.textContent = q.blank === 2 ? "" : q.total;
  total.className = `composition-total composition-part${q.blank === 2 ? " missing" : ""}`;
  compositionElement("compositionPrompt").textContent = q.blank === 2 ? "合起来是多少？" : "可以分成几和几？";
  ["compositionLeft", "compositionRightPart"].forEach((id, i) => {
    const part = compositionElement(id);
    part.textContent = q.blank === i ? "" : i === 0 ? q.left : q.right;
    part.className = `composition-part${q.blank === i ? " missing" : ""}`;
  });
  compositionElement("compositionFeedback").textContent = "";
  compositionElement("compositionSession").textContent = composition.running ? `${composition.retry ? "错题重做" : composition.selection ? `${composition.selection}的组成` : `1–${compositionMaxNumber}`} · ${compositionKindLabels[composition.kind]} · 第${composition.index + 1}题` : "准备开始";
  compositionElement("compositionKeypad").querySelectorAll("button").forEach(button => button.disabled = !composition.running);
}
function prepareComposition() {
  clearTimeout(composition.next);
  clearInterval(composition.timer);
  composition.startedAt = 0; composition.pausedAt = null; composition.elapsedMilliseconds = 0;
  composition.running = false; composition.retry = false; composition.attempts = []; composition.index = 0; composition.right = 0; composition.wrong = 0;
  composition.queue = shuffleComposition(compositionQuestions(composition.selection));
  compositionElement("compositionStart").disabled = false;
  compositionElement("compositionFinish").disabled = true;
  compositionElement("compositionRetry").disabled = compositionRetryQuestions.length === 0;
  compositionStats(); updateCompositionTime(); renderCompositionQuestion();
}
function beginComposition(questions = null) {
  const selected = questions ? questions.map(q => ({ total: q.total, left: q.left, right: q.right, blank: q.blank })) : null;
  prepareComposition();
  if (selected) { composition.queue = shuffleComposition(selected); composition.retry = true; }
  composition.running = true;
  composition.startedAt = Date.now();
  syncCompositionTiming();
  composition.timer = setInterval(updateCompositionTime, 250);
  compositionElement("compositionStart").disabled = true;
  compositionElement("compositionFinish").disabled = false;
  compositionElement("compositionRetry").disabled = true;
  compositionStats(); renderCompositionQuestion();
}
function submitComposition(selected) {
  if (activePage !== "composition" || !composition.running || composition.answered || !Number.isSafeInteger(selected) || selected < 0) return;
  const q = composition.queue[composition.index], answer = compositionAnswer(q);
  const correct = selected === answer;
  composition.answered = true; composition[correct ? "right" : "wrong"]++;
  if (correct) rewardCorrectAnswer();
  composition.attempts.push({ ...q, selected, correct });
  const part = compositionAnswerElement(q);
  part.textContent = selected; part.className = `${q.blank === 2 ? "composition-total " : ""}composition-part ${correct ? "good" : "bad"}`;
  compositionElement("compositionFeedback").textContent = `${correct ? "答对了！" : "再记一记："}${q.total}由${q.left}和${q.right}组成，${q.left} + ${q.right} = ${q.total}。`;
  compositionElement("compositionKeypad").querySelectorAll("button").forEach(button => button.disabled = true);
  compositionStats();
  if (composition.attempts.length === composition.queue.length) { finishComposition(); return; }
  composition.next = setTimeout(() => { if (composition.running) { composition.index++; renderCompositionQuestion(); } }, 900);
}
function appendCompositionDigit(digit) {
  if (activePage !== "composition" || !composition.running || composition.answered || !/^\d$/.test(digit)) return;
  const q = composition.queue[composition.index];
  const expected = String(compositionAnswer(q));
  composition.typedAnswer += digit;
  compositionAnswerElement(q).textContent = composition.typedAnswer;
  if (!expected.startsWith(composition.typedAnswer) || composition.typedAnswer.length === expected.length) submitComposition(Number(composition.typedAnswer));
}
function finishComposition() {
  if (!composition.running) return;
  updateCompositionTime();
  clearInterval(composition.timer);
  clearTimeout(composition.next); composition.running = false;
  compositionRetryQuestions = composition.attempts.filter(attempt => !attempt.correct);
  compositionElement("compositionRetry").disabled = compositionRetryQuestions.length === 0;
  compositionElement("compositionFinish").disabled = true;
  compositionElement("compositionStart").disabled = false;
  compositionElement("compositionKeypad").querySelectorAll("button").forEach(button => button.disabled = true);
  compositionElement("compositionSession").textContent = "练习结束";
  const elapsed = formatTime(composition.elapsedMilliseconds);
  compositionElement("compositionFeedback").textContent = `本次完成${composition.attempts.length}题，答对${composition.right}题，答错${composition.wrong}题，总用时${elapsed}。`;
  if (!composition.retry && composition.attempts.length > 0) {
    compositionRecords.unshift({ selection: composition.selection, kind: composition.kind, label: `${composition.selection ? `${composition.selection}的组成` : `1–${compositionMaxNumber}`} · ${compositionKindLabels[composition.kind]}`, date: new Date().toLocaleString("zh-CN"), right: composition.right, wrong: composition.wrong, elapsed, elapsedMilliseconds: composition.elapsedMilliseconds, attempts: composition.attempts.slice() });
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
    const summary = document.createElement("span"); summary.textContent = `${record.label} · ${record.date} · 对${record.right}题 / 错${record.wrong}题 · ${record.elapsed ? `用时${record.elapsed}` : "旧记录未记录用时"}`;
    const button = document.createElement("button"); button.type = "button"; button.className = "action secondary";
    const wrong = record.attempts.filter(q => !q.correct);
    button.textContent = wrong.length ? `重做错题（${wrong.length}题）` : "全部答对"; button.disabled = !wrong.length;
    button.addEventListener("click", () => {
      composition.selection = Number.isInteger(record.selection) ? record.selection : 0;
      composition.kind = Object.hasOwn(compositionKindLabels, record.kind) ? record.kind : "mixed";
      document.querySelectorAll("[data-composition-kind]").forEach(item => { const selected = item.dataset.compositionKind === composition.kind; item.classList.toggle("active", selected); item.setAttribute("aria-pressed", String(selected)); });
      compositionElement("compositionNumbers").querySelectorAll("button").forEach((item, index) => { const active = index === composition.selection; item.classList.toggle("active", active); item.setAttribute("aria-pressed", String(active)); });
      beginComposition(wrong);
    }); row.append(summary, button); list.appendChild(row);
  });
}
for (let number = 0; number <= compositionMaxNumber; number++) {
  const button = document.createElement("button"); button.type = "button"; button.className = `mode-button${number === 0 ? " active" : ""}`; button.textContent = number || "混合"; button.setAttribute("aria-pressed", String(number === 0));
  button.addEventListener("click", () => { composition.selection = number; compositionElement("compositionNumbers").querySelectorAll("button").forEach(item => { item.classList.toggle("active", item === button); item.setAttribute("aria-pressed", String(item === button)); }); prepareComposition(); });
  compositionElement("compositionNumbers").appendChild(button);
}
for (let digit = 0; digit <= 9; digit++) {
  const button = document.createElement("button"); button.type = "button"; button.textContent = digit; button.setAttribute("aria-label", `输入数字${digit}`); button.addEventListener("click", () => appendCompositionDigit(String(digit))); compositionElement("compositionKeypad").appendChild(button);
}
for (let number = 1; number <= compositionMaxNumber; number++) {
  const section = document.createElement("section"), heading = document.createElement("h2"), body = document.createElement("p"); heading.textContent = `${number}的组成`;
  body.textContent = "";
  compositionQuestions(number).forEach(q => { const line = document.createElement("span"); line.textContent = `${q.total} = ${q.left} + ${q.right}`; body.append(line, document.createElement("br")); });
  section.append(heading, body); compositionElement("compositionChart").appendChild(section);
}
compositionElement("compositionStart").addEventListener("click", () => beginComposition());
document.querySelectorAll("[data-composition-kind]").forEach(button => {
  button.addEventListener("click", () => {
    composition.kind = button.dataset.compositionKind;
    document.querySelectorAll("[data-composition-kind]").forEach(item => { item.classList.toggle("active", item === button); item.setAttribute("aria-pressed", String(item === button)); });
    prepareComposition();
  });
});
compositionElement("compositionFinish").addEventListener("click", finishComposition);
compositionElement("compositionRetry").addEventListener("click", () => { if (compositionRetryQuestions.length) beginComposition(compositionRetryQuestions); });
document.addEventListener("keydown", event => {
  if (activePage !== "composition" || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat || !/^\d$/.test(event.key)) return;
  if (event.target && (event.target.matches("input, textarea, select") || event.target.isContentEditable)) return;
  event.preventDefault(); appendCompositionDigit(event.key);
});
renderCompositionHistory(); prepareComposition();
