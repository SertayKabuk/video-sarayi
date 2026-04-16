// Video Sarayi — single-page client.

const $ = (sel) => document.querySelector(sel);

// ── state ──────────────────────────────────────────────────────────────────

const S = {
  files: [],
  selectedFile: null,
  pipelines: [],            // [{id, label, defaults, traits}, ...]
  pipelineMap: {},          // id -> pipeline object
  presets: [],              // [{id, name, pipeline, params, built_in}, ...]
  currentPipeline: null,    // pipeline id string
  currentPresetId: null,    // preset id currently selected in dropdown
  params: {},               // merged PipelineParams dict
  overrideActive: false,    // raw argv textarea active?
  currentArgv: [],          // last preview argv from backend
  previewDebounce: null,
  jobs: new Map(),          // id -> {data, logs:[], socket:null}
};

// ── param schema ───────────────────────────────────────────────────────────
// Defines how each field is rendered. `when` gates visibility by pipeline trait.

const PARAM_GROUPS = [
  {
    label: "Reframe (Insta360 X5 360→flat)",
    when: (t) => t.uses_v360,
    grid: "cols-3",
    fields: [
      { key: "yaw",        label: "Yaw",           type: "number", step: 1,   hint: "0–360, pan around sphere" },
      { key: "pitch",      label: "Pitch",          type: "number", step: 1,   hint: "-90 (down) to 90 (up)" },
      { key: "roll",       label: "Roll",           type: "number", step: 1,   hint: "Horizon leveling" },
      { key: "h_fov",      label: "H FOV °",        type: "number", step: 1,   min: 1, max: 360 },
      { key: "v_fov",      label: "V FOV °",        type: "number", step: 1,   min: 1, max: 180 },
      { key: "v360_interp",label: "Interp",         type: "select", options: ["lanczos","bilinear","nearest","spline16"] },
    ],
  },
  {
    label: "Crop (DJI Action 6)",
    when: (t) => t.lut === "dji",
    grid: "cols-2",
    fields: [
      { key: "crop_enabled", label: "Enable crop", type: "checkbox",
        hint: "Reel: always on (9:16). YouTube: enable only for square-sensor footage." },
      { key: "crop_expr", label: "Crop expression", type: "text",
        hint: "9:16 vertical: ih*(9/16):ih   16:9 from square: iw:iw*(9/16)" },
    ],
  },
  {
    label: "LUT",
    grid: "cols-2",
    fields: [
      { key: "lut_interp", label: "Interpolation", type: "select", options: ["tetrahedral","trilinear","nearest"] },
    ],
  },
  {
    label: "Scale",
    grid: "cols-3",
    fields: [
      { key: "scale_width",  label: "Width",  type: "number", step: 2,  hint: "0 = skip scale" },
      { key: "scale_height", label: "Height", type: "number", step: 2,  hint: "0 = skip scale" },
      { key: "scale_flags",  label: "Flags",  type: "select", options: ["lanczos","bilinear","bicubic","neighbor","spline"] },
    ],
  },
  {
    label: "Pixel format",
    grid: "cols-2",
    fields: [
      { key: "pix_fmt", label: "pix_fmt", type: "select", options: ["yuv420p10le","yuv420p","yuv444p10le"] },
    ],
  },
  {
    label: "x265 encoder",
    when: (t) => t.encoder === "x265",
    grid: "cols-3",
    fields: [
      { key: "x265_preset",      label: "Preset",        type: "select", options: ["ultrafast","superfast","veryfast","faster","fast","medium","slow","slower","veryslow","placebo"] },
      { key: "x265_profile",     label: "Profile",       type: "select", options: ["main","main10","main12"] },
      { key: "x265_crf",         label: "CRF",           type: "number", step: 1, min: 0, max: 51 },
      { key: "x265_vbv_maxrate", label: "VBV maxrate kbps", type: "number", step: 500 },
      { key: "x265_vbv_bufsize", label: "VBV bufsize kbps", type: "number", step: 500 },
      { key: "x265_aq_mode",     label: "AQ mode",       type: "select", options: ["0","1","2","3","4"] },
      { key: "x265_aq_strength", label: "AQ strength",   type: "number", step: 0.1, min: 0, max: 3 },
      { key: "x265_psy_rd",      label: "psy-rd",        type: "number", step: 0.1, min: 0, max: 4 },
      { key: "x265_psy_rdoq",    label: "psy-rdoq",      type: "number", step: 0.1, min: 0, max: 50 },
      { key: "x265_extra",       label: "Extra x265-params", type: "text", hint: "colon-separated, appended verbatim", wide: true },
    ],
  },
  {
    label: "SVT-AV1 encoder",
    when: (t) => t.encoder === "av1",
    grid: "cols-3",
    fields: [
      { key: "av1_preset", label: "Preset (0=slow…13=fast)", type: "number", step: 1, min: 0, max: 13 },
      { key: "av1_crf",    label: "CRF",                     type: "number", step: 1, min: 1, max: 63 },
      { key: "av1_tune",   label: "Tune (0=VQ, 1=PSNR)",     type: "select", options: ["0","1"] },
      { key: "av1_extra",  label: "Extra svtav1-params",     type: "text", hint: "colon-separated, appended verbatim", wide: true },
    ],
  },
  {
    label: "Audio",
    grid: "cols-3",
    fields: [
      { key: "audio_codec",   label: "Codec",   type: "select", options: ["aac","libopus","libfdk_aac","mp3","copy"] },
      { key: "audio_bitrate", label: "Bitrate", type: "text",   hint: "e.g. 256k, 384k, 192k" },
      { key: "audio_rate",    label: "Rate Hz", type: "number", step: 8000 },
    ],
  },
  {
    label: "Color metadata",
    grid: "cols-3",
    fields: [
      { key: "color_primaries", label: "Primaries",   type: "select", options: ["bt709","bt2020","smpte170m","bt470bg"] },
      { key: "color_trc",       label: "Transfer",    type: "select", options: ["bt709","smpte2084","arib-std-b67","smpte170m","bt2020-10","linear"] },
      { key: "colorspace",      label: "Color space", type: "select", options: ["bt709","bt2020nc","bt2020c","smpte170m"] },
    ],
  },
  {
    label: "Container",
    grid: "cols-2",
    fields: [
      { key: "faststart", label: "movflags +faststart", type: "checkbox" },
    ],
  },
];

