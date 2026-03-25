#!/usr/bin/env node

const GAUGE_WIDTH = 15;
const RESET = "\033[0m";
const GREEN = "\033[32m";
const YELLOW = "\033[33m";
const RED = "\033[31m";
const DIM = "\033[2m";

const PERIOD_SECONDS = {
  five_hour: 5 * 3600,
  seven_day: 7 * 24 * 3600,
};

const LABELS = {
  five_hour: "\u{1F550}",   // 🕐
  seven_day: "\u{1F5D3} ",  // 🗓 + space for alignment
};

function getPaceColor(delta) {
  if (delta <= -15) return RED;
  if (delta <= -5) return YELLOW;
  return GREEN;
}

function calcExpectedUsage(resetsAt, periodKey) {
  const now = Date.now() / 1000;
  const total = PERIOD_SECONDS[periodKey];
  if (!total) return null;
  const remainingSec = Math.max(0, resetsAt - now);
  const elapsedSec = total - remainingSec;
  const elapsedRatio = Math.max(0, Math.min(1, elapsedSec / total));
  return elapsedRatio * 100;
}

function makeGauge(label, used, resetsAt, periodKey) {
  used = Math.max(0, Math.min(100, used));
  const remaining = 100 - used;

  const expectedUsed = calcExpectedUsage(resetsAt, periodKey);
  let delta = 0;
  let expectedRemaining = null;
  if (expectedUsed !== null) {
    delta = expectedUsed - used;
    expectedRemaining = 100 - expectedUsed;
  }

  const color = getPaceColor(delta);

  const steps = GAUGE_WIDTH * 2;
  const fillSteps = Math.round(steps * remaining / 100);
  const markerStep = expectedRemaining !== null
    ? Math.round(steps * expectedRemaining / 100)
    : null;

  const bar = [];
  for (let i = 0; i < GAUGE_WIDTH; i++) {
    const left = i * 2;
    const right = left + 1;
    const isMarkerLeft = markerStep !== null && left === markerStep;
    const isMarkerRight = markerStep !== null && right === markerStep;

    if (isMarkerLeft || isMarkerRight) {
      bar.push(`${DIM}\u2502${RESET}${color}`);
    } else if (fillSteps >= right + 1) {
      bar.push("\u2588");
    } else if (fillSteps === right) {
      bar.push("\u258C");
    } else {
      bar.push("\u2591");
    }
  }

  return `${label} ${color}${bar.join("")}${RESET}`;
}

function main(input) {
  let data;
  try {
    data = JSON.parse(input);
  } catch {
    process.stdout.write("한도데이터 없음\n");
    return;
  }

  const rateLimits = data.rate_limits;
  if (!rateLimits) {
    process.stdout.write("한도데이터 없음\n");
    return;
  }

  const { five_hour, seven_day } = rateLimits;
  if (!five_hour && !seven_day) {
    process.stdout.write("한도데이터 없음\n");
    return;
  }

  // Project name
  const cwd = data.cwd || "";
  const projectName = cwd ? cwd.split("/").pop() : "?";

  // Model name
  const modelInfo = data.model || {};
  const modelName = typeof modelInfo === "object"
    ? (modelInfo.display_name || "?")
    : String(modelInfo);

  // Context window usage
  const ctxWindow = data.context_window || {};
  const ctxUsed = ctxWindow.used_percentage;
  let ctxStr = "";
  if (ctxUsed != null) {
    const ctxColor = ctxUsed >= 80 ? RED : ctxUsed >= 60 ? YELLOW : DIM;
    ctxStr = ` ${ctxColor}${ctxUsed}%${RESET}`;
  }

  const left = `\u{1F4C2} ${projectName}  \u{1F916} ${modelName}${ctxStr}`;

  const gaugeParts = [];
  for (const [key, limitData] of [["five_hour", five_hour], ["seven_day", seven_day]]) {
    if (!limitData) continue;
    const used = typeof limitData === "object" ? (limitData.used_percentage || 0) : limitData;
    const resetsAt = typeof limitData === "object" ? (limitData.resets_at || 0) : 0;
    gaugeParts.push(makeGauge(LABELS[key], used, resetsAt, key));
  }

  const right = gaugeParts.length ? gaugeParts.join("   ") : "한도데이터 없음";
  process.stdout.write(`${left}   ${right}\n`);
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => main(input));
