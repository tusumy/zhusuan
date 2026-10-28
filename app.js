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
  let level = "chain";
  let currentProblem = null;
  let previousProblem = "";
  let hintIndex = -1;
  let savedFreeState = null;
  let sound = false;
  let audioCtx = null;
  let gesture = null;
  const beads = [];

  const exercises = {
      "beginner": [
          {
              "a": 23,
              "op": "+",
              "b": 4,
              "hints": [
                  "先看个位：3加4，可以考虑凑五。",
                  "只需改变个位的珠子。"
              ]
          },
          {
              "a": 58,
              "op": "+",
              "b": 7,
              "hints": [
                  "加7可以用进十去三。",
                  "十位进1，个位把三颗下珠去掉。"
              ]
          },
          {
              "a": 73,
              "op": "-",
              "b": 6,
              "hints": [
                  "先退10再还4。",
                  "个位3加4，可以下五去一。"
              ]
          },
          {
              "a": 64,
              "op": "-",
              "b": 8,
              "hints": [
                  "减8可先减10再补2。",
                  "个位4加2，需要凑五。"
              ]
          },
          {
              "a": 48,
              "op": "+",
              "b": 7,
              "hints": [
                  "进十去三。",
                  "十位进1，个位去三。"
              ]
          },
          {
              "a": 62,
              "op": "-",
              "b": 7,
              "hints": [
                  "退十还三。",
                  "十位退1，个位2加3正好5。"
              ]
          }
      ],
      "carry": [
          {
              "a": 196,
              "op": "+",
              "b": 7,
              "hints": [
                  "个位6加7，可以先加10再去3。",
                  "十位9再进1，还要继续向百位进1。"
              ]
          },
          {
              "a": 308,
              "op": "+",
              "b": 257,
              "hints": [
                  "按个位、十位、百位分开拨。",
                  "个位8加7进位，别把进位漏掉。"
              ]
          },
          {
              "a": 476,
              "op": "+",
              "b": 368,
              "hints": [
                  "每一档都可能要进位。",
                  "先处理个位的6加8，满十就向左进1。"
              ]
          },
          {
              "a": 702,
              "op": "-",
              "b": 468,
              "hints": [
                  "个位不够减，先往左借。",
                  "十位是0，继续从百位借。"
              ]
          },
          {
              "a": 804,
              "op": "-",
              "b": 257,
              "hints": [
                  "先把个位的4减7处理好。",
                  "遇到十位是0，就继续向百位借。"
              ]
          },
          {
              "a": 525,
              "op": "+",
              "b": 387,
              "hints": [
                  "个位先加7。",
                  "后面几档进位时留意十位是否满十。"
              ]
          },
          {
              "a": 501,
              "op": "-",
              "b": 267,
              "hints": [
                  "个位1不够减7，需要退十。",
                  "十位是0，需要从百位借。"
              ]
          },
          {
              "a": 623,
              "op": "-",
              "b": 458,
              "hints": [
                  "个位3不够减8。",
                  "按位退借，不用先想出最终答案。"
              ]
          }
      ],
      "chain": [
          {
              "a": 1002,
              "op": "-",
              "b": 5,
              "hints": [
                  "个位2不够减5，需要退十。",
                  "十位、百位都是0，继续从千位借。"
              ]
          },
          {
              "a": 9999,
              "op": "+",
              "b": 1,
              "hints": [
                  "个位满十就向左进1。",
                  "一位位往左传，直到遇到没满十的档。"
              ]
          },
          {
              "a": 4096,
              "op": "+",
              "b": 8785,
              "hints": [
                  "从个位开始按档加。",
                  "某档满十时向左进一，十位、百位也可能要接着进位。"
              ]
          },
          {
              "a": 20407,
              "op": "-",
              "b": 8769,
              "hints": [
                  "个位先尝试减9。",
                  "不够借时可能遇到连续的0，要往左找到能借的档。"
              ]
          },
          {
              "a": 45678,
              "op": "+",
              "b": 12345,
              "hints": [
                  "先从个位加5开始。",
                  "别急着计算结果，满十就进位。"
              ]
          },
          {
              "a": 50002,
              "op": "-",
              "b": 19765,
              "hints": [
                  "个位2减5不够。",
                  "零档不能直接借时，从更高位接力。"
              ]
          },
          {
              "a": 80705,
              "op": "-",
              "b": 47986,
              "hints": [
                  "把减数按个位到万位拆开。",
                  "同一档不够减就借位，遇到0继续向左。"
              ]
          },
          {
              "a": 9998,
              "op": "+",
              "b": 7,
              "hints": [
                  "个位加7会进十。",
                  "十位和百位都是9，进位要连续传递。"
              ]
          },
          {
              "a": 10840,
              "op": "+",
              "b": 7899,
              "hints": [
                  "试着逐档拨入加数。",
                  "个位0加9不进位，十位4加9却会进位。"
              ]
          },
          {
              "a": 99876,
              "op": "-",
              "b": 45678,
              "hints": [
                  "从个位的6减8开始。",
                  "各档仔细检查借位，万位仍需保留。"
              ]
          }
      ]
  };

  function randInt(lo,hi) {
    return Math.floor(Math.random() * (hi-lo+1)) + lo;
  }

  function carries(a,b) {
    let count=0,carry=0;
    for(let i=0;i<5;i++) {
      let n=a%10+b%10+carry;
      carry=n>=10?1:0;
      count+=carry;
      a=Math.floor(a/10);
      b=Math.floor(b/10);
    }
    return count;
  }

  function borrows(a,b) {
    let count=0,borrow=0;
    for(let i=0;i<5;i++) {
      const left=a%10-borrow;
      const right=b%10;
      borrow=left<right?1:0;
      count+=borrow;
      a=Math.floor(a/10);
      b=Math.floor(b/10);
    }
    return count;
  }

  function generateProblem(selectedLevel) {
    const isBig=selectedLevel==="chain";
    for(let attempt=0;attempt<150;attempt++) {
      const op=Math.random()<.5?"+":"-";
      const width=isBig?randInt(4,5):3;
      const low=Math.pow(10,width-1);
      const high=Math.pow(10,width)-1;
      const a=randInt(low,high);
      const b=randInt(Math.max(11,Math.floor(low*.15)),Math.min(high,Math.floor(high*.85)));
      const answer=op==="+"?a+b:a-b;
      if(answer<0||answer>MAX) continue;
      if(op==="+" && carries(a,b)<(isBig?2:1)) continue;
      if(op==="-" && borrows(a,b)<(isBig?2:1)) continue;
      return {
        a:a,op:op,b:b,
        hints:op==="+"
          ? ["把加数按个位、十位、百位依次拨入，不要先计算总数。","一档凑到10，就清零并给左边一档进1。"]
          : ["把减数按位分开，遇到某档不够减，就往左借1。","如果左边一档是0，就继续向更高位借；借完要记得把剩余的9留下。"]
      };
    }
    return null;
  }

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
    let choice = null;
    // 中高阶多数题目实时生成，避免反复出现固定的两位数题。
    if(level!=="beginner" && Math.random()<.8) {
      for(let i=0;i<8;i++) {
        const generated=generateProblem(level);
        if(generated && generated.a+generated.op+generated.b!==previousProblem) {
          choice=generated;
          break;
        }
      }
    }
    if(!choice) choice=options[Math.floor(Math.random()*options.length)] || list[0];
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