// ── boot ───────────────────────────────────────────────────────────────────

async function boot() {
  // Pipelines must load before presets (selectBestPreset needs S.pipelineMap).
  await Promise.all([loadHealth(), loadPipelines(), loadInputs(), loadJobs()]);
  await loadPresets();
  wireEvents();
}

async function loadHealth() {
  const r = await fetch("/api/health").then((r) => r.json());
  const el = $("#health");
  el.innerHTML = "";
  for (const c of r.checks) {
    const pill = document.createElement("span");
    pill.className = "pill " + (c.ok ? "ok" : "fail");
    pill.textContent = (c.ok ? "OK " : "FAIL ") + c.name;
    pill.title = c.detail || "";
    el.appendChild(pill);
  }
}

async function loadPipelines() {
  const r = await fetch("/api/pipelines").then((r) => r.json());
  S.pipelines = r.pipelines;
  S.pipelineMap = {};
  for (const p of r.pipelines) S.pipelineMap[p.id] = p;
  // Pipeline is derived from camera+platform; no dropdown to populate.
  S.currentPipeline = derivePipeline($("#camera").value, $("#platform").value);
  const p = S.pipelineMap[S.currentPipeline];
  if (p) S.params = { ...p.defaults };
}

function derivePipeline(camera, platform) {
  return `${camera}-${platform}`; // matches backend ids: x5-reel, x5-yt, a6-reel, a6-yt
}

function selectBestPreset(pipeline) {
  // Always default to the built-in (= research defaults). It's always present.
  const builtin = S.presets.find((p) => p.built_in && p.pipeline === pipeline);
  if (builtin) {
    S.currentPresetId = builtin.id;
    S.params = { ...builtin.params };
  } else {
    S.currentPresetId = null;
    const pl = S.pipelineMap[pipeline];
    if (pl) S.params = { ...pl.defaults };
  }
}

async function loadPresets() {
  const r = await fetch("/api/presets").then((r) => r.json());
  S.presets = r.presets;
  // Auto-select best preset for initial pipeline (only on first load when no
  // preset has been chosen yet).
  if (!S.currentPresetId && S.currentPipeline) {
    selectBestPreset(S.currentPipeline);
  }
  renderPresetDropdown();
}

