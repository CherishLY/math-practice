const cubeState = { shape: "block", layers: [], total: 0, right: 0, wrong: 0, answered: false, nextQuestionId: null };
const cubeInput = document.querySelector("#cubeAnswer");
const cubeFeedback = document.querySelector("#cubeFeedback");
const cubeExplanation = document.querySelector("#cubeExplanation");
const cubeChoices = document.querySelector("#cubeChoices");
const exercisePages = ["arithmetic", "cubes", "comparison", "composition"];

function switchExercise(page) {
  if (page === activePage) return;
  if (activePage === "arithmetic" && state.running) {
    updateCountdown();
  }
  activePage = page;
  document.querySelector("#arithmeticStats").hidden = page !== "arithmetic";
  document.querySelector("#summaryBar").classList.toggle("stars-only", page !== "arithmetic");
  syncArithmeticPause();
  for (const name of exercisePages) {
    const selected = name === page;
    document.querySelector(`#${name}Page`).hidden = !selected;
    const tab = document.querySelector(`#${name}Tab`);
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
}

for (const name of exercisePages) {
  const tab = document.querySelector(`#${name}Tab`);
  tab.addEventListener("click", () => switchExercise(name));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const index = exercisePages.indexOf(name);
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next = event.key === "Home" ? exercisePages[0] : event.key === "End" ? exercisePages[exercisePages.length - 1] : exercisePages[(index + offset + exercisePages.length) % exercisePages.length];
    switchExercise(next);
    document.querySelector(`#${next}Tab`).focus();
  });
}

// Isometric illustration: draw distant columns first, then the foreground.
function drawCube(x, y, z, originX, originY, reference = false) {
  const px = originX + (x - y) * 32;
  const py = originY + (x + y) * 16 - z * 38;
  const points = (items) => items.map(([dx, dy]) => `${px + dx},${py + dy}`).join(" ");
  const palette = reference ? ["#fff1ba", "#d69e37", "#edc365"] : ["#a5e4df", "#319ca7", "#69c5c6"];
  return `<g stroke="${reference ? "#8a652b" : "#216d7b"}" stroke-width="1.5" stroke-linejoin="round">
    <polygon fill="${palette[1]}" points="${points([[-32, 16], [0, 32], [0, 70], [-32, 54]])}"/>
    <polygon fill="${palette[2]}" points="${points([[0, 32], [32, 16], [32, 54], [0, 70]])}"/>
    <polygon fill="${palette[0]}" points="${points([[0, 0], [32, 16], [0, 32], [-32, 16]])}"/>
  </g>`;
}

function solidName() {
  return cubeState.shape === "cuboid" ? "长方体" : cubeState.shape === "cylinder" ? "圆柱" : "小方块";
}

function drawCountingSolid(x, y, z, originX, originY, reference = false) {
  if (cubeState.shape === "cylinder") {
    const cx = originX + (x - y) * 32;
    const cy = originY + (x + y) * 16 - z * 38 + 16;
    const stroke = reference ? "#8a652b" : "#68568d";
    return `<g stroke="${stroke}" stroke-width="1.5">
      <path d="M${cx - 26} ${cy} L${cx - 26} ${cy + 38} A26 13 0 0 0 ${cx + 26} ${cy + 38} L${cx + 26} ${cy} Z" fill="${reference ? "#edc365" : "#b4a0db"}"/>
      <ellipse cx="${cx}" cy="${cy}" rx="26" ry="13" fill="${reference ? "#fff1ba" : "#e3d9f6"}"/>
    </g>`;
  }
  if (cubeState.shape === "cuboid") {
    const px = originX + x * 44 - y * 25;
    const py = originY + x * 22 + y * 12 - z * 28;
    const points = (items) => items.map(([dx, dy]) => `${px + dx},${py + dy}`).join(" ");
    return `<g stroke="${reference ? "#8a652b" : "#94652c"}" stroke-width="1.5" stroke-linejoin="round">
      <polygon fill="${reference ? "#d69e37" : "#dca657"}" points="${points([[-25, 12], [19, 34], [19, 62], [-25, 40]])}"/>
      <polygon fill="${reference ? "#edc365" : "#edc183"}" points="${points([[19, 34], [44, 22], [44, 50], [19, 62]])}"/>
      <polygon fill="${reference ? "#fff1ba" : "#ffe2b6"}" points="${points([[0, 0], [44, 22], [19, 34], [-25, 12]])}"/>
    </g>`;
  }
  return drawCube(x, y, z, originX, originY, reference);
}

