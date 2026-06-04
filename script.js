const standards = {
  T568A: ["白绿", "绿", "白橙", "蓝", "白蓝", "橙", "白棕", "棕"],
  T568B: ["白橙", "橙", "白绿", "蓝", "白蓝", "绿", "白棕", "棕"],
};

const wires = {
  "白绿": { color: "var(--green)", striped: true },
  "绿": { color: "var(--green)", striped: false },
  "白橙": { color: "var(--orange)", striped: true },
  "橙": { color: "var(--orange)", striped: false },
  "白蓝": { color: "var(--solid-blue)", striped: true },
  "蓝": { color: "var(--solid-blue)", striped: false },
  "白棕": { color: "var(--brown)", striped: true },
  "棕": { color: "var(--brown)", striped: false },
};

const storageKey = "twistedPairScores";
const apiTokenKey = "twistedPairApiToken";
let currentStandard = "T568A";
let currentOrder = [];
let startedAt = 0;
let timerId = null;
let elapsedSeconds = 0;
let lastResult = null;
let draggedIndex = -1;

const screens = Object.fromEntries(
  [...document.querySelectorAll(".screen")].map((screen) => [screen.dataset.screen, screen])
);

const startBtn = document.getElementById("startBtn");
const homeRankBtn = document.getElementById("homeRankBtn");
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const apiTokenInput = document.getElementById("apiTokenInput");
const settingsStatus = document.getElementById("settingsStatus");
const saveTokenBtn = document.getElementById("saveTokenBtn");
const clearTokenBtn = document.getElementById("clearTokenBtn");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const finishBtn = document.getElementById("finishBtn");
const retryBtn = document.getElementById("retryBtn");
const rankBtn = document.getElementById("rankBtn");
const submitScoreBtn = document.getElementById("submitScoreBtn");
const backBtn = document.getElementById("backBtn");
const timerEl = document.getElementById("timer");
const wireStage = document.getElementById("wireStage");
const aiSuggestion = document.getElementById("aiSuggestion");

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
}

function formatTime(seconds) {
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const rest = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function shuffledDifferentFromStandard(standard) {
  let order = shuffle(standards[standard]);
  while (order.join("|") === standards[standard].join("|")) {
    order = shuffle(standards[standard]);
  }
  return order;
}

function startTimer() {
  clearInterval(timerId);
  startedAt = Date.now();
  elapsedSeconds = 0;
  timerEl.textContent = "00:00";
  timerId = setInterval(() => {
    elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
    timerEl.textContent = formatTime(elapsedSeconds);
  }, 250);
}

function stopTimer() {
  clearInterval(timerId);
  elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
}

function makeWireElement(name, index, mode = "arrange") {
  const wire = document.createElement("button");
  const data = wires[name];
  wire.className = `${mode === "result" ? "result-wire" : "wire"}${data.striped ? " striped" : ""}`;
  wire.style.setProperty("--wire-color", data.color);
  wire.dataset.index = String(index);
  wire.dataset.name = name;
  wire.type = "button";
  wire.title = name;
  wire.setAttribute("aria-label", name);
  return wire;
}

function renderArrangeWires() {
  wireStage.innerHTML = "";
  currentOrder.forEach((name, index) => {
    const wire = makeWireElement(name, index);
    wire.draggable = true;
    wire.addEventListener("dragstart", onDragStart);
    wire.addEventListener("dragover", onDragOver);
    wire.addEventListener("drop", onDrop);
    wire.addEventListener("dragend", onDragEnd);
    wire.addEventListener("pointerdown", () => wire.classList.add("dragging"));
    wire.addEventListener("pointerup", () => wire.classList.remove("dragging"));
    wire.addEventListener("pointerleave", () => wire.classList.remove("dragging"));
    wireStage.appendChild(wire);
  });
}

function swapWires(from, to) {
  if (from === to || from < 0 || to < 0) return;
  const next = [...currentOrder];
  const [moving] = next.splice(from, 1);
  next.splice(to, 0, moving);
  currentOrder = next;
  renderArrangeWires();
}

function onDragStart(event) {
  draggedIndex = Number(event.currentTarget.dataset.index);
  event.currentTarget.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
}

function onDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function onDrop(event) {
  event.preventDefault();
  swapWires(draggedIndex, Number(event.currentTarget.dataset.index));
}

function onDragEnd(event) {
  event.currentTarget.classList.remove("dragging");
  draggedIndex = -1;
}

function beginPractice() {
  currentStandard = document.querySelector('input[name="standard"]:checked').value;
  currentOrder = shuffledDifferentFromStandard(currentStandard);
  document.getElementById("arrangeTitle").textContent = `排列${currentStandard}线序`;
  renderArrangeWires();
  showScreen("arrange");
  startTimer();
}

function finishPractice() {
  stopTimer();
  const standardOrder = standards[currentStandard];
  const correctCount = currentOrder.filter((name, index) => name === standardOrder[index]).length;
  const accuracy = Math.round((correctCount / standardOrder.length) * 100);
  lastResult = {
    standard: currentStandard,
    order: [...currentOrder],
    seconds: elapsedSeconds,
    accuracy,
  };
  renderResult();
  showScreen("result");
  requestAISuggestion();
}

function renderResult() {
  const list = document.getElementById("resultWireList");
  const standardOrder = standards[lastResult.standard];
  list.innerHTML = "";
  lastResult.order.forEach((name, index) => {
    const row = document.createElement("div");
    row.className = "result-row";
    row.appendChild(makeWireElement(name, index, "result"));
    if (name !== standardOrder[index]) {
      const mark = document.createElement("div");
      mark.className = "wrong-mark";
      mark.textContent = "×";
      row.appendChild(mark);
    } else {
      row.appendChild(document.createElement("span"));
    }
    list.appendChild(row);
  });
  document.getElementById("resultStandard").textContent = lastResult.standard;
  document.getElementById("resultTime").textContent = formatTime(lastResult.seconds);
  document.getElementById("resultAccuracy").textContent = `${lastResult.accuracy}%`;
  aiSuggestion.textContent = "这里显示AI建议";
}

function buildAISuggestionPrompt() {
  return [
    `类型：${lastResult.standard}`,
    `线序：${lastResult.order.join("、")}`,
    `准确率：${lastResult.accuracy}%`,
    `时间：${formatTime(lastResult.seconds)}`,
  ].join("\n");
}

async function requestAISuggestion() {
  const token = localStorage.getItem(apiTokenKey);
  if (!token) {
    aiSuggestion.textContent = "尚未设置 API Token，点击主页设置后可生成 AI 建议。";
    return;
  }

  aiSuggestion.textContent = "AI建议生成中...";

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          {
            role: "system",
            content:
              "你现在是嵌入在一个双绞线理线模拟网页中的评分AI，我将会告诉你理线结果，准确率，时间。请根据用户输入的数据对用户进行一段话评价",
          },
          {
            role: "user",
            content: buildAISuggestionPrompt(),
          },
        ],
        thinking: { type: "disabled" },
        max_tokens: 180,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API 请求失败：${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    aiSuggestion.textContent = content || "AI 暂未返回建议，请稍后再试。";
  } catch (error) {
    aiSuggestion.textContent = "AI建议生成失败，请检查 API Token 或网络连接。";
    console.error(error);
  }
}