async function loadInputs() {
  const r = await fetch("/api/inputs").then((r) => r.json());
  S.files = r.files;
  const ul = $("#file-list");
  ul.innerHTML = "";
  if (!S.files.length) {
    ul.innerHTML = `<li style="cursor:default"><em style="color:var(--muted)">No files yet.</em></li>`;
    return;
  }
  for (const f of S.files) {
    const li = document.createElement("li");
    li.dataset.name = f.name;
    li.innerHTML = `<span>${escHtml(f.name)}</span><span class="size">${fmtSize(f.size)}</span>`;
    if (S.selectedFile === f.name) li.classList.add("selected");
    li.addEventListener("click", () => selectFile(f.name));
    ul.appendChild(li);
  }
}

async function loadJobs() {
  const r = await fetch("/api/jobs").then((r) => r.json());
  for (const j of r.jobs) {
    if (!S.jobs.has(j.id)) S.jobs.set(j.id, { data: j, logs: [], socket: null });
    else S.jobs.get(j.id).data = j;
    if (j.status === "queued" || j.status === "running") openSocket(j.id);
  }
  renderJobs();
}

// ── wiring ─────────────────────────────────────────────────────────────────

function wireEvents() {
  $("#btn-refresh-inputs").addEventListener("click", loadInputs);
  window.addEventListener("focus", loadInputs);

  function onCameraOrPlatformChange() {
    const newPipeline = derivePipeline($("#camera").value, $("#platform").value);
    $("#pipeline").value = newPipeline;
    S.currentPipeline = newPipeline;
    selectBestPreset(newPipeline);   // auto-pick research defaults for this pipeline
    renderPresetDropdown();
    renderParamsForm();
    schedulePreview();
  }

  $("#camera").addEventListener("change", onCameraOrPlatformChange);
  $("#platform").addEventListener("change", onCameraOrPlatformChange);

  $("#preset").addEventListener("change", (e) => {
    const id = e.target.value;
    if (!id) return;
    S.currentPresetId = id;
    const preset = S.presets.find((p) => p.id === id);
    if (!preset) return;
    // Switch pipeline to match preset if needed
    if (preset.pipeline !== S.currentPipeline) {
      S.currentPipeline = preset.pipeline;
      $("#pipeline").value = preset.pipeline;
    }
    S.params = { ...preset.params };
    updateFormFromParams();
    schedulePreview();
    updatePresetButtons();
  });

  $("#btn-preset-save-as").addEventListener("click", savePresetAs);
  $("#btn-preset-save").addEventListener("click", savePresetOverwrite);
  $("#btn-preset-duplicate").addEventListener("click", duplicatePreset);
  $("#btn-preset-delete").addEventListener("click", deletePreset);

  $("#override-toggle").addEventListener("change", (e) => {
    S.overrideActive = e.target.checked;
    const ta = $("#argv-override");
    const pre = $("#argv-preview");
    if (S.overrideActive) {
      ta.hidden = false;
      pre.hidden = true;
      ta.value = S.currentArgv.join("\n");
    } else {
      ta.hidden = true;
      pre.hidden = false;
    }
  });

  $("#argv-override").addEventListener("input", () => {
    S.currentArgv = $("#argv-override").value.split("\n").filter((l) => l.trim());
  });

  $("#btn-convert").addEventListener("click", submitJob);

  // Render initial form — params may already be populated by loadPresets' selectBestPreset.
  renderParamsForm();
  schedulePreview();
}

// ── param form ─────────────────────────────────────────────────────────────