function renderCubeScene() {
  const name = solidName();
  const cubes = [];
  cubeState.layers.forEach((layer, z) => {
    for (let x = 0; x < layer.width; x += 1) {
      for (let y = 0; y < layer.depth; y += 1) cubes.push({ x, y, z });
    }
  });
  cubes.sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.z - b.z || a.x - b.x);
  document.querySelector("#cubeScene").innerHTML = `<svg viewBox="0 0 760 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="左侧为待计数的叠放${name}，右侧为不计数的一个参照${name}">
    <path d="M110 326 L300 225 L490 326 L300 407 Z" fill="#e0ecef"/>
    ${cubes.map(({ x, y, z }) => drawCountingSolid(x, y, z, 300, 210)).join("")}
    ${drawCountingSolid(0, 0, 0, 605, 275, true)}
    <text x="605" y="377" text-anchor="middle" fill="#75603d" font-size="18">1个${name}</text>
  </svg>`;
}

function newCubeQuestion() {
  clearTimeout(cubeState.nextQuestionId);
  const complex = cubeState.shape === "cuboid" || cubeState.shape === "cylinder";
  const width = randomInt(2, complex ? 4 : 3);
  const depth = randomInt(2, 3);
  const height = randomInt(2, 3);
  const shrinkDepth = complex ? randomInt(0, 1) : 1;
  cubeState.layers = [];
  for (let z = 0; z < height; z += 1) {
    cubeState.layers.push({
      width: cubeState.shape !== "block" ? Math.max(1, width - z) : width,
      depth: cubeState.shape !== "block" ? Math.max(1, depth - z * shrinkDepth) : depth
    });
  }
  cubeState.total = cubeState.layers.reduce((sum, layer) => sum + layer.width * layer.depth, 0);
  cubeState.answered = false;
  cubeInput.value = "";
  cubeInput.disabled = false;
  cubeChoices.querySelectorAll("button").forEach((button) => {
    button.disabled = false;
    button.classList.remove("selected");
  });
  cubeFeedback.textContent = "";
  cubeFeedback.className = "cube-feedback";
  cubeExplanation.hidden = true;
  cubeExplanation.replaceChildren();
  const name = solidName();
  document.querySelector("#solidQuestionTitle").textContent = `一共有几个${name}？`;
  document.querySelector("#solidQuestionRule").textContent = `每层按长方形排满，下面没有空洞。被遮住的${name}也要数。`;
  document.querySelector("#solidReference").textContent = `右侧是一个${name}作参照，不计入左侧的总数。`;
  document.querySelector("#solidAnswerUnit").textContent = `个${name}`;
  cubeInput.setAttribute("aria-label", `${name}总数`);
  cubeChoices.setAttribute("aria-label", `输入${name}总数`);
  renderCubeScene();
}

