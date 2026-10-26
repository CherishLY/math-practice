const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function createSession() {
  const elements = new Map();
  const storage = new Map();
  const timeouts = new Map();
  let now = 100000;
  let timerId = 0;
  function element() {
    return {
      textContent: '', value: '', children: [], dataset: {}, events: {},
      disabled: false, hidden: false, open: false,
      classList: { add() {}, remove() {}, toggle() {} },
      set innerHTML(value) { this.children = []; },
      addEventListener(name, callback) { this.events[name] = callback; },
      setAttribute() {}, focus() {}, blur() {},
      replaceChildren() { this.children = []; },
      appendChild(child) { this.children.push(child); },
      append(...children) { this.children.push(...children); },
      get lastElementChild() { return this.children.at(-1); },
      querySelectorAll() { return this.children; },
      showModal() { this.open = true; },
      close() { this.open = false; }
    };
  }
  function get(id) {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  }
  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const document = {
    getElementById: get,
    querySelector(selector) { return get(selector.replace(/^#/, '')); },
    querySelectorAll(selector) { return selector === '.choice' ? get('choices').children : []; },
    createElement: element,
    addEventListener() {}
  };
  const context = vm.createContext({
    document, Date: FakeDate,
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    },
    setTimeout(callback, delay) {
      const id = ++timerId;
      timeouts.set(id, { callback, due: now + delay });
      return id;
    },
    clearTimeout: id => timeouts.delete(id),
    setInterval: () => ++timerId,
    clearInterval() {}
  });
  for (const file of ['math.js', 'cubes.js', 'comparison.js', 'composition.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  }
  return {
    get, storage, run: source => vm.runInContext(source, context),
    advance(ms) { now += ms; },
    flushNext() {
      const entry = [...timeouts].sort((a, b) => a[1].due - b[1].due)[0];
      assert.ok(entry, 'Expected a scheduled question');
      const [id, timer] = entry;
      now = Math.max(now, timer.due);
      timeouts.delete(id);
      timer.callback();
    },
    pending: () => timeouts.size
  };
}

test('countdown freezes, rejects input, and resumes without counting paused time', () => {
  const s = createSession();
  s.run('startGame()');
  s.advance(10000);
  s.run('toggleArithmeticPause()');
  assert.equal(s.get('timer').textContent, '09:50');
  const answer = s.run('state.answer');
  s.advance(700000);
  s.run(`appendArithmeticDigit('${String(answer)[0]}');submitAnswer(state.answer);updateCountdown()`);
  assert.equal(s.run('state.total'), 0);
  assert.ok(s.get('choices').children.every(button => button.disabled));
  assert.equal(s.get('timer').textContent, '09:50');
  s.run('toggleArithmeticPause()');
  assert.equal(s.run('state.paused'), false);
  assert.equal(s.get('timer').textContent, '09:50');
  s.advance(590000);
  s.run('updateCountdown()');
  assert.equal(s.run('state.running'), false);
  assert.equal(s.run('latestRecord.elapsed'), '10:00');
});

test('manual pause and tab pause overlap without double-counting; partial input survives', () => {
  const s = createSession();
  s.run("setTrainingMode('hundred');startGame();state.answer=18;appendArithmeticDigit('1')");
  s.advance(10000);
  s.run('toggleArithmeticPause()');
  s.advance(10000);
  s.run("switchExercise('cubes')");
  s.advance(10000);
  s.run("switchExercise('arithmetic')");
  assert.equal(s.run('state.paused'), true);
  assert.equal(s.get('answerSlot').value, '1');
  s.advance(10000);
  s.run('toggleArithmeticPause();updateCountdown()');
  assert.equal(s.get('timer').textContent, '00:10');
  s.run("appendArithmeticDigit('8');toggleArithmeticPause()");
  assert.equal(s.pending(), 0);
  s.advance(10000);
  assert.equal(s.run('state.answered'), true);
  s.run('toggleArithmeticPause()');
  s.flushNext();
  assert.equal(s.run('state.answered'), false);
  s.run('toggleArithmeticPause()');
  s.advance(10000);
  s.run('finishGame()');
  assert.equal(s.run('latestRecord.elapsed'), '00:10');
});

test('arithmetic review keeps current details without adding or replacing history', () => {
  const s = createSession();
  s.run('startGame();state.answer=18;submitAnswer(9);finishGame()');
  const original = s.storage.get('mathPracticeResults');
  s.run('retryWrongAnswers()');
  s.run('submitAnswer(state.answer)');
  assert.equal(s.run('state.running'), false);
  assert.equal(s.run('latestRecord.trainingMode'), '错题重做');
  assert.equal(s.run('latestRecord.attempts.length'), 1);
  assert.equal(s.get('detailsDialog').open, true);
  assert.equal(s.storage.get('mathPracticeResults'), original);
  assert.equal(s.run('loadHistory().length'), 1);
});

test('composition review does not consume a history slot', () => {
  const s = createSession();
  s.run("switchExercise('composition');composition.selection=1;beginComposition();submitComposition(9);finishComposition()");
  const original = s.storage.get('mathCompositionHistory.v1');
  s.run('beginComposition(compositionRetryQuestions);submitComposition(composition.queue[0].blank===0?composition.queue[0].left:composition.queue[0].right)');
  assert.equal(s.run('composition.running'), false);
  assert.equal(s.run('composition.right'), 1);
  assert.equal(s.run('compositionRecords.length'), 1);
  assert.equal(s.storage.get('mathCompositionHistory.v1'), original);
});

test('100-question progress below the question follows answers, pause, reset, and completion', () => {
  const s = createSession();
  assert.equal(s.get('questionProgress').hidden, false);
  s.run("setTrainingMode('hundred');startGame()");
  assert.equal(s.get('questionProgress').hidden, false);
  assert.equal(s.get('questionCompleted').textContent, '0/100');
  assert.equal(s.get('questionElapsed').textContent, '00:00');
  s.advance(12000);
  s.run('updateCountdown();submitAnswer(state.answer)');
  assert.equal(s.get('questionElapsed').textContent, '00:12');
  assert.equal(s.get('questionCompleted').textContent, '1/100');
  s.run('toggleArithmeticPause()');
  assert.equal(s.get('questionPaused').hidden, false);
  s.advance(30000);
  s.run('updateCountdown()');
  assert.equal(s.get('questionElapsed').textContent, '00:12');
  s.run('toggleArithmeticPause()');
  assert.equal(s.get('questionPaused').hidden, true);
  for (let i = 1; i < 100; i++) {
    s.run('makeQuestion();submitAnswer(state.answer)');
  }
  assert.equal(s.run('state.running'), false);
  assert.equal(s.get('questionCompleted').textContent, '100/100');
  assert.equal(s.get('questionElapsed').textContent, '00:12');
  assert.equal(s.get('questionPaused').hidden, true);
  s.run('resetGame()');
  assert.equal(s.get('questionElapsed').textContent, '00:00');
  assert.equal(s.get('questionCompleted').textContent, '0/100');
  s.run("setTrainingMode('timed')");
  assert.equal(s.get('questionProgress').hidden, false);
  assert.equal(s.get('questionTimeLabel').textContent, '剩余时间');
});

test('10-minute mode shows remaining time and answered count below the question', () => {
  const s = createSession();
  s.run('startGame()');
  assert.equal(s.get('questionElapsed').textContent, '10:00');
  assert.equal(s.get('questionCompleted').textContent, '已答0题');
  s.advance(15000);
  s.run('updateCountdown();submitAnswer(state.answer)');
  assert.equal(s.get('questionElapsed').textContent, '09:45');
  assert.equal(s.get('questionCompleted').textContent, '已答1题');
  s.run('toggleArithmeticPause()');
  s.advance(60000);
  s.run('updateCountdown()');
  assert.equal(s.get('questionElapsed').textContent, '09:45');
  assert.equal(s.get('questionPaused').hidden, false);
  s.run('toggleArithmeticPause()');
  s.advance(585000);
  s.run('updateCountdown()');
  assert.equal(s.get('questionElapsed').textContent, '00:00');
  assert.equal(s.get('questionCompleted').textContent, '已答1题');
  assert.equal(s.run('state.running'), false);
});

test('ending without a submitted answer does not save or displace arithmetic history', () => {
  const s = createSession();
  s.run('startGame();finishGame()');
  assert.equal(s.run('loadHistory().length'), 0);
  assert.equal(s.storage.has('mathPracticeResults'), false);
  s.run('startGame();submitAnswer(state.answer);finishGame()');
  const original = s.storage.get('mathPracticeResults');
  s.run("startGame();state.answer=18;appendArithmeticDigit('1');finishGame()");
  assert.equal(s.storage.get('mathPracticeResults'), original);
  assert.equal(s.run('loadHistory().length'), 1);
  s.run('startGame();state.answer=18;submitAnswer(9);finishGame()');
  assert.equal(s.run('loadHistory().length'), 2);
  assert.equal(s.run('loadHistory()[0].wrong'), 1);
});

test('ending an empty composition session does not save history', () => {
  const s = createSession();
  s.run("switchExercise('composition');beginComposition();finishComposition()");
  assert.equal(s.run('compositionRecords.length'), 0);
  assert.equal(s.storage.has('mathCompositionHistory.v1'), false);
  s.run('beginComposition();submitComposition(9);finishComposition()');
  assert.equal(s.run('compositionRecords.length'), 1);
  const original = s.storage.get('mathCompositionHistory.v1');
  s.run('beginComposition();finishComposition()');
  assert.equal(s.storage.get('mathCompositionHistory.v1'), original);
  assert.equal(s.run('compositionRecords.length'), 1);
});