function renderParamsForm() {
  const container = $("#params-form");
  container.innerHTML = "";
  const traits = S.pipelineMap[S.currentPipeline]?.traits || {};

  for (const group of PARAM_GROUPS) {
    if (group.when && !group.when(traits)) continue;

    const fs = document.createElement("fieldset");
    fs.className = "group";
    fs.innerHTML = `<legend>${escHtml(group.label)}</legend>`;

    const grid = document.createElement("div");
    grid.className = "grid " + (group.grid || "cols-3");
    fs.appendChild(grid);

    for (const f of group.fields) {
      const cell = document.createElement("div");
      cell.className = "cell" + (f.wide ? " wide" : "");
      if (f.wide) cell.style.gridColumn = "1 / -1";

      let input;
      const val = S.params[f.key];

      if (f.type === "checkbox") {
        cell.innerHTML = `<label><input type="checkbox" data-key="${f.key}" ${val ? "checked" : ""} /> ${escHtml(f.label)}</label>`;
      } else if (f.type === "select") {
        input = document.createElement("select");
        input.dataset.key = f.key;
        for (const opt of f.options) {
          const o = document.createElement("option");
          o.value = opt;
          o.textContent = opt;
          if (String(val) === opt) o.selected = true;
          input.appendChild(o);
        }
        cell.innerHTML = `<label>${escHtml(f.label)}</label>`;
        cell.appendChild(input);
      } else {
        cell.innerHTML = `<label>${escHtml(f.label)}</label>`;
        input = document.createElement("input");
        input.type = f.type;
        input.dataset.key = f.key;
        input.value = val ?? "";
        if (f.step != null) input.step = f.step;
        if (f.min != null) input.min = f.min;
        if (f.max != null) input.max = f.max;
        cell.appendChild(input);
      }

      if (f.hint) {
        const h = document.createElement("div");
        h.className = "hint";
        h.textContent = f.hint;
        cell.appendChild(h);
      }
      grid.appendChild(cell);
    }

    // Wire change events for the whole fieldset
    fs.addEventListener("change", (e) => {
      const el = e.target;
      const key = el.dataset.key;
      if (!key) return;
      if (el.type === "checkbox") S.params[key] = el.checked;
      else if (el.type === "number") S.params[key] = el.value === "" ? null : Number(el.value);
      else S.params[key] = el.value;
      S.currentPresetId = null;      // unsaved change
      renderPresetDropdown();
      schedulePreview();
    });

    container.appendChild(fs);
  }
}

function updateFormFromParams() {
  // Re-render the form with current S.params without rebuilding from scratch.
  renderParamsForm();
}

// ── preset dropdown ─────────────────────────────────────────────────────────

function renderPresetDropdown() {
  const sel = $("#preset");
  sel.innerHTML = "";

  // Only show presets for the current pipeline.
  const forPipeline = S.presets.filter((p) => p.pipeline === S.currentPipeline);
  const builtins = forPipeline.filter((p) => p.built_in);
  const user = forPipeline.filter((p) => !p.built_in);

  // Unsaved option — only shown when params have been hand-edited.
  const unsavedOpt = document.createElement("option");
  unsavedOpt.value = "";
  unsavedOpt.textContent = "(modified — unsaved)";
  unsavedOpt.hidden = !!S.currentPresetId;  // hide when a real preset is active
  sel.appendChild(unsavedOpt);

  if (builtins.length) {
    const og = document.createElement("optgroup");
    og.label = "Research defaults";
    for (const p of builtins) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      og.appendChild(opt);
    }
    sel.appendChild(og);
  }

  if (user.length) {
    const og = document.createElement("optgroup");
    og.label = "Saved";
    for (const p of user) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      og.appendChild(opt);
    }
    sel.appendChild(og);
  }

  if (S.currentPresetId) sel.value = S.currentPresetId;
  updatePresetButtons();
}

function updatePresetButtons() {
  const isUser = S.currentPresetId && !S.currentPresetId.startsWith("builtin:");
  $("#btn-preset-save").disabled = !isUser;
  $("#btn-preset-delete").disabled = !isUser;
}

// ── preset CRUD ─────────────────────────────────────────────────────────────

async function savePresetAs() {
  const name = prompt("Preset name:", "My preset");
  if (!name?.trim()) return;
  const r = await fetch("/api/presets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim(), pipeline: S.currentPipeline, params: S.params }),
  });
  if (!r.ok) { alert(`Save failed: ${(await r.json().catch(() => ({}))).error || r.statusText}`); return; }
  const preset = await r.json();
  S.currentPresetId = preset.id;
  await loadPresets();
}