document.querySelector("#cubeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (activePage !== "cubes" || cubeState.answered) return;
  const raw = cubeInput.value.trim();
  const expected = String(cubeState.total);
  if (expected.startsWith(raw) && raw.length < expected.length) return;
  if (!/^\d+$/.test(raw)) {
    cubeFeedback.textContent = "请先填写答案";
    cubeFeedback.className = "cube-feedback bad";
    return;
  }
  cubeState.answered = true;
  const correct = Number(raw) === cubeState.total;
  cubeState[correct ? "right" : "wrong"] += 1;
  document.querySelector("#cubeRight").textContent = cubeState.right;
  document.querySelector("#cubeWrong").textContent = cubeState.wrong;
  cubeInput.disabled = true;
  cubeChoices.querySelectorAll("button").forEach((button) => {
    button.disabled = true;
    button.classList.toggle("selected", Number(button.dataset.value) === Number(raw));
  });
  cubeFeedback.textContent = correct ? `答对了！一共有 ${cubeState.total} 个${solidName()}。` : `你填了 ${Number(raw)}，一共有 ${cubeState.total} 个${solidName()}。看看每一层吧。`;
  cubeFeedback.className = `cube-feedback ${correct ? "good" : "bad"}`;
  cubeExplanation.innerHTML = `<h2>从下往上，分层数${solidName()}</h2><div class="cube-layer-plans">${cubeState.layers.map((layer, index) => `<div class="cube-layer"><p>第${index + 1}层</p><div class="cube-layer-plan ${cubeState.shape}-plan" style="grid-template-columns:repeat(${layer.width},18px)">${"<i></i>".repeat(layer.width * layer.depth)}</div><p>${layer.width * layer.depth}个</p></div>`).join("")}</div><p>${cubeState.layers.map((layer) => layer.width * layer.depth).join(" + ")} = ${cubeState.total} 个${solidName()}</p>`;
  cubeExplanation.hidden = false;
  if (correct) {
    cubeState.nextQuestionId = setTimeout(() => {
      newCubeQuestion();
      if (activePage === "cubes") cubeInput.focus();
    }, 800);
  }
});

document.querySelectorAll("[data-shape]").forEach((button) => {
  button.addEventListener("click", () => {
    cubeState.shape = button.dataset.shape;
    document.querySelectorAll("[data-shape]").forEach((item) => {
      item.classList.toggle("active", item === button);
      item.setAttribute("aria-pressed", String(item === button));
    });
    newCubeQuestion();
  });
});
document.querySelector("#cubeNext").addEventListener("click", () => { newCubeQuestion(); cubeInput.focus(); });
document.querySelector("#cubeReset").addEventListener("click", () => {
  cubeState.right = 0;
  cubeState.wrong = 0;
  document.querySelector("#cubeRight").textContent = "0";
  document.querySelector("#cubeWrong").textContent = "0";
  newCubeQuestion();
});
for (let number = 0; number <= 9; number += 1) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cube-number";
  button.dataset.value = String(number);
  button.textContent = number;
  button.setAttribute("aria-label", `输入数字 ${number}`);
  cubeChoices.appendChild(button);
}
cubeChoices.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-value]");
  if (!button || button.disabled || activePage !== "cubes" || cubeState.answered) return;
  appendCubeDigit(button.dataset.value);
});
function appendCubeDigit(digit) {
  if (activePage !== "cubes" || cubeState.answered) return;
  if (!/^\d$/.test(digit)) return;
  cubeInput.value += digit;
  const expected = String(cubeState.total);
  if (!expected.startsWith(cubeInput.value) || cubeInput.value.length === expected.length) document.querySelector("#cubeForm").requestSubmit();
}
document.addEventListener("keydown", (event) => {
  if (activePage !== "cubes" || cubeState.answered || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat) return;
  if (event.target && event.target !== cubeInput && (event.target.matches("input, textarea, select") || event.target.isContentEditable)) return;
  if (!/^\d$/.test(event.key) && !["Backspace", "Escape", "Enter"].includes(event.key)) return;
  event.preventDefault();
  if (/^\d$/.test(event.key)) appendCubeDigit(event.key);
  else if (event.key === "Backspace") cubeInput.value = cubeInput.value.slice(0, -1);
  else if (event.key === "Escape") cubeInput.value = "";
  else if (cubeInput.value) document.querySelector("#cubeForm").requestSubmit();
});
newCubeQuestion();
