const cubeState = { shape: "block", layers: [], total: 0, right: 0, wrong: 0, answered: false, nextQuestionId: null };
const cubeInput = document.querySelector("#cubeAnswer");
const cubeFeedback = document.querySelector("#cubeFeedback");
const cubeExplanation = document.querySelector("#cubeExplanation");
const exercisePages = ["arithmetic", "cubes", "comparison"];

function switchExercise(page) {
  if (page === activePage) return;
  if (activePage === "arithmetic" && state.running) {
    updateCountdown();
    if (state.running) arithmeticPausedAt = Date.now();
  }
  activePage = page;
  if (page === "arithmetic" && arithmeticPausedAt !== null) {
    if (state.running) state.startedAt += Date.now() - arithmeticPausedAt;
    arithmeticPausedAt = null;
  }
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

function renderCubeScene() {
  const cubes = [];
  cubeState.layers.forEach((layer, z) => {
    for (let x = 0; x < layer.width; x += 1) {
      for (let y = 0; y < layer.depth; y += 1) cubes.push({ x, y, z });
    }
  });
  cubes.sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.z - b.z || a.x - b.x);
  document.querySelector("#cubeScene").innerHTML = `<svg viewBox="0 0 760 420" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="左侧为待计数的叠放方块，右侧为不计数的一个参照方块">
    <path d="M110 326 L300 225 L490 326 L300 407 Z" fill="#e0ecef"/>
    ${cubes.map(({ x, y, z }) => drawCube(x, y, z, 300, 210)).join("")}
    ${drawCube(0, 0, 0, 605, 275, true)}
    <text x="605" y="377" text-anchor="middle" fill="#75603d" font-size="18">1个小方块</text>
  </svg>`;
}

function newCubeQuestion() {
  clearTimeout(cubeState.nextQuestionId);
  const width = randomInt(2, 3);
  const depth = randomInt(2, 3);
  const height = randomInt(2, 3);
  cubeState.layers = [];
  for (let z = 0; z < height; z += 1) {
    cubeState.layers.push({
      width: cubeState.shape === "steps" ? Math.max(1, width - z) : width,
      depth: cubeState.shape === "steps" ? Math.max(1, depth - z) : depth
    });
  }
  cubeState.total = cubeState.layers.reduce((sum, layer) => sum + layer.width * layer.depth, 0);
  cubeState.answered = false;
  cubeInput.value = "";
  cubeInput.disabled = false;
  document.querySelector("#cubeSubmit").disabled = false;
  cubeFeedback.textContent = "";
  cubeFeedback.className = "cube-feedback";
  cubeExplanation.hidden = true;
  cubeExplanation.replaceChildren();
  renderCubeScene();
}

document.querySelector("#cubeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (activePage !== "cubes" || cubeState.answered) return;
  const raw = cubeInput.value.trim();
  if (!/^\d{1,2}$/.test(raw) || Number(raw) < 1) {
    cubeFeedback.textContent = "请填写一个大于0的整数";
    cubeFeedback.className = "cube-feedback bad";
    return;
  }
  cubeState.answered = true;
  const correct = Number(raw) === cubeState.total;
  cubeState[correct ? "right" : "wrong"] += 1;
  document.querySelector("#cubeRight").textContent = cubeState.right;
  document.querySelector("#cubeWrong").textContent = cubeState.wrong;
  cubeInput.disabled = true;
  document.querySelector("#cubeSubmit").disabled = true;
  cubeFeedback.textContent = correct ? `答对了！一共有 ${cubeState.total} 个小方块。` : `你填了 ${Number(raw)}，一共有 ${cubeState.total} 个。看看每一层吧。`;
  cubeFeedback.className = `cube-feedback ${correct ? "good" : "bad"}`;
  cubeExplanation.innerHTML = `<h2>从下往上，分层数一数</h2><div class="cube-layer-plans">${cubeState.layers.map((layer, index) => `<div class="cube-layer"><p>第${index + 1}层</p><div class="cube-layer-plan" style="grid-template-columns:repeat(${layer.width},18px)">${"<i></i>".repeat(layer.width * layer.depth)}</div><p>${layer.width * layer.depth}个</p></div>`).join("")}</div><p>${cubeState.layers.map((layer) => layer.width * layer.depth).join(" + ")} = ${cubeState.total} 个</p>`;
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
newCubeQuestion();
