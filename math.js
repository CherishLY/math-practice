    let activePage = "arithmetic";
    let arithmeticPausedAt = null;
    const formulaTextEl = document.querySelector("#formulaText");
    const formulaPrefixEl = document.querySelector("#formulaPrefix");
    const startButton = document.querySelector("#startButton");
    const pauseButton = document.querySelector("#pauseButton");
    const duration = 10 * 60 * 1000;
    const timedButton = document.querySelector("#timedButton");
    const hundredButton = document.querySelector("#hundredButton");
    const specialtyPanel = document.querySelector("#specialtyPanel");
    const operationLabels = {
      mixed: "加减混合", chainAdd: "连加", chainSub: "连减",
      addFirst: "找第一个加数（□ + 数 = 数）",
      addSecond: "找第二个加数（数 + □ = 数）",
      addResult: "求和（数 + 数 = □）",
      subFirst: "找被减数（□ - 数 = 数）",
      subSecond: "找减数（数 - □ = 数）",
      subResult: "求差（数 - 数 = □）"
    };
    const answerSlotEl = document.querySelector("#answerSlot");
    const answerForm = document.querySelector("#answerForm");
    const messageEl = document.querySelector("#message");
    const choicesEl = document.querySelector("#choices");
    const timerEl = document.querySelector("#timer");
    const rightCountEl = document.querySelector("#rightCount");
    const wrongCountEl = document.querySelector("#wrongCount");
    const totalCountEl = document.querySelector("#totalCount");
    const nextButton = document.querySelector("#nextButton");
    const resetButton = document.querySelector("#resetButton");
    const tenModeButton = document.querySelector("#tenModeButton");
    const twentyModeButton = document.querySelector("#twentyModeButton");
    const mixedModeButton = document.querySelector("#mixedModeButton");
    const chainAddButton = document.querySelector("#chainAddButton");
    const chainSubButton = document.querySelector("#chainSubButton");
    const finishButton = document.querySelector("#finishButton");
    const historyListEl = document.querySelector("#historyList");
    const historyKey = "mathPracticeResults";
    let sessionHistory = null;
    const rewardKey = "mathPracticeStars";
    const starStatus = document.querySelector("#starStatus");
    let rewards = loadRewards();

    function loadRewards() {
      try {
        const saved = JSON.parse(localStorage.getItem(rewardKey));
        if (saved && Number.isSafeInteger(saved.balance) && saved.balance >= 0 && Number.isSafeInteger(saved.progress) && saved.progress >= 0 && saved.progress < 10) {
          return { balance: saved.balance, progress: saved.progress };
        }
      } catch (error) {
        // Keep practice usable if local storage is unavailable.
      }
      return { balance: 0, progress: 0 };
    }

    function renderRewards() {
      document.querySelector("#starBalance").textContent = rewards.balance;
      document.querySelector("#starProgress").textContent = `加减法与数的组成再答对${10 - rewards.progress}题，获得1颗星星`;
    }

    function persistRewards() {
      renderRewards();
      try {
        localStorage.setItem(rewardKey, JSON.stringify(rewards));
      } catch (error) {
        starStatus.textContent = "当前浏览器无法保存星星，关闭页面后可能丢失。";
      }
    }

    function rewardCorrectAnswer() {
      rewards.progress += 1;
      if (rewards.progress === 10) {
        rewards.progress = 0;
        rewards.balance += 1;
        starStatus.textContent = "累计答对10题，获得1颗星星！";
      }
      persistRewards();
    }
    const detailsButton = document.querySelector("#detailsButton");
    const detailsDialog = document.querySelector("#detailsDialog");
    const retryWrongButton = document.querySelector("#retryWrongButton");
    let viewedRecord = null;
    let latestRecord = null;

    const state = {
      maxNumber: 20,
      operation: "mixed",
      trainingMode: "timed",
      reviewQueue: [],
      reviewLabel: "",
      answer: 0,
      typedAnswer: "",
      attempts: [],
      right: 0,
      wrong: 0,
      total: 0,
      answered: false,
      finished: false,
      running: false,
      paused: false,
      recordSaved: false,
      startedAt: Date.now(),
      timerId: null,
      nextQuestionId: null
    };

    function randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function splitIntoTwo(total) {
      const first = randomInt(1, total - 1);
      return [first, total - first];
    }

    function makeQuestion() {
      clearTimeout(state.nextQuestionId);
      if (state.finished) {
        return;
      }

      if (state.trainingMode === "review") {
        const question = state.reviewQueue[state.total];
        if (!question) return;
        const [prefix, suffix] = question.question.split("□");
        formulaPrefixEl.textContent = prefix.trim();
        formulaTextEl.textContent = suffix.trim();
        state.answer = question.answer;
        prepareQuestionInput();
        return;
      }

      const isAddition = state.operation.startsWith("add") ||
        (state.operation === "mixed" && Math.random() >= 0.5);
      let left;
      let right;
      let answer;

      if (state.operation === "chainAdd") {
        answer = randomInt(3, state.maxNumber);
        left = randomInt(1, answer - 2);
        right = randomInt(1, answer - left - 1);
        const third = answer - left - right;
        formulaTextEl.textContent = `${left} + ${right} + ${third} =`;
      } else if (state.operation === "chainSub") {
        left = randomInt(3, state.maxNumber);
        answer = randomInt(1, left - 2);
        const [firstSub, secondSub] = splitIntoTwo(left - answer);
        formulaTextEl.textContent = `${left} - ${firstSub} - ${secondSub} =`;
      } else if (isAddition) {
        answer = randomInt(2, state.maxNumber);
        left = randomInt(1, answer - 1);
        right = answer - left;
      } else {
        left = randomInt(2, state.maxNumber);
        answer = randomInt(1, left - 1);
        right = left - answer;
        formulaTextEl.textContent = `${left} - ${right} =`;
      }

      if (isAddition) {
        formulaTextEl.textContent = `${left} + ${right} =`;
      }

      const tokens = `${formulaTextEl.textContent} ${answer}`.trim().split(/\s+/);
      const positions = tokens.map((token, index) => /^\d+$/.test(token) ? index : -1).filter((index) => index >= 0);
      const fixedPosition = state.operation.endsWith("First") ? 0 :
        state.operation.endsWith("Second") ? 1 : state.operation.endsWith("Result") ? 2 : null;
      const blank = positions[fixedPosition === null ? randomInt(0, positions.length - 1) : fixedPosition];
      state.answer = Number(tokens[blank]);
      formulaPrefixEl.textContent = tokens.slice(0, blank).join(" ");
      formulaTextEl.textContent = tokens.slice(blank + 1).join(" ");
      prepareQuestionInput();
    }

    function prepareQuestionInput() {
      state.answered = false;
      nextButton.disabled = true;
      state.typedAnswer = "";
      answerSlotEl.value = "";
      answerSlotEl.readOnly = true;
      answerSlotEl.className = "answer-slot empty";
      messageEl.textContent = "";
      messageEl.className = "message";

      document.querySelectorAll(".choice").forEach((button) => {
        button.classList.remove("correct", "wrong");
        button.disabled = !state.running || state.paused;
      });
    }

    function renderChoices() {
      choicesEl.innerHTML = "";
      for (let number = 0; number <= 9; number += 1) {
        const button = document.createElement("button");
        button.className = "choice";
        button.type = "button";
        button.textContent = number;
        button.dataset.value = String(number);
        button.setAttribute("aria-label", `输入数字 ${number}`);
        choicesEl.appendChild(button);
      }
    }

    function updateStats() {
      rightCountEl.textContent = state.right;
      wrongCountEl.textContent = state.wrong;
      totalCountEl.textContent = state.trainingMode === "review" ? `${state.total}/${state.reviewQueue.length}` : state.trainingMode === "hundred" ? `${state.total}/100` : state.total;
      updateQuestionProgress();
    }

    function updateQuestionProgress() {
      document.querySelector("#questionProgress").hidden = false;
      document.querySelector("#questionTimeLabel").textContent = state.trainingMode === "timed" ? "剩余时间" : "已用时间";
      document.querySelector("#questionElapsed").textContent = timerEl.textContent;
      document.querySelector("#questionCompleted").textContent = state.trainingMode === "timed" ? `已答${state.total}题` : `${state.total}/${state.trainingMode === "review" ? state.reviewQueue.length : 100}`;
      document.querySelector("#questionPaused").hidden = !state.running || !state.paused;
    }

    function formatTime(milliseconds) {
      const totalSeconds = Math.floor(milliseconds / 1000);
      const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
      const seconds = String(totalSeconds % 60).padStart(2, "0");
      return `${minutes}:${seconds}`;
    }

    function startTimer() {
      clearInterval(state.timerId);
      state.startedAt = Date.now();
      state.finished = false;
      state.running = true;
      state.paused = false;
      arithmeticPausedAt = null;
      syncArithmeticPause();
      timerEl.textContent = state.trainingMode !== "timed" ? "00:00" : "10:00";
      updateQuestionProgress();
      state.timerId = setInterval(updateCountdown, 200);
    }

    function updateCountdown() {
      if (!state.running || state.paused || activePage !== "arithmetic") return;
      if (state.trainingMode !== "timed") {
        timerEl.textContent = formatTime(arithmeticElapsed());
        updateQuestionProgress();
        return;
      }
      const remaining = Math.max(0, duration - arithmeticElapsed());
      timerEl.textContent = formatTime(Math.ceil(remaining / 1000) * 1000);
      updateQuestionProgress();
      if (remaining === 0) finishGame();
    }

    function arithmeticElapsed() {
      return Math.max(0, (arithmeticPausedAt === null ? Date.now() : arithmeticPausedAt) - state.startedAt);
    }

    function scheduleArithmeticNext() {
      clearTimeout(state.nextQuestionId);
      if (!state.running || state.paused || activePage !== "arithmetic" || !state.answered) return;
      state.nextQuestionId = setTimeout(() => {
        updateCountdown();
        if (state.running && !state.paused && activePage === "arithmetic") makeQuestion();
      }, 800);
    }

    function syncArithmeticPause() {
      const shouldPause = state.running && (state.paused || activePage !== "arithmetic");
      if (shouldPause && arithmeticPausedAt === null) {
        arithmeticPausedAt = Date.now();
        clearTimeout(state.nextQuestionId);
      } else if (!shouldPause && arithmeticPausedAt !== null && state.running) {
        state.startedAt += Date.now() - arithmeticPausedAt;
        arithmeticPausedAt = null;
        scheduleArithmeticNext();
      }
      pauseButton.disabled = !state.running;
      pauseButton.textContent = state.paused ? "继续" : "暂停";
      pauseButton.setAttribute("aria-pressed", String(state.paused));
      document.querySelectorAll(".choice").forEach(button => {
        button.disabled = !state.running || shouldPause || state.answered;
      });
      if (state.paused) {
        messageEl.textContent = "已暂停";
        messageEl.className = "message";
      }
      updateQuestionProgress();
    }

    function toggleArithmeticPause() {
      if (!state.running) return;
      updateCountdown();
      if (!state.running) return;
      state.paused = !state.paused;
      syncArithmeticPause();
      if (!state.paused) {
        messageEl.textContent = state.answered ? "即将进入下一题" : "";
        updateCountdown();
      }
    }

    function markWrongChoice(selected) {
      const button = document.querySelector(`.choice[data-value="${selected}"]`);
      if (button) {
        button.classList.add("wrong");
        button.disabled = true;
      }
    }

    function submitAnswer(selected) {
      if (!state.running || state.paused || activePage !== "arithmetic" || state.finished || state.answered || !Number.isInteger(selected)) {
        return;
      }
      if (state.trainingMode === "timed" && arithmeticElapsed() >= duration) {
        finishGame();
        return;
      }

      if (selected < 0) {
        answerSlotEl.value = String(selected);
        answerSlotEl.className = "answer-slot bad";
        messageEl.textContent = `请输入 1 到 ${state.maxNumber} 之间的数字`;
        messageEl.className = "message bad";
        state.typedAnswer = "";
        return;
      }

      state.total += 1;
      state.attempts.push({
        question: `${formulaPrefixEl.textContent} □ ${formulaTextEl.textContent}`.trim(),
        selected,
        answer: state.answer,
        correct: selected === state.answer
      });
      state.answered = true;
      answerSlotEl.value = String(selected);
      answerSlotEl.readOnly = true;

      if (selected === state.answer) {
        state.answered = true;
        state.right += 1;
        rewardCorrectAnswer();
        answerSlotEl.className = "answer-slot good";
        const correctButton = document.querySelector(`.choice[data-value="${selected}"]`);
        if (correctButton) {
          correctButton.classList.add("correct");
        }
        document.querySelectorAll(".choice").forEach((choice) => {
          choice.disabled = true;
        });
        messageEl.textContent = "答对了！";
        messageEl.className = "message good";
      } else {
        state.wrong += 1;
        answerSlotEl.className = "answer-slot bad";
        state.typedAnswer = "";
        markWrongChoice(selected);
        messageEl.textContent = "答错了，继续下一题";
        messageEl.className = "message bad";
      }

      updateStats();
      document.querySelectorAll(".choice").forEach((choice) => {
        choice.disabled = true;
      });
      clearTimeout(state.nextQuestionId);
      if ((state.trainingMode === "hundred" && state.total >= 100) || (state.trainingMode === "review" && state.total >= state.reviewQueue.length)) {
        finishGame();
        return;
      }
      scheduleArithmeticNext();
    }

    function chooseAnswer(event) {
      const button = event.target.closest(".choice");
      if (!button || button.disabled) {
        return;
      }

      appendArithmeticDigit(button.dataset.value);
    }

    function appendArithmeticDigit(digit) {
      if (activePage !== "arithmetic" || !state.running || state.paused || state.answered) return;
      if (!/^\d$/.test(digit)) return;
      state.typedAnswer += digit;
      answerSlotEl.value = state.typedAnswer;
      answerSlotEl.className = "answer-slot";
      const selected = Number(state.typedAnswer);
      const expected = String(state.answer);
      if (!expected.startsWith(state.typedAnswer) || state.typedAnswer.length === expected.length) submitAnswer(selected);
    }

    function resetGame() {
      clearTimeout(state.nextQuestionId);
      clearInterval(state.timerId);
      state.running = false;
      state.paused = false;
      arithmeticPausedAt = null;
      syncArithmeticPause();
      state.finished = false;
      state.right = 0;
      state.wrong = 0;
      state.total = 0;
      state.recordSaved = false;
      state.attempts = [];
      detailsButton.hidden = true;
      finishButton.classList.remove("active");
      updateStats();
      timerEl.textContent = state.trainingMode !== "timed" ? "00:00" : "10:00";
      updateQuestionProgress();
      document.querySelector("#totalLabel").textContent = state.trainingMode === "review" ? "错题重做进度" : "已答题数";
      document.querySelector("#timerLabel").textContent = state.trainingMode !== "timed" ? "总用时" : "剩余时间";
      startButton.disabled = false;
      nextButton.disabled = true;
      finishButton.disabled = true;
      renderChoices();
      makeQuestion();
      messageEl.textContent = "准备好了";
    }

    function startGame() {
      if (state.running) return;
      resetGame();
      startTimer();
      startButton.disabled = true;
      finishButton.disabled = false;
      makeQuestion();
      answerSlotEl.focus();
    }

    function handleKeyboard(event) {
      if (activePage !== "arithmetic" || detailsDialog.open) return;
      if (event.target && event.target !== answerSlotEl && (event.target.matches("input, textarea, select") || event.target.isContentEditable)) return;
      if (!state.running || state.paused || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      if (!/^\d$/.test(event.key) && !["Enter", "Backspace", "Escape"].includes(event.key)) return;
      event.preventDefault();
      updateCountdown();
      if (!state.running || state.answered || event.repeat) return;
      if (/^\d$/.test(event.key)) {
        appendArithmeticDigit(event.key);
        return;
      } else if (event.key === "Backspace") {
        state.typedAnswer = state.typedAnswer.slice(0, -1);
      } else if (event.key === "Escape") {
        state.typedAnswer = "";
      } else if (event.key === "Enter") {
        if (state.typedAnswer.length === String(state.answer).length) submitAnswer(Number(state.typedAnswer));
        return;
      }
      answerSlotEl.value = state.typedAnswer;
      answerSlotEl.className = state.typedAnswer ? "answer-slot" : "answer-slot empty";
    }

    function setMode(maxNumber) {
      leaveReview();
      state.maxNumber = maxNumber;
      tenModeButton.classList.toggle("active", maxNumber === 10);
      twentyModeButton.classList.toggle("active", maxNumber === 20);
      resetGame();
    }

    function setOperation(operation) {
      leaveReview();
      state.operation = operation;
      mixedModeButton.classList.toggle("active", operation === "mixed");
      chainAddButton.classList.toggle("active", operation === "chainAdd");
      chainSubButton.classList.toggle("active", operation === "chainSub");
      document.querySelectorAll("[data-operation]").forEach((button) => {
        button.classList.toggle("active", button.dataset.operation === operation);
        button.setAttribute("aria-pressed", String(button.dataset.operation === operation));
      });
      resetGame();
    }

    function setTrainingMode(mode) {
      state.reviewQueue = [];
      state.reviewLabel = "";
      state.trainingMode = mode;
      timedButton.classList.toggle("active", mode === "timed");
      hundredButton.classList.toggle("active", mode === "hundred");
      timedButton.setAttribute("aria-pressed", String(mode === "timed"));
      hundredButton.setAttribute("aria-pressed", String(mode === "hundred"));
      resetGame();
    }

    function getOperationLabel() {
      return state.trainingMode === "review" ? state.reviewLabel : operationLabels[state.operation];
    }

    function leaveReview() {
      if (state.trainingMode !== "review") return;
      state.trainingMode = "timed";
      state.reviewQueue = [];
      state.reviewLabel = "";
      timedButton.classList.add("active");
      timedButton.setAttribute("aria-pressed", "true");
      hundredButton.classList.remove("active");
      hundredButton.setAttribute("aria-pressed", "false");
    }

    function retryWrongAnswers() {
      if (!viewedRecord || !Array.isArray(viewedRecord.attempts)) return;
      const record = viewedRecord;
      const wrong = record.attempts.filter((attempt) => attempt.correct === false && typeof attempt.question === "string" && attempt.question.split("□").length === 2 && Number.isInteger(attempt.answer) && attempt.answer >= 0);
      if (wrong.length === 0) return;
      clearInterval(state.timerId);
      clearTimeout(state.nextQuestionId);
      state.running = false;
      state.trainingMode = "review";
      state.reviewQueue = wrong.map((attempt) => ({ question: attempt.question, answer: attempt.answer }));
      state.reviewLabel = record.operation || "错题专项";
      state.maxNumber = parseInt(record.range, 10) === 10 ? 10 : 20;
      tenModeButton.classList.toggle("active", state.maxNumber === 10);
      twentyModeButton.classList.toggle("active", state.maxNumber === 20);
      timedButton.classList.remove("active");
      hundredButton.classList.remove("active");
      timedButton.setAttribute("aria-pressed", "false");
      hundredButton.setAttribute("aria-pressed", "false");
      if (detailsDialog.open) detailsDialog.close();
      switchExercise("arithmetic");
      startGame();
      messageEl.textContent = `错题重做，共${wrong.length}题`;
    }

    function loadHistory() {
      if (sessionHistory !== null) return sessionHistory;
      try {
        const saved = JSON.parse(localStorage.getItem(historyKey));
        sessionHistory = Array.isArray(saved) ? saved.filter((record) => record && typeof record === "object").slice(0, 10) : [];
      } catch (error) {
        sessionHistory = [];
      }
      return sessionHistory;
    }

    function saveHistory(records) {
      sessionHistory = records.slice(0, 10);
      try {
        localStorage.setItem(historyKey, JSON.stringify(sessionHistory));
      } catch (error) {
        starStatus.textContent = "成绩暂未保存到本地，本次详情仍可查看；关闭页面后可能丢失。";
      }
    }

    function renderHistory() {
      const records = loadHistory();
      if (records.length === 0) {
        historyListEl.innerHTML = '<p class="history-empty">还没有成绩，点“结束”后会记录</p>';
        return;
      }

      historyListEl.innerHTML = `<ol class="history-list">${records.map((record, index) => `
        <li class="history-item">
          <span>${record.range} · ${record.operation}<br>${record.trainingMode || "10分钟计时"}<br>${record.time}</span>
          <span><strong>${record.right}</strong> 题<br>${record.rate} 题/分钟</span>
          <span>错 ${record.wrong} 次<br>用时 ${record.elapsed}</span>
          <button class="action secondary" type="button" data-record-index="${index}" ${Array.isArray(record.attempts) ? "" : "disabled"}>${Array.isArray(record.attempts) ? "查看详情" : "旧记录无详情"}</button>
        </li>
      `).join("")}</ol>`;
    }

    function addHistoryRecord(elapsedMilliseconds, rightPerMinute) {
      if (state.recordSaved) {
        return;
      }

      state.recordSaved = true;
      const now = new Date();
      const records = loadHistory();
      latestRecord = {
        time: `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
        range: `${state.maxNumber}以内`,
        operation: getOperationLabel(),
        trainingMode: state.trainingMode === "review" ? "错题重做" : state.trainingMode === "hundred" ? "100题练习" : "10分钟计时",
        right: state.right,
        wrong: state.wrong,
        total: state.total,
        elapsed: formatTime(elapsedMilliseconds),
        rate: rightPerMinute.toFixed(1),
        attempts: state.attempts.slice()
      };
      if (state.trainingMode !== "review" && state.attempts.length > 0) {
        records.unshift(latestRecord);
        saveHistory(records);
        renderHistory();
      }
    }

    function showDetails(record) {
      if (!record || !Array.isArray(record.attempts)) return;
      viewedRecord = record;
      const wrongCount = record.attempts.filter((attempt) => attempt.correct === false).length;
      retryWrongButton.disabled = wrongCount === 0;
      retryWrongButton.textContent = wrongCount ? `错题重做（${wrongCount}题）` : "全部答对，无需重做";
      document.querySelector("#detailsSummary").textContent = `${record.range} · ${record.operation} · ${record.trainingMode || "10分钟计时"} · 答对 ${record.right} 题 · 答错 ${record.wrong} 题 · 用时 ${record.elapsed}`;
      const rows = document.querySelector("#detailsRows");
      rows.replaceChildren();
      record.attempts.forEach((attempt, index) => {
        const row = document.createElement("tr");
        [`${index + 1}. ${attempt.question}`, attempt.selected, attempt.answer, attempt.correct ? "正确" : "错误"].forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = String(value);
          row.appendChild(cell);
        });
        row.lastElementChild.className = attempt.correct ? "details-correct" : "details-wrong";
        rows.appendChild(row);
      });
      if (record.attempts.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 4;
        cell.textContent = "本次没有提交答案";
        row.appendChild(cell);
        rows.appendChild(row);
      }
      if (!detailsDialog.open) detailsDialog.showModal();
    }

    function finishGame() {
      if (!state.running || state.finished) {
        return;
      }

      state.finished = true;
      state.running = false;
      state.answered = true;
      clearTimeout(state.nextQuestionId);
      clearInterval(state.timerId);
      finishButton.classList.add("active");
      document.querySelectorAll(".choice").forEach((choice) => {
        choice.disabled = true;
      });
      const elapsedMilliseconds = state.trainingMode !== "timed" ? arithmeticElapsed() : Math.min(duration, arithmeticElapsed());
      timerEl.textContent = state.trainingMode !== "timed" ? formatTime(elapsedMilliseconds) : formatTime(Math.ceil((duration - elapsedMilliseconds) / 1000) * 1000);
      startButton.disabled = false;
      finishButton.disabled = true;
      nextButton.disabled = true;
      answerSlotEl.readOnly = true;
      answerSlotEl.blur();
      state.paused = false;
      pauseButton.disabled = true;
      pauseButton.textContent = "暂停";
      pauseButton.setAttribute("aria-pressed", "false");
      updateQuestionProgress();
      const elapsedMinutes = Math.max(elapsedMilliseconds / 60000, 1 / 60);
      const rightPerMinute = state.right / elapsedMinutes;
      addHistoryRecord(elapsedMilliseconds, rightPerMinute);
      detailsButton.hidden = false;
      messageEl.textContent = `练习结束：已答 ${state.total} 题，答对 ${state.right} 题，答错 ${state.wrong} 题，总用时 ${formatTime(elapsedMilliseconds)}，约 ${rightPerMinute.toFixed(1)} 题/分钟`;
      messageEl.className = "message";
      showDetails(latestRecord);
    }

    choicesEl.addEventListener("click", chooseAnswer);
    nextButton.addEventListener("click", makeQuestion);
    resetButton.addEventListener("click", resetGame);
    tenModeButton.addEventListener("click", () => setMode(10));
    twentyModeButton.addEventListener("click", () => setMode(20));
    mixedModeButton.addEventListener("click", () => setOperation("mixed"));
    chainAddButton.addEventListener("click", () => setOperation("chainAdd"));
    chainSubButton.addEventListener("click", () => setOperation("chainSub"));
    finishButton.addEventListener("click", finishGame);
    startButton.addEventListener("click", startGame);
    pauseButton.addEventListener("click", toggleArithmeticPause);
    timedButton.addEventListener("click", () => setTrainingMode("timed"));
    hundredButton.addEventListener("click", () => setTrainingMode("hundred"));
    specialtyPanel.addEventListener("click", (event) => {
      const button = event.target.closest("[data-operation]");
      if (button) setOperation(button.dataset.operation);
    });
    detailsButton.addEventListener("click", () => showDetails(latestRecord));
    retryWrongButton.addEventListener("click", retryWrongAnswers);
    historyListEl.addEventListener("click", (event) => {
      const button = event.target.closest("[data-record-index]");
      if (button && !button.disabled) showDetails(loadHistory()[Number(button.dataset.recordIndex)]);
    });
    document.querySelector("#starRedeemForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const input = document.querySelector("#starAmount");
      const raw = input.value.trim();
      const amount = Number(raw);
      if (!/^\d+$/.test(raw) || !Number.isSafeInteger(amount) || amount < 1) {
        starStatus.textContent = "请输入大于0的整数。";
        return;
      }
      if (amount > rewards.balance) {
        starStatus.textContent = `星星不足，当前共有${rewards.balance}颗。`;
        return;
      }
      rewards.balance -= amount;
      input.value = "";
      starStatus.textContent = `已兑换${amount}颗星星，剩余${rewards.balance}颗。`;
      persistRewards();
    });
    document.querySelector("#clearHistory").addEventListener("click", () => {
      try {
        localStorage.removeItem(historyKey);
      } catch (error) {
        starStatus.textContent = "暂时无法清除历史记录，请重试。";
        return;
      }
      latestRecord = null;
      viewedRecord = null;
      sessionHistory = [];
      detailsButton.hidden = true;
      if (detailsDialog.open) detailsDialog.close();
      renderHistory();
      starStatus.textContent = "历史成绩和逐题详情已清空，星星余额与奖励进度保留。";
    });
    document.addEventListener("keydown", handleKeyboard);
    answerSlotEl.addEventListener("input", () => {
      answerSlotEl.value = answerSlotEl.value.replace(/[^0-9]/g, "").slice(0, 2);
      state.typedAnswer = answerSlotEl.value;
      answerSlotEl.className = state.typedAnswer ? "answer-slot" : "answer-slot empty";
    });
    answerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (activePage !== "arithmetic" || !state.running || state.answered) return;
      if (!/^\d+$/.test(answerSlotEl.value) || answerSlotEl.value.length !== String(state.answer).length) return;
      submitAnswer(Number(answerSlotEl.value));
    });
    renderHistory();
    renderRewards();
    resetGame();
