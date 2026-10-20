    const groups = {
      "声母": "b p m f d t n l g k h j q x zh ch sh r z c s y w".split(" "),
      "韵母": "a o e i u ü ai ei ui ao ou iu ie üe er an en in un ün ang eng ing ong".split(" "),
      "整体认读音节": "zhi chi shi ri zi ci si yi wu yu ye yue yuan yin yun ying".split(" ")
    };
    const words = [
      ["山","shān",1],["水","shuǐ",3],["火","huǒ",3],["日","rì",4],["月","yuè",4],["木","mù",4],
      ["人","rén",2],["口","kǒu",3],["手","shǒu",3],["目","mù",4],["耳","ěr",3],["足","zú",2],
      ["天","tiān",1],["田","tián",2],["土","tǔ",3],["禾","hé",2],["米","mǐ",3],["石","shí",2],
      ["云","yún",2],["雨","yǔ",3],["风","fēng",1],["花","huā",1],["鸟","niǎo",3],["鱼","yú",2],
      ["牛","niú",2],["羊","yáng",2],["马","mǎ",3],["大","dà",4],["小","xiǎo",3],["上","shàng",4],
      ["下","xià",4],["左","zuǒ",3],["右","yòu",4],["多","duō",1],["少","shǎo",3],["白","bái",2],
      ["红","hóng",2],["绿","lǜ",4],["书","shū",1],["车","chē",1]
    ];
    const names = { groups: "拼音分类", words: "看拼音选汉字", tones: "声调练习" };
    const toneNames = ["第一声", "第二声", "第三声", "第四声"];
    const $ = (id) => document.getElementById(id);
    const state = { mode: "groups", running: false, answered: false, queue: [], index: 0, attempts: [], right: 0, wrong: 0, started: 0, timer: null, next: null, review: false };
    const storageKey = "chinesePinyinHistory.v1";
    let records = readRecords(), latest = null, viewed = null;
    function readRecords() { try { const data = JSON.parse(localStorage.getItem(storageKey)); return Array.isArray(data) ? data.slice(0, 10) : []; } catch { return []; } }
    function shuffle(items) { const result = [...items]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; }
    function timeText(ms) { const seconds = Math.floor(ms / 1000); return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
    function bank(mode) {
      if (mode === "groups") return Object.entries(groups).flatMap(([answer, items]) => items.map(stem => ({ stem, answer, prompt: "它属于哪一类？", options: Object.keys(groups), explanation: `${stem} 属于${answer}。` })));
      if (mode === "tones") return words.map(([character, stem, tone]) => ({ stem, answer: toneNames[tone - 1], prompt: "这是第几声？", options: toneNames, explanation: `${stem} 是${toneNames[tone - 1]}。` }));
      const pronunciations = new Set();
      return shuffle(words).filter((item) => { if (pronunciations.has(item[1])) return false; pronunciations.add(item[1]); return true; }).map(([answer, stem]) => ({ stem, answer, prompt: "哪个汉字读这个拼音？", options: shuffle([answer, ...shuffle(words.filter(item => item[1] !== stem)).slice(0, 3).map(item => item[0])]), explanation: `${answer} 读 ${stem}。` }));
    }
    function stats() { $("right").textContent = state.right; $("wrong").textContent = state.wrong; $("progress").textContent = `${state.attempts.length}/${state.queue.length || Number($("length").value)}`; }
    function renderQuestion() {
      clearTimeout(state.next);
      const q = state.queue[state.index];
      state.answered = false;
      $("prompt").textContent = q.prompt; $("stem").textContent = q.stem;
      $("feedback").textContent = ""; $("next").disabled = true;
      $("options").replaceChildren();
      shuffle(q.options).forEach(answer => {
        const button = document.createElement("button"); button.type = "button"; button.className = "option"; button.textContent = answer; button.disabled = !state.running;
        button.addEventListener("click", () => submit(answer, button)); $("options").appendChild(button);
      });
      $("sessionLabel").textContent = state.running ? `${state.review ? "错题重做" : names[state.mode]} · 第${state.index + 1}题` : "准备开始";
    }
    function submit(answer, button) {
      if (!state.running || state.answered) return;
      state.answered = true;
      const q = state.queue[state.index], correct = answer === q.answer;
      state[correct ? "right" : "wrong"]++;
      state.attempts.push({ ...q, selected: answer, correct });
      $("options").querySelectorAll("button").forEach(item => { item.disabled = true; if (item.textContent === q.answer) item.classList.add("correct"); });
      button.classList.add(correct ? "correct" : "wrong");
      $("feedback").textContent = `${correct ? "答对了！" : "再记一记："}${q.explanation}`;
      stats();
      if (state.index + 1 === state.queue.length) { finish(); return; }
      $("next").disabled = false;
      if (correct) state.next = setTimeout(nextQuestion, 1000);
    }
    function nextQuestion() { if (!state.running || !state.answered) return; state.index++; renderQuestion(); }
    function prepare() {
      clearTimeout(state.next); clearInterval(state.timer); state.running = false; state.review = false; state.attempts = []; state.right = 0; state.wrong = 0; state.index = 0;
      state.queue = shuffle(bank(state.mode)).slice(0, Number($("length").value));
      $("time").textContent = "00:00"; $("details").hidden = true; $("start").disabled = false; $("finish").disabled = true;
      stats(); renderQuestion();
    }
    function begin(queue = null) {
      prepare(); if (queue) { state.queue = queue.map(item => ({ stem: item.stem, answer: item.answer, prompt: item.prompt, options: [...item.options], explanation: item.explanation })); state.review = true; }
      state.running = true; state.started = Date.now(); $("start").disabled = true; $("finish").disabled = false;
      state.timer = setInterval(() => $("time").textContent = timeText(Date.now() - state.started), 250);
      stats(); renderQuestion();
    }
    function finish() {
      if (!state.running) return;
      state.running = false; clearInterval(state.timer); clearTimeout(state.next);
      const elapsed = timeText(Date.now() - state.started); $("time").textContent = elapsed;
      $("options").querySelectorAll("button").forEach(item => item.disabled = true);
      $("start").disabled = false; $("finish").disabled = true; $("next").disabled = true; $("details").hidden = false;
      $("sessionLabel").textContent = "练习结束";
      latest = { mode: state.mode, label: `${names[state.mode]}${state.review ? " · 错题重做" : ""}`, date: new Date().toLocaleString("zh-CN"), right: state.right, wrong: state.wrong, elapsed, attempts: state.attempts.slice() };
      records.unshift(latest); records = records.slice(0, 10);
      try { localStorage.setItem(storageKey, JSON.stringify(records)); } catch { $("feedback").textContent += " 当前浏览器无法保存成绩，关闭页面后可能丢失。"; }
      renderRecords(); showDetails(latest);
    }
    function renderRecords() {
      $("history").replaceChildren();
      if (!records.length) { const p = document.createElement("p"); p.className = "empty"; p.textContent = "暂无成绩"; $("history").appendChild(p); }
      records.forEach(record => {
        const row = document.createElement("div"); row.className = "record";
        const text = document.createElement("p"); text.textContent = `${record.label} · ${record.date}　答对${record.right}题 / 答错${record.wrong}题　用时${record.elapsed}`;
        const button = document.createElement("button"); button.type = "button"; button.className = "action secondary"; button.textContent = "查看详情"; button.addEventListener("click", () => showDetails(record));
        row.append(text, button); $("history").appendChild(row);
      });
    }
    function showDetails(record) {
      viewed = record; $("summary").textContent = `${record.label} · 答对${record.right}题 · 答错${record.wrong}题 · 用时${record.elapsed}`;
      const wrong = record.attempts.filter(item => !item.correct); $("retry").disabled = wrong.length === 0; $("retry").textContent = wrong.length ? `错题重做（${wrong.length}题）` : "全部答对，无需重做";
      $("rows").replaceChildren();
      record.attempts.forEach((item, index) => {
        const row = document.createElement("div"); row.className = "review-row";
        const title = document.createElement("p"); title.textContent = `${index + 1}. ${item.stem} · ${item.prompt}`;
        const answer = document.createElement("p"); answer.className = item.correct ? "good" : "bad"; answer.textContent = `填写：${item.selected}　正确：${item.answer}　${item.correct ? "正确" : "错误"}`;
        row.append(title, answer); $("rows").appendChild(row);
      });
      if (!record.attempts.length) $("rows").textContent = "本次没有提交答案";
      if (!$("detailDialog").open) $("detailDialog").showModal();
    }
    document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      document.querySelectorAll("[data-mode]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
      prepare();
    }));
    $("length").addEventListener("change", prepare); $("start").addEventListener("click", () => begin()); $("next").addEventListener("click", nextQuestion); $("finish").addEventListener("click", finish); $("details").addEventListener("click", () => showDetails(latest));
    $("retry").addEventListener("click", () => { const wrong = viewed.attempts.filter(item => !item.correct); if (!wrong.length) return; state.mode = viewed.mode; document.querySelectorAll("[data-mode]").forEach(item => item.setAttribute("aria-pressed", String(item.dataset.mode === state.mode))); $("detailDialog").close(); begin(wrong); });
    renderRecords(); prepare();
    const blends = [
      ["b","ā","bā","八",1],["b","á","bá","拔",2],["b","ǎ","bǎ","把",3],["b","à","bà","爸",4],["b","ǐ","bǐ","笔",3],
      ["p","ā","pā","趴",1],["p","á","pá","爬",2],["p","à","pà","怕",4],["p","í","pí","皮",2],
      ["m","ā","mā","妈",1],["m","á","má","麻",2],["m","ǎ","mǎ","马",3],["m","à","mà","骂",4],["m","ǐ","mǐ","米",3],
      ["f","ā","fā","发",1],["f","á","fá","罚",2],["f","ǎ","fǎ","法",3],["f","ēi","fēi","飞",1],
      ["d","ā","dā","搭",1],["d","ǎ","dǎ","打",3],["d","à","dà","大",4],["d","ī","dī","低",1],
      ["t","ā","tā","他",1],["t","ǎ","tǎ","塔",3],["t","ù","tù","兔",4],["t","í","tí","题",2],
      ["n","á","ná","拿",2],["n","ǎ","nǎ","哪",3],["n","ǐ","nǐ","你",3],["n","ǚ","nǚ","女",3],
      ["l","ā","lā","拉",1],["l","í","lí","梨",2],["l","ǐ","lǐ","李",3],["l","ǜ","lǜ","绿",4],
      ["g","ē","gē","哥",1],["g","ǒu","gǒu","狗",3],["g","ǔ","gǔ","古",3],
      ["k","ē","kē","科",1],["k","ǒu","kǒu","口",3],["k","ǔ","kǔ","苦",3],
      ["h","ē","hē","喝",1],["h","é","hé","河",2],["h","ǔ","hǔ","虎",3],
      ["j","ī","jī","鸡",1],["j","ǐ","jǐ","几",3],["j","ǖ","jū","居",1],
      ["q","ī","qī","七",1],["q","í","qí","旗",2],["q","ǖ","qū","区",1],
      ["x","ī","xī","西",1],["x","ǐ","xǐ","洗",3],["x","ǖ","xū","需",1],
      ["zh","ū","zhū","猪",1],["zh","ú","zhú","竹",2],["zh","ǔ","zhǔ","主",3],
      ["ch","ē","chē","车",1],["ch","á","chá","茶",2],["ch","ǐ","chǐ","尺",3],
      ["sh","ū","shū","书",1],["sh","é","shé","蛇",2],["sh","ǒu","shǒu","手",3],
      ["r","ì","rì","日",4],["r","ě","rě","惹",3],
      ["z","ǎo","zǎo","早",3],["z","ǒu","zǒu","走",3],
      ["c","ǎo","cǎo","草",3],["c","ū","cū","粗",1],
      ["s","ān","sān","三",1],["s","ì","sì","四",4]
    ];
    let selectedBlend = blends[0], chineseVoices = [], spoken = null, speechVersion = 0, pausedAt = null;
    const synth = window.speechSynthesis;
    function stopBlendSpeech() { speechVersion++; if (synth) synth.cancel(); spoken = null; $("blendListen").disabled = !synth; }
    function renderBlend() {
      stopBlendSpeech();
      const [initial, final, syllable, character, tone] = selectedBlend;
      $("blendInitial").textContent = initial; $("blendFinal").textContent = final; $("blendSyllable").textContent = syllable; $("blendCharacter").textContent = character; $("blendTone").textContent = toneNames[tone - 1];
      $("blendSpelling").hidden = !["j", "q", "x"].includes(initial) || !final.includes("ü");
      $("blendStatus").textContent = synth ? "" : "当前浏览器不支持语音播放，可继续拼读练习。";
      $("blendInitials").replaceChildren();
      [...new Set(blends.map(item => item[0]))].forEach(value => {
        const button = document.createElement("button"); button.type = "button"; button.className = "blend-choice"; button.textContent = value; button.setAttribute("aria-pressed", String(value === initial));
        button.addEventListener("click", () => { selectedBlend = blends.find(item => item[0] === value); renderBlend(); }); $("blendInitials").appendChild(button);
      });
      $("blendFinals").replaceChildren();
      blends.filter(item => item[0] === initial).forEach(item => {
        const button = document.createElement("button"); button.type = "button"; button.className = "blend-choice"; button.textContent = item[1]; button.setAttribute("aria-pressed", String(item === selectedBlend));
        button.addEventListener("click", () => { selectedBlend = item; renderBlend(); }); $("blendFinals").appendChild(button);
      });
    }
    function loadChineseVoices() {
      const oldVoice = $("blendVoice").value;
      chineseVoices = synth ? synth.getVoices().filter(voice => /^zh(?:-|_)/i.test(voice.lang) && !/yue|HK|TW/i.test(voice.lang)) : [];
      $("blendVoice").replaceChildren();
      const automatic = document.createElement("option"); automatic.value = ""; automatic.textContent = "系统普通话"; $("blendVoice").appendChild(automatic);
      chineseVoices.forEach(voice => { const option = document.createElement("option"); option.value = voice.voiceURI; option.textContent = voice.name; $("blendVoice").appendChild(option); });
      if (chineseVoices.some(voice => voice.voiceURI === oldVoice)) $("blendVoice").value = oldVoice;
    }
    $("blendListen").addEventListener("click", () => {
      if (!synth || typeof window.SpeechSynthesisUtterance !== "function") return;
      stopBlendSpeech(); loadChineseVoices();
      const voice = chineseVoices.find(item => item.voiceURI === $("blendVoice").value) || chineseVoices.find(item => /^zh[-_]CN$/i.test(item.lang)) || chineseVoices[0];
      if (!voice) { $("blendStatus").textContent = "暂未找到普通话声音，请检查设备中文语音设置后重试。"; return; }
      const version = speechVersion;
      spoken = new window.SpeechSynthesisUtterance(selectedBlend[3]);
      spoken.lang = "zh-CN"; spoken.voice = voice; spoken.rate = Number($("blendRate").value); spoken.pitch = 1;
      spoken.onstart = () => { if (version === speechVersion) $("blendStatus").textContent = `正在带读：${selectedBlend[3]}`; };
      spoken.onend = () => { if (version === speechVersion) { $("blendStatus").textContent = "请跟着读一读"; $("blendListen").disabled = false; spoken = null; } };
      spoken.onerror = () => { if (version === speechVersion) { $("blendStatus").textContent = "播放未完成，请检查音量或稍后重试。"; $("blendListen").disabled = false; spoken = null; } };
      $("blendListen").disabled = true;
      try { synth.speak(spoken); } catch { $("blendStatus").textContent = "当前声音无法播放，请换一个声音重试。"; $("blendListen").disabled = false; }
    });
    $("blendRandom").addEventListener("click", () => { selectedBlend = shuffle(blends.filter(item => item !== selectedBlend))[0]; renderBlend(); });
    $("blendStop").addEventListener("click", () => { stopBlendSpeech(); $("blendStatus").textContent = "已停止播放"; });
    function selectLearningPage(page) {
      stopBlendSpeech();
      const quiz = page === "quiz";
      if (!quiz && state.running && pausedAt === null) { pausedAt = Date.now(); clearInterval(state.timer); clearTimeout(state.next); }
      if (quiz && pausedAt !== null) {
        if (state.running) { state.started += Date.now() - pausedAt; state.timer = setInterval(() => $("time").textContent = timeText(Date.now() - state.started), 250); if (state.answered && state.attempts.at(-1)?.correct) state.next = setTimeout(nextQuestion, 1000); }
        pausedAt = null;
      }
      $("blendPanel").hidden = quiz; $("quizPanel").hidden = !quiz;
      ["blend", "quiz"].forEach(name => { $(name + "Tab").setAttribute("aria-selected", String(name === page)); $(name + "Tab").tabIndex = name === page ? 0 : -1; });
    }
    ["blend", "quiz"].forEach(name => {
      $(name + "Tab").addEventListener("click", () => selectLearningPage(name));
      $(name + "Tab").addEventListener("keydown", event => { if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const next = event.key === "Home" ? "blend" : event.key === "End" ? "quiz" : name === "blend" ? "quiz" : "blend"; selectLearningPage(next); $(next + "Tab").focus(); });
    });
    if (synth) synth.addEventListener("voiceschanged", loadChineseVoices);
    window.addEventListener("pagehide", stopBlendSpeech);
    loadChineseVoices(); renderBlend();
