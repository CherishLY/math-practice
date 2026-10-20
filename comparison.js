const comparisonState = { mode: "numbers", left: null, right: null, symbol: "", answered: false, correct: 0, wrong: 0, nextQuestionId: null };
const comparisonNames = { ">": "大于", "<": "小于", "=": "等于" };
const comparisonCircle = document.querySelector("#comparisonCircle");
const comparisonFeedback = document.querySelector("#comparisonFeedback");
const comparisonExplanation = document.querySelector("#comparisonExplanation");

function comparisonSide(value, expression) {
  if (!expression) return { text: String(value), value };
  if (Math.random() < 0.5 && value >= 2) {
    const first = randomInt(1, value - 1);
    return { text: `${first} + ${value - first}`, value };
  }
  const first = randomInt(value, 20);
  return { text: `${first} - ${first - value}`, value };
}

function newComparisonQuestion() {
  clearTimeout(comparisonState.nextQuestionId);
  // Balance the three relations so equality gets as much practice as inequality.
  const relation = randomInt(0, 2);
  let leftValue;
  let rightValue;
  if (relation === 0) {
    leftValue = randomInt(1, 20);
    rightValue = randomInt(0, leftValue - 1);
  } else if (relation === 1) {
    rightValue = randomInt(1, 20);
    leftValue = randomInt(0, rightValue - 1);
  } else {
    leftValue = rightValue = randomInt(0, 20);
  }
  const expressionOnLeft = comparisonState.mode === "both" || (comparisonState.mode === "expression" && Math.random() < 0.5);
  const expressionOnRight = comparisonState.mode === "both" || (comparisonState.mode === "expression" && !expressionOnLeft);
  comparisonState.left = comparisonSide(leftValue, expressionOnLeft);
  comparisonState.right = comparisonSide(rightValue, expressionOnRight);
  comparisonState.symbol = leftValue > rightValue ? ">" : leftValue < rightValue ? "<" : "=";
  comparisonState.answered = false;
  document.querySelector("#comparisonLeft").textContent = comparisonState.left.text;
  document.querySelector("#comparisonRightSide").textContent = comparisonState.right.text;
  comparisonCircle.textContent = "";
  comparisonCircle.className = "comparison-circle";
  comparisonCircle.setAttribute("aria-label", "待填比较符号");
  comparisonFeedback.textContent = "";
  comparisonFeedback.className = "comparison-feedback";
  comparisonExplanation.textContent = "";
  document.querySelectorAll("[data-symbol]").forEach((button) => {
    button.disabled = false;
    button.classList.remove("selected");
    button.setAttribute("aria-pressed", "false");
  });
}

function updateComparisonStats() {
  document.querySelector("#comparisonRight").textContent = comparisonState.correct;
  document.querySelector("#comparisonWrong").textContent = comparisonState.wrong;
  document.querySelector("#comparisonTotal").textContent = comparisonState.correct + comparisonState.wrong;
}

function submitComparison(symbol) {
  if (activePage !== "comparison" || comparisonState.answered || !(symbol in comparisonNames)) return;
  comparisonState.answered = true;
  const correct = symbol === comparisonState.symbol;
  comparisonState[correct ? "correct" : "wrong"] += 1;
  comparisonCircle.textContent = symbol;
  comparisonCircle.className = `comparison-circle ${correct ? "good" : "bad"}`;
  comparisonCircle.setAttribute("aria-label", `所选符号：${comparisonNames[symbol]}`);
  comparisonFeedback.textContent = correct ? "答对了！" : `答错了，应该选“${comparisonNames[comparisonState.symbol]}”`;
  comparisonFeedback.className = `comparison-feedback ${correct ? "good" : "bad"}`;
  const left = comparisonState.left;
  const right = comparisonState.right;
  const calculations = [left, right].filter((side) => /[+-]/.test(side.text)).map((side) => `${side.text} = ${side.value}`);
  comparisonExplanation.textContent = [...calculations, `${left.value} ${comparisonState.symbol} ${right.value}`].join("，");
  document.querySelectorAll("[data-symbol]").forEach((button) => {
    button.disabled = true;
    button.classList.toggle("selected", button.dataset.symbol === symbol);
    button.setAttribute("aria-pressed", String(button.dataset.symbol === symbol));
  });
  updateComparisonStats();
  if (correct) comparisonState.nextQuestionId = setTimeout(newComparisonQuestion, 800);
}

document.querySelectorAll("[data-symbol]").forEach((button) => {
  button.addEventListener("click", () => submitComparison(button.dataset.symbol));
});
document.querySelectorAll("[data-comparison-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    comparisonState.mode = button.dataset.comparisonMode;
    document.querySelectorAll("[data-comparison-mode]").forEach((item) => {
      item.classList.toggle("active", item === button);
      item.setAttribute("aria-pressed", String(item === button));
    });
    newComparisonQuestion();
  });
});
document.querySelector("#comparisonNext").addEventListener("click", newComparisonQuestion);
document.querySelector("#comparisonReset").addEventListener("click", () => {
  comparisonState.correct = 0;
  comparisonState.wrong = 0;
  updateComparisonStats();
  newComparisonQuestion();
});
newComparisonQuestion();