function getScores() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function saveScore(name) {
  const scores = getScores();
  scores.push({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    name,
    standard: lastResult.standard,
    order: lastResult.order,
    seconds: lastResult.seconds,
    accuracy: lastResult.accuracy,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(storageKey, JSON.stringify(scores));
}

function submitScore() {
  if (!lastResult) return;
  const name = window.prompt("请输入名字");
  if (!name || !name.trim()) return;
  saveScore(name.trim());
  window.alert("提交成功");
  window.location.reload();
}

function resetToStart() {
  clearInterval(timerId);
  lastResult = null;
  currentOrder = [];
  showScreen("start");
}

function renderLeaderboard() {
  const list = document.getElementById("leaderboardList");
  const scores = getScores()
    .sort((a, b) => b.accuracy - a.accuracy || a.seconds - b.seconds || new Date(a.createdAt) - new Date(b.createdAt))
    .slice(0, 20);
  list.innerHTML = "";
  if (!scores.length) {
    const empty = document.createElement("div");
    empty.className = "empty-rank";
    empty.textContent = "暂无成绩";
    list.appendChild(empty);
    return;
  }
  scores.forEach((score, index) => {
    const row = document.createElement("div");
    row.className = "leaderboard-row";
    row.innerHTML = `
      <span>NO.${index + 1}</span>
      <span>${escapeHtml(score.name)}</span>
      <span>${score.standard}</span>
      <span>${formatTime(score.seconds)}</span>
      <span>${score.accuracy}%准确率</span>
    `;
    list.appendChild(row);
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return map[char];
  });
}

function openSettings() {
  apiTokenInput.value = localStorage.getItem(apiTokenKey) || "";
  settingsStatus.textContent = apiTokenInput.value ? "已保存 API Token" : "尚未设置 API Token";
  settingsModal.classList.add("open");
  settingsModal.setAttribute("aria-hidden", "false");
  apiTokenInput.focus();
}

function closeSettings() {
  settingsModal.classList.remove("open");
  settingsModal.setAttribute("aria-hidden", "true");
}

function saveApiToken() {
  const token = apiTokenInput.value.trim();
  if (!token) {
    settingsStatus.textContent = "请输入 API Token";
    return;
  }
  localStorage.setItem(apiTokenKey, token);
  settingsStatus.textContent = "API Token 已保存";
}

function clearApiToken() {
  localStorage.removeItem(apiTokenKey);
  apiTokenInput.value = "";
  settingsStatus.textContent = "API Token 已清空";
}

startBtn.addEventListener("click", beginPractice);
homeRankBtn.addEventListener("click", () => {
  renderLeaderboard();
  showScreen("leaderboard");
});
settingsBtn.addEventListener("click", openSettings);
saveTokenBtn.addEventListener("click", saveApiToken);
clearTokenBtn.addEventListener("click", clearApiToken);
closeSettingsBtn.addEventListener("click", closeSettings);
settingsModal.addEventListener("click", (event) => {
  if (event.target === settingsModal) closeSettings();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && settingsModal.classList.contains("open")) closeSettings();
});
finishBtn.addEventListener("click", finishPractice);
retryBtn.addEventListener("click", () => window.location.reload());
rankBtn.addEventListener("click", () => {
  renderLeaderboard();
  showScreen("leaderboard");
});
submitScoreBtn.addEventListener("click", submitScore);
backBtn.addEventListener("click", () => showScreen(lastResult ? "result" : "start"));
