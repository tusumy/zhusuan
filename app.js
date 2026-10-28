/* 珠间 · 真正可拨的五档木算盘
   1颗上珠=5、4颗下珠各=1；各档从左至右为万、千、百、十、个。
   单击珠子或拖动珠子，盘面与算题答案独立，避免提前泄题。
*/
(function () {
  "use strict";

  const doc = document;
  const svg = doc.getElementById("abacus");
  const numberEl = doc.getElementById("currentNumber");
  const placeEl = doc.getElementById("placeReadout");
  const soundButton = doc.getElementById("soundButton");
  const resetButton = doc.getElementById("resetButton");
  const undoButton = doc.getElementById("undoButton");
  const feedbackEl = doc.getElementById("feedback");
  const hintText = doc.getElementById("hintText");
  const digitsPlace = ["万", "千", "百", "十", "个"];
  const xs = [86, 198, 310, 422, 534];
  const NS = "http://www.w3.org/2000/svg";
  const MAX = 99999;
  let state = emptyState();
  let history = [];
  let mode = "free";
  let level = "carry";
  let currentProblem = null;
  let previousProblem = "";
  let hintIndex = -1;
  let savedFreeState = null;
  let sound = false;
  let audioCtx = null;
  let gesture = null;
  const beads = [];

  const exercises = {
    beginner: [
      { a: 23, op: "+", b: 4, hints: ["只看个位：3加4，可以用加5减1。", "上珠拨下来，再去掉一颗下珠。"] },
      { a: 40, op: "+", b: 3, hints: ["这一题不用进位。", "只在个位靠梁拨三颗下珠。"] },
      { a: 58, op: "+", b: 1, hints: ["个位的8离9只差1。", "个位再拨上一颗下珠就行。"] },
      { a: 75, op: "-", b: 3, hints: ["个位只有上珠5，不能直接去三颗下珠。", "减3可以先去5，再还2。"] },
      { a: 24, op: "+", b: 3, hints: ["个位4加3，需要先凑5。", "加3等于加5再去2。"] }
    ],
    carry: [
      { a: 48, op: "+", b: 7, hints: ["7可以拆成10减3。", "十位加1，个位从8里去掉三颗下珠。"] },
      { a: 56, op: "+", b: 8, hints: ["8等于10减2。", "十位进一；个位6减2，需要破五。"] },
      { a: 73, op: "-", b: 6, hints: ["减6可以退十再还4。", "十位退一；个位3加4，可以下五去一。"] },
      { a: 64, op: "-", b: 8, hints: ["减8等于减10再补2。", "十位减1；个位4加2，要下五去三。"] },
      { a: 53, op: "-", b: 8, hints: ["先退十，再还2。", "十位5退成4：上珠离梁，四颗下珠靠梁。"] },
      { a: 62, op: "-", b: 7, hints: ["减7等于退十还3。", "十位退一；个位2加3，正好凑五。"] }
    ],
    chain: [
      { a: 196, op: "+", b: 7, hints: ["加7可以先加10，再减3。", "十位9再加1会满十，继续向百位进1。"] },
      { a: 503, op: "-", b: 8, hints: ["减8等于退十还2，但十位是0。", "从百位借1：百位减1，十位变9，个位再加2。"] },
      { a: 602, op: "-", b: 5, hints: ["个位2不够减5，先退十还5。", "十位0需要从百位借：百位减1，十位变9。"] },
      { a: 1002, op: "-", b: 5, hints: ["先减10，再把5还给个位。", "千位借出1之后，百位、十位都能借成9。"] },
      { a: 999, op: "+", b: 1, hints: ["个位9加1满十，个位清零。", "十位和百位也都是9，会继续向左进位。"] },
      { a: 10006, op: "+", b: 994, hints: ["994可以看成1000减6。", "千位加1，然后个位去6；小心哪一档需要退位。"] },
      { a: 9999, op: "+", b: 1, hints: ["从个位开始，满十向左传递。", "只有遇到没满十的档位，进位才停。"] }
    ]
  };

  function emptyState() {
    return Array.from({ length: 5 }, function () { return { upper: false, lower: 0 }; });
  }
  function cloneState(s) {
    return s.map(function (r) { return { upper: r.upper, lower: r.lower }; });
  }
  function currentDigits() {
    return state.map(function (r) { return (r.upper ? 5 : 0) + r.lower; });
  }
  function currentValue() {
    return currentDigits().reduce(function (acc, n) { return acc * 10 + n; }, 0);
  }
  function fromNumber(n) {
    if (!Number.isInteger(n) || n < 0 || n > MAX) throw new RangeError("算盘只支持0到99999");
    return [10000, 1000, 100, 10, 1].map(function (place) {
      const d = Math.floor(n / place) % 10;
      return { upper: d >= 5, lower: d % 5 };
    });
  }

  function elSvg(tag, attrs) {
    const node = doc.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }

  function drawBoard() {
    svg.innerHTML = [
      '<defs>',
      '<linearGradient id="wood" x1="0" x2="1" y1="0" y2="1">',
      '<stop offset="0" stop-color="#5c3524"/><stop offset=".26" stop-color="#a7754d"/>',
      '<stop offset=".56" stop-color="#75472e"/><stop offset=".84" stop-color="#a27348"/><stop offset="1" stop-color="#533020"/></linearGradient>',
      '<linearGradient id="innerwood" x1="0" y1="0" x2="1" y2=".8">',
      '<stop offset="0" stop-color="#e3c59a"/><stop offset=".48" stop-color="#f2d7a8"/><stop offset="1" stop-color="#dbb987"/></linearGradient>',
      '<linearGradient id="beadwood" x1="0" y1="0" x2=".86" y2="1">',
      '<stop offset="0" stop-color="#e1a36e"/><stop offset=".27" stop-color="#c98752"/>',
      '<stop offset=".62" stop-color="#a9643b"/><stop offset="1" stop-color="#724027"/></linearGradient>',
      '<linearGradient id="barwood" x1="0" y1="0" x2="0" y2="1">',
      '<stop offset="0" stop-color="#be8b58"/><stop offset=".3" stop-color="#805034"/>',
      '<stop offset="1" stop-color="#5b3524"/></linearGradient>',
      '<filter id="shade" x="-30%" y="-40%" width="160%" height="180%">',
      '<feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#3d2517" flood-opacity=".27"/></filter>',
      '</defs>',
      '<rect x="11" y="13" width="598" height="346" rx="16" fill="#3e251a" opacity=".15"/>',
      '<rect x="8" y="9" width="604" height="348" rx="13" fill="url(#wood)" stroke="#603a26" stroke-width="3"/>',
      '<rect x="23" y="25" width="574" height="314" rx="5" fill="url(#innerwood)" stroke="#ba8f5f" stroke-width="2"/>',
      '<path d="M29 40 C150 30 232 60 340 38 S510 40 591 32 M31 332 C140 323 217 341 326 327 S500 332 588 324" stroke="#9b683e" stroke-width="1.3" opacity=".21" fill="none"/>',
      '<path d="M36 51 C130 44 222 62 312 46 S470 41 578 57 M36 314 C147 300 207 328 348 311 S481 305 581 319" stroke="#fff4cd" stroke-width="2" opacity=".22" fill="none"/>',
      '<rect x="26" y="148" width="568" height="23" rx="2" fill="#40261c" opacity=".18"/>'
    ].join("");
    // 厚木档梁绘于珠杆之上，手感更接近实体算盘。
    xs.forEach(function (x) {
      svg.appendChild(elSvg("line", { x1: x, y1: 34, x2: x, y2: 333, stroke: "#805835", "stroke-width": "7", "stroke-linecap": "round" }));
      svg.appendChild(elSvg("line", { x1: x + 2, y1: 34, x2: x + 2, y2: 333, stroke: "#e2c192", "stroke-width": "2", opacity: ".6" }));
    });
    const bar = elSvg("rect", { x: 23, y: 147, width: 574, height: 22, rx: 2, fill: "url(#barwood)", stroke: "#5a3521", "stroke-width": "2" });
    svg.appendChild(bar);
    svg.appendChild(elSvg("path", { d: "M29 151 H591", stroke: "#e2b87a", "stroke-width": "2", opacity: ".65" }));
    [34, 586].forEach(function (x) {
      svg.appendChild(elSvg("circle", { cx: x, cy: 158, r: 3.8, fill: "#d0a16e", stroke: "#6f4b36", "stroke-width": "1" }));
    });
    xs.forEach(function (x, i) {
      svg.appendChild(elSvg("circle", { cx: x, cy: 158, r: 3.4, fill: "#e7c58b" }));
      svg.appendChild(elSvg("text", { x: x, y: 394, "font-size": "19", "font-family": "Songti SC, serif", "text-anchor": "middle", fill: "#756348" })).textContent = digitsPlace[i];
      makeBead(i, "upper", 0);
      for (let j = 0; j < 4; j++) makeBead(i, "lower", j);
    });
    [[24,24],[596,24],[24,345],[596,345]].forEach(function (p) {
      svg.appendChild(elSvg("circle", { cx: p[0], cy: p[1], r: 3.1, fill: "#4e2f22", opacity: ".65" }));
      svg.appendChild(elSvg("circle", { cx: p[0] - .6, cy: p[1] - .8, r: 1.1, fill: "#c8a079", opacity: ".6" }));
    });
    updateBoard();
  }

  function makeBead(rod, type, index) {
    const group = elSvg("g", {
      "class": "bead", "data-rod": rod, "data-type": type, "data-index": index,
      "role": "button", "tabindex": "0",
      "aria-label": digitsPlace[rod] + "位" + (type === "upper" ? "上珠五" : "第" + (index + 1) + "颗下珠")
    });
    group.appendChild(elSvg("ellipse", { "class": "main-bead", cx: 0, cy: 0, rx: 30, ry: type === "upper" ? 19 : 17, fill: "url(#beadwood)", stroke: "#754027", "stroke-width": "2.4", filter: "url(#shade)" }));
    group.appendChild(elSvg("ellipse", { cx: -7, cy: -7, rx: 15, ry: 3.2, fill: "#f9c18c", opacity: ".47", "pointer-events": "none" }));
    group.appendChild(elSvg("path", { d: "M-19 7 Q0 15 20 6", stroke: "#653620", "stroke-width": "1.2", opacity: ".38", fill: "none", "pointer-events": "none" }));
    group.appendChild(elSvg("rect", { "class": "hit-area", x: -37, y: -20, width: 74, height: 40, rx: 12 }));
    svg.appendChild(group);
    beads.push({ node: group, rod: rod, type: type, index: index });
  }

  function updateBoard() {
    beads.forEach(function (b) {
      const r = state[b.rod];
      const active = b.type === "upper" ? r.upper : b.index < r.lower;
      const y = b.type === "upper" ? (active ? 124 : 72) : (active ? 186 + 33 * b.index : 238 + 33 * b.index);
      b.node.style.transform = "translate(" + xs[b.rod] + "px," + y + "px)";
      b.node.setAttribute("aria-pressed", String(active));
    });
    numberEl.textContent = String(currentValue());
    const ds = currentDigits();
    placeEl.innerHTML = "";
    ds.forEach(function (v, i) {
      const tile = doc.createElement("span");
      tile.className = "place-tile";
      const small = doc.createElement("small");
      small.textContent = digitsPlace[i];
      const strong = doc.createElement("strong");
      strong.textContent = v;
      tile.appendChild(small);
      tile.appendChild(strong);
      placeEl.appendChild(tile);
    });
    undoButton.disabled = history.length === 0;
  }

  function playBeadSound() {
    if (!sound) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === "suspended") audioCtx.resume().catch(function () {});
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const now = audioCtx.currentTime;
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(460 + Math.random() * 100, now);
      oscillator.frequency.exponentialRampToValueAtTime(240, now + .035);
      gain.gain.setValueAtTime(.035, now);
      gain.gain.exponentialRampToValueAtTime(.001, now + .05);
      oscillator.connect(gain).connect(audioCtx.destination);
      oscillator.start(now);
      oscillator.stop(now + .051);
    } catch (err) { /* 声音不可用时，不影响拨珠 */ }
  }

  function recordAndUpdate(nextState) {
    if (JSON.stringify(state) === JSON.stringify(nextState)) return;
    history.push(cloneState(state));
    if (history.length > 80) history.shift();
    state = cloneState(nextState);
    playBeadSound();
    updateBoard();
    if (mode === "practice") {
      feedbackEl.className = "feedback";
      feedbackEl.textContent = "算盘已拨动。继续想，拨好后再检查。";
    }
  }

  function moveBead(rod, type, index, direction) {
    const next = cloneState(state);
    const r = next[rod];
    if (type === "upper") {
      if (direction === "toward") r.upper = true;
      else if (direction === "away") r.upper = false;
      else r.upper = !r.upper;
    } else {
      if (direction === "toward") r.lower = Math.max(r.lower, index + 1);
      else if (direction === "away") r.lower = Math.min(r.lower, index);
      else r.lower = index < r.lower ? index : index + 1;
    }
    recordAndUpdate(next);
  }

  svg.addEventListener("pointerdown", function (event) {
    const bead = event.target.closest(".bead");
    if (!bead) return;
    event.preventDefault();
    gesture = {
      id: event.pointerId,
      startY: event.clientY,
      rod: Number(bead.dataset.rod),
      type: bead.dataset.type,
      index: Number(bead.dataset.index)
    };
    try { svg.setPointerCapture(event.pointerId); } catch (e) {}
  });
  svg.addEventListener("pointerup", function (event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    event.preventDefault();
    const dy = event.clientY - gesture.startY;
    const direction = Math.abs(dy) <= 12 ? "toggle" :
      gesture.type === "upper" ? (dy > 0 ? "toward" : "away") :
      (dy < 0 ? "toward" : "away");
    moveBead(gesture.rod, gesture.type, gesture.index, direction);
    gesture = null;
    try { svg.releasePointerCapture(event.pointerId); } catch (e) {}
  });
  svg.addEventListener("pointercancel", function () { gesture = null; });
  svg.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const bead = event.target.closest(".bead");
    if (!bead) return;
    event.preventDefault();
    moveBead(Number(bead.dataset.rod), bead.dataset.type, Number(bead.dataset.index), "toggle");
  });

  function setBoardNumber(num, clearHistory) {
    state = fromNumber(num);
    if (clearHistory) history = [];
    updateBoard();
  }
  function updateMode(nextMode) {
    if (mode === nextMode) return;
    if (mode === "free") savedFreeState = cloneState(state);
    mode = nextMode;
    doc.querySelectorAll(".mode-tab").forEach(function (button) {
      const active = button.dataset.mode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    doc.getElementById("freePanel").hidden = mode !== "free";
    doc.getElementById("practicePanel").hidden = mode !== "practice";
    resetButton.textContent = mode === "free" ? "清盘" : "回到起点";
    if (mode === "practice") newProblem();
    else {
      state = savedFreeState ? cloneState(savedFreeState) : emptyState();
      history = [];
      updateBoard();
    }
  }

  function showFeedback(message, type) {
    feedbackEl.className = "feedback" + (type ? " is-" + type : "");
    feedbackEl.textContent = message;
  }
  function newProblem() {
    const list = exercises[level];
    const options = list.filter(function (item) { return item.a + item.op + item.b !== previousProblem; });
    const choice = options[Math.floor(Math.random() * options.length)] || list[0];
    previousProblem = choice.a + choice.op + choice.b;
    currentProblem = choice;
    hintIndex = -1;
    hintText.hidden = true;
    hintText.textContent = "";
    doc.getElementById("questionText").textContent = choice.a + (choice.op === "+" ? " ＋ " : " − ") + choice.b + " ＝ ？";
    doc.getElementById("questionGuide").textContent = "已经替你摆好 " + choice.a + "。现在自己拨珠，别清零重摆。";
    setBoardNumber(choice.a, true);
    showFeedback("拨好后点「检查算盘」，我不会提前告诉你答案。");
  }

  doc.querySelectorAll(".mode-tab").forEach(function (button) {
    button.addEventListener("click", function () { updateMode(button.dataset.mode); });
  });
  doc.querySelectorAll(".difficulty-switch button").forEach(function (button) {
    button.addEventListener("click", function () {
      level = button.dataset.level;
      doc.querySelectorAll(".difficulty-switch button").forEach(function (b) {
        b.classList.toggle("is-active", b === button);
      });
      if (mode === "practice") newProblem();
    });
  });
  doc.getElementById("checkButton").addEventListener("click", function () {
    if (!currentProblem) return;
    const answer = currentProblem.a + (currentProblem.op === "+" ? currentProblem.b : -currentProblem.b);
    if (currentValue() === answer) showFeedback("拨对了！这次是算盘自己给出的答案。换一题接着玩。", "success");
    else showFeedback("还差一点。看看哪一档该进位或借位，答案先不揭晓。", "try");
  });
  doc.getElementById("hintButton").addEventListener("click", function () {
    if (!currentProblem) return;
    hintIndex = Math.min(hintIndex + 1, currentProblem.hints.length - 1);
    hintText.hidden = false;
    hintText.textContent = "一点提示 · " + currentProblem.hints[hintIndex];
  });
  doc.getElementById("newProblemButton").addEventListener("click", newProblem);
  doc.getElementById("exampleButton").addEventListener("click", function () {
    if (mode !== "free") updateMode("free");
    history.push(cloneState(state));
    setBoardNumber(196, false);
    const help = doc.querySelector(".board-help");
    help.textContent = "196 摆好了。试着加10，再从个位去3。";
    doc.querySelector(".practice-room").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  resetButton.addEventListener("click", function () {
    const target = mode === "practice" && currentProblem ? currentProblem.a : 0;
    recordAndUpdate(fromNumber(target));
    if (mode === "practice") showFeedback("已回到起点，重新慢慢拨一次。");
  });
  undoButton.addEventListener("click", function () {
    if (!history.length) return;
    state = history.pop();
    playBeadSound();
    updateBoard();
    if (mode === "practice") showFeedback("退回上一步。");
  });
  soundButton.addEventListener("click", function () {
    sound = !sound;
    soundButton.textContent = sound ? "♪ 声音：开" : "♪ 声音：关";
    soundButton.setAttribute("aria-pressed", String(sound));
    try { localStorage.setItem("zhujian-sound", sound ? "on" : "off"); } catch (e) {}
    if (sound) playBeadSound();
  });
  try { sound = localStorage.getItem("zhujian-sound") === "on"; } catch (e) {}
  soundButton.textContent = sound ? "♪ 声音：开" : "♪ 声音：关";
  soundButton.setAttribute("aria-pressed", String(sound));
  drawBoard();
})();