async function savePresetOverwrite() {
  if (!S.currentPresetId || S.currentPresetId.startsWith("builtin:")) return;
  const r = await fetch(`/api/presets/${S.currentPresetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ params: S.params }),
  });
  if (!r.ok) { alert(`Save failed: ${(await r.json().catch(() => ({}))).error || r.statusText}`); return; }
  await loadPresets();
}

async function duplicatePreset() {
  const src = S.currentPresetId || ("builtin:" + S.currentPipeline);
  const srcPreset = S.presets.find((p) => p.id === src);
  const name = prompt("Name for copy:", srcPreset ? `${srcPreset.name} (copy)` : "Copy");
  if (!name?.trim()) return;
  const r = await fetch(`/api/presets/${src}/duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
  });
  if (!r.ok) { alert(`Duplicate failed: ${(await r.json().catch(() => ({}))).error || r.statusText}`); return; }
  const preset = await r.json();
  S.currentPresetId = preset.id;
  S.params = { ...preset.params };
  await loadPresets();
  updateFormFromParams();
}

async function deletePreset() {
  if (!S.currentPresetId || S.currentPresetId.startsWith("builtin:")) return;
  const srcPreset = S.presets.find((p) => p.id === S.currentPresetId);
  if (!confirm(`Delete preset "${srcPreset?.name || S.currentPresetId}"?`)) return;
  const r = await fetch(`/api/presets/${S.currentPresetId}`, { method: "DELETE" });
  if (!r.ok) { alert(`Delete failed: ${(await r.json().catch(() => ({}))).error || r.statusText}`); return; }
  S.currentPresetId = null;
  await loadPresets();
  const p = S.pipelineMap[S.currentPipeline];
  if (p) { S.params = { ...p.defaults }; updateFormFromParams(); }
}

// ── argv preview ────────────────────────────────────────────────────────────

function schedulePreview() {
  clearTimeout(S.previewDebounce);
  S.previewDebounce = setTimeout(fetchPreview, 180);
}

async function fetchPreview() {
  try {
    const r = await fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file: S.selectedFile,
        pipeline: S.currentPipeline,
        params: S.params,
      }),
    });
    if (!r.ok) return;
    const data = await r.json();
    S.currentArgv = data.argv;
    renderArgvPreview(data.argv);
    if (S.overrideActive) $("#argv-override").value = data.argv.join("\n");
  } catch (_) {
    // network or parse error — preview stays stale
  }
}

function renderArgvPreview(argv) {
  const pre = $("#argv-preview");
  if (S.overrideActive) return;
  // Colorize: binary, flags, values, input/output
  let lines = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (i === 0) lines.push(`<span style="color:var(--ok)">${escHtml(a)}</span>`);
    else if (a.startsWith("-")) lines.push(`<span style="color:var(--accent)">${escHtml(a)}</span>`);
    else lines.push(`<span style="color:var(--text)">${escHtml(a)}</span>`);
  }
  pre.innerHTML = lines.join("\n");
}

// ── file selection ──────────────────────────────────────────────────────────

function selectFile(name) {
  S.selectedFile = name;
  $("#selected-file").textContent = name;
  $("#selected-file").classList.add("has-file");
  for (const li of document.querySelectorAll("#file-list li"))
    li.classList.toggle("selected", li.dataset.name === name);
  $("#btn-convert").disabled = false;
  schedulePreview();
}

// ── job submission ──────────────────────────────────────────────────────────

async function submitJob() {
  const btn = $("#btn-convert");
  const err = $("#convert-error");
  err.hidden = true;
  if (!S.selectedFile) return;

  const body = { file: S.selectedFile, pipeline: S.currentPipeline };

  if (S.overrideActive) {
    const tokens = $("#argv-override").value.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!tokens.length) { err.textContent = "Raw command is empty."; err.hidden = false; return; }
    body.argv_override = tokens;
  } else {
    body.params = S.params;
  }

  btn.disabled = true;
  try {
    const r = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const payload = await r.json().catch(() => ({ error: r.statusText }));
      throw new Error(payload.error || r.statusText);
    }
    const job = await r.json();
    S.jobs.set(job.id, { data: job, logs: [], socket: null });
    openSocket(job.id);
    renderJobs();
  } catch (e) {
    err.textContent = String(e.message || e);
    err.hidden = false;
  } finally {
    btn.disabled = false;
  }
}

// ── WebSocket ───────────────────────────────────────────────────────────────

