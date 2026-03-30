#!/usr/bin/env node

const path = require("path");
const fs = require("fs");

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

function getModelFromTranscript(transcriptPath) {
  if (!transcriptPath) return null;
  try {
    const stat = fs.statSync(transcriptPath);
    const size = stat.size;
    const readSize = Math.min(8192, size);
    const buf = Buffer.alloc(readSize);
    const fd = fs.openSync(transcriptPath, "r");
    fs.readSync(fd, buf, 0, readSize, size - readSize);
    fs.closeSync(fd);
    const lines = buf.toString("utf8").split("\n").reverse();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type === "assistant" && entry.message && entry.message.model) {
          return entry.message.model;
        }
      } catch {}
    }
  } catch {}
  return null;
}

function modelIdToDisplayName(modelId) {
  if (!modelId) return null;
  const m = modelId.match(/claude-(\w+)-([\d]+)\.([\d]+)/);
  if (m) {
    const name = m[1].charAt(0).toUpperCase() + m[1].slice(1);
    return `${name} ${m[2]}.${m[3]}`;
  }
  return modelId;
}

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

function formatResetTime(unixTs) {
  const d = new Date(unixTs * 1000);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
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
    process.stdout.write("No limit data\n");
    return;
  }

  const rateLimits = data.rate_limits;
  if (!rateLimits) {
    process.stdout.write("No limit data\n");
    return;
  }

  const { five_hour, seven_day } = rateLimits;
  if (!five_hour && !seven_day) {
    process.stdout.write("No limit data\n");
    return;
  }

  // Project name
  const cwd = data.cwd || "";
  const projectName = cwd ? path.basename(cwd) : "?";

  // Model name — read from transcript to get per-session model
  const transcriptModel = getModelFromTranscript(data.transcript_path);
  const modelName = transcriptModel
    ? (modelIdToDisplayName(transcriptModel) || transcriptModel)
    : (() => {
        const modelInfo = data.model || {};
        return typeof modelInfo === "object" ? (modelInfo.display_name || "?") : String(modelInfo);
      })();

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
  let resetStr = "";
  for (const [key, limitData] of [["five_hour", five_hour], ["seven_day", seven_day]]) {
    if (!limitData) continue;
    const used = typeof limitData === "object" ? (limitData.used_percentage || 0) : limitData;
    const resetsAt = typeof limitData === "object" ? (limitData.resets_at || 0) : 0;
    gaugeParts.push(makeGauge(LABELS[key], used, resetsAt, key));
    if (used >= 100 && resetsAt) {
      const label = key === "seven_day" ? "🗓" : "🕐";
      const candidate = `  ${RED}↻ ${label} ${formatResetTime(resetsAt)}${RESET}`;
      // seven_day takes priority over five_hour
      if (key === "seven_day" || !resetStr) {
        resetStr = candidate;
      }
    }
  }

  const right = (gaugeParts.length ? gaugeParts.join("   ") : "No limit data") + resetStr;
  process.stdout.write(`${left}   ${right}\n`);
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => main(input));