function openSocket(jobId) {
  const entry = S.jobs.get(jobId);
  if (!entry || entry.socket) return;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${location.host}/api/jobs/${jobId}/events`);
  entry.socket = ws;
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "status") { entry.data = msg.job; renderJobs(); }
    else if (msg.type === "progress") { Object.assign(entry.data, msg); renderJobs(); }
    else if (msg.type === "log") {
      entry.logs.push(msg.line);
      if (entry.logs.length > 400) entry.logs.splice(0, entry.logs.length - 400);
      updateLog(jobId);
    }
  });
  ws.addEventListener("close", () => { entry.socket = null; });
}

// ── jobs rendering ──────────────────────────────────────────────────────────

function renderJobs() {
  const ul = $("#job-list");
  const ids = Array.from(S.jobs.keys()).reverse();
  ul.innerHTML = "";
  if (!ids.length) {
    ul.innerHTML = `<li style="color:var(--muted); font-size:12px">No jobs yet.</li>`;
    return;
  }
  for (const id of ids) ul.appendChild(renderJob(S.jobs.get(id)));
}

function renderJob(entry) {
  const j = entry.data;
  const li = document.createElement("li");
  li.className = "job";
  li.dataset.id = j.id;
  const pct = j.percent == null ? 0 : Math.max(0, Math.min(100, j.percent));
  const metrics = [
    pct ? `${pct.toFixed(1)}%` : null,
    j.frame != null ? `frame ${j.frame}` : null,
    j.fps ? `${j.fps.toFixed(1)} fps` : null,
    j.speed ? `speed ${j.speed}` : null,
    j.duration_s ? `dur ${fmtDuration(j.duration_s)}` : null,
  ].filter(Boolean).join(" · ");

  li.innerHTML = `
    <div class="job-head">
      <div class="job-title"><strong>${escHtml(j.pipeline)}</strong> · ${escHtml(j.input)} → ${escHtml(j.output)}</div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="status ${j.status}">${j.status}</span>
        <div class="job-actions"></div>
      </div>
    </div>
    <div class="bar"><div style="width:${pct}%"></div></div>
    <div class="metrics">${metrics || "&nbsp;"}</div>
    ${j.error ? `<div class="error" style="margin-top:8px">${escHtml(j.error)}</div>` : ""}
    <div class="log" id="log-${j.id}" hidden></div>`;

  const actions = li.querySelector(".job-actions");

  const toggleLog = document.createElement("button");
  toggleLog.className = "ghost";
  toggleLog.textContent = "Log";
  toggleLog.addEventListener("click", () => {
    const log = li.querySelector(".log");
    log.hidden = !log.hidden;
    if (!log.hidden) updateLog(j.id);
  });
  actions.appendChild(toggleLog);

  if (j.status === "queued" || j.status === "running") {
    const cancel = document.createElement("button");
    cancel.className = "ghost";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => cancelJob(j.id));
    actions.appendChild(cancel);
  }
  if (j.status === "done") {
    const a = document.createElement("a");
    a.href = `/output/${encodeURIComponent(j.output)}`;
    a.textContent = "Download";
    a.target = "_blank"; a.rel = "noopener";
    actions.appendChild(a);
  }
  return li;
}

function updateLog(jobId) {
  const el = document.getElementById(`log-${jobId}`);
  if (!el || el.hidden) return;
  const entry = S.jobs.get(jobId);
  if (!entry) return;
  el.textContent = entry.logs.slice(-200).join("\n");
  el.scrollTop = el.scrollHeight;
}

async function cancelJob(id) {
  const r = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
  if (!r.ok) alert(`Cancel failed: ${(await r.json().catch(() => ({}))).error || r.statusText}`);
}

// ── utils ───────────────────────────────────────────────────────────────────

function fmtSize(bytes) {
  const u = ["B","KB","MB","GB","TB"];
  let i = 0, v = bytes;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

function fmtDuration(sec) {
  const s = Math.round(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2,"0")}:${String(r).padStart(2,"0")}` : `${m}:${String(r).padStart(2,"0")}`;
}

const ESC = { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":'&#39;' };
function escHtml(s) { return String(s).replace(/[&<>"']/g, c => ESC[c]); }

boot();
