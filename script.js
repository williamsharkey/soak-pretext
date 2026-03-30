const AD_PARAGRAPHS = [
  {
    accent: true,
    text:
      `“1984 won’t be like ‘1984’.” The phrase is short, but the frame behind it is larger: bowed heads, a bright runner, and a room that suddenly looks ready to answer its own script. In this demo the opening paragraph stays deliberately full so the first soak can read like a design choice instead of a crude spacer.`,
  },
  {
    anchorId: "col2",
    text:
      `Runner becomes the interruption. She carries color into the aisle, and the surrounding syntax starts acting less fixed. This is the first word the soak system protects when the measure breaks from one column into several.`,
  },
  {
    anchorId: "col3",
    text:
      `Hammer flips the rhythm. It behaves like punctuation with mass: a throw that reformats the room. The bouncing ornaments echo that move by living inside the field instead of staying politely outside it.`,
  },
  {
    anchorId: "col4",
    text:
      `Macintosh arrives as the afterimage, a promise that the interface can feel personal and elastic. The soak blocks keep adjusting so the last column still opens on a chosen word even while the ornaments continue to drift.`,
  },
];

const PAPER_PARAGRAPHS = [
  {
    accent: true,
    text:
      `Lemma I. Let the page be treated as a soft boundary rather than a hard cut. A pretext soaker inserted earlier in the proof may change height later if that is what preserves the next deliberate opening word.`,
  },
  {
    text:
      `The intuition is editorial rather than mechanical. We want the flow to behave as though it remembers future obligations, so a layout buffer measures not only its own footprint but also the later heading whose arrival matters.`,
  },
  {
    anchorId: "page2",
    accent: true,
    text:
      `Lemma II. Suppose the second sheet must begin on the same declarative note every time. Then the hidden reservoir before it absorbs height until the heading settles against the page top, after which the proof continues with ordinary line breaking.`,
  },
  {
    text:
      `Diagrams, side notes, and ornamental equations can all live beneath the shared flow. They do not determine pagination directly, but they make the page feel like a constructed mathematical object instead of a neutral browser column.`,
  },
  {
    anchorId: "page3",
    accent: true,
    text:
      `Lemma III. Finally, the same mechanism can preserve a third opening on the last sheet. The soaker does not know any theorem; it only knows that a later start matters and that its own size is the negotiable quantity that protects that start.`,
  },
  {
    text:
      `This turns soaking into a small design language. One item may act like a ribbon, another like a hinge, another like a dark reservoir under the text, but they all share the same job: hold a future line in place by changing themselves earlier in the document.`,
  },
];

const FLOATER_KINDS = {
  moon: {
    size: 58,
    html: `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path fill="currentColor" d="M31 6c-8.6 1.2-15.2 8.7-15.2 17.7C15.8 33.8 24 42 34.1 42c3 0 5.8-.7 8.2-2-2.5 1-5.4 1.4-8.3.9C23.8 39 16 30.5 16 20.4c0-5.7 2.5-10.8 6.5-14.4A19.7 19.7 0 0 1 31 6Z"></path>
      </svg>
    `,
  },
  star: {
    size: 56,
    html: `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path fill="currentColor" d="m24 4 4.9 14.4L44 24l-15.1 5.6L24 44l-4.9-14.4L4 24l15.1-5.6L24 4Z"></path>
      </svg>
    `,
  },
  spark: {
    size: 52,
    html: `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path fill="currentColor" d="M24 6c1.6 9.8 8.2 16.4 18 18-9.8 1.6-16.4 8.2-18 18-1.6-9.8-8.2-16.4-18-18 9.8-1.6 16.4-8.2 18-18Z"></path>
      </svg>
    `,
  },
  hammer: {
    size: 60,
    html: `<span aria-hidden="true">🔨</span>`,
  },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function getObstacleShape(kind, size) {
  if (kind === "star" || kind === "spark") {
    return "polygon(50% 0%, 64% 36%, 100% 50%, 64% 64%, 50% 100%, 36% 64%, 0% 50%, 36% 36%)";
  }

  if (kind === "hammer") {
    return "polygon(18% 10%, 82% 10%, 82% 34%, 58% 34%, 58% 100%, 42% 100%, 42% 34%, 18% 34%)";
  }

  return `circle(${Math.round(size / 2)}px at 50% 50%)`;
}

class SoakScene {
  constructor(config) {
    this.flow = config.flow;
    this.guideRoot = config.guideRoot || null;
    this.summary = config.summary || null;
    this.unitCount = config.initialUnitCount;
    this.maxUnitCount = config.maxUnitCount;
    this.paragraphs = config.paragraphs;
    this.controlsRoot = config.controlsRoot;
    this.unitLabel = config.unitLabel;
    this.anchorConfigs = config.anchors.map((anchor) => ({ ...anchor }));
    this.anchorState = new Map();
    this.tokens = [];
    this.floaterObstacles = new Map();
    this.baseHeight = config.baseHeight || 16;
    this.maxHeight = config.maxHeight || 1200;
    this.lastSolveAt = 0;
    this.solveQueued = false;
    this.solveTimer = 0;
    this.render();
    this.renderControls();
    this.solve();
    this.resizeHandler = this.debounce(() => this.solve(), 80);
    window.addEventListener("resize", this.resizeHandler);
  }

  debounce(fn, delay) {
    let timeoutId = 0;
    return (...args) => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => fn(...args), delay);
    };
  }

  setUnitCount(count) {
    this.unitCount = count;
    this.flow.style.setProperty("--unit-count", String(count));
    this.renderGuides();
    this.solve();
  }

  render() {
    this.flow.innerHTML = "";
    this.flow.style.setProperty("--unit-count", String(this.unitCount));
    this.anchorState.clear();
    this.tokens = [];
    this.floaterObstacles.clear();

    for (const paragraph of this.paragraphs) {
      const node = document.createElement("div");
      node.className = "text-paragraph";
      node.dataset.accent = paragraph.accent ? "true" : "false";

      const parts = paragraph.text.split(/(\s+)/);
      let anchorPlaced = false;

      for (const part of parts) {
        if (!part) {
          continue;
        }

        if (/^\s+$/.test(part)) {
          node.append(document.createTextNode(part));
          continue;
        }

        if (paragraph.anchorId && !anchorPlaced) {
          const anchorConfig = this.anchorConfigs.find((anchor) => anchor.id === paragraph.anchorId);
          const soak = document.createElement("span");
          soak.className = `soak-block ${anchorConfig.variant}`;
          soak.dataset.label = anchorConfig.soakLabel;
          soak.style.setProperty("--size", `${this.baseHeight}px`);
          node.append(soak);

          const token = document.createElement("span");
          token.className = "word-token anchor-token";
          token.dataset.anchorId = paragraph.anchorId;
          token.textContent = part;
          node.append(token);
          this.tokens.push(token);

          this.anchorState.set(paragraph.anchorId, {
            config: anchorConfig,
            paragraph: node,
            soak,
            token,
            height: this.baseHeight,
            result: { unit: 1, top: 0 },
          });

          anchorPlaced = true;
          continue;
        }

        const token = document.createElement("span");
        token.className = "word-token";
        token.textContent = part;
        node.append(token);
        this.tokens.push(token);
      }

      this.flow.append(node);
    }

    this.renderGuides();
  }

  renderGuides() {
    if (!this.guideRoot) {
      return;
    }

    this.guideRoot.innerHTML = "";
    this.guideRoot.style.gridTemplateColumns = `repeat(${this.unitCount}, minmax(0, 1fr))`;

    for (let index = 0; index < this.unitCount; index += 1) {
      const guide = document.createElement("div");
      guide.className = "column-guide";
      this.guideRoot.append(guide);
    }
  }

  renderControls() {
    this.controlsRoot.innerHTML = "";
    for (const anchor of this.anchorConfigs) {
      const card = document.createElement("article");
      card.className = "soak-card";
      card.dataset.anchorId = anchor.id;
      card.innerHTML = `
        <div class="soak-row">
          <span class="soak-chip ${anchor.variant}" aria-hidden="true"></span>
          <div class="soak-copy">
            <strong>${anchor.soakLabel}</strong>
            <small>Protects “${anchor.wordLabel}” at ${this.unitLabel} ${anchor.targetUnit}</small>
          </div>
        </div>
        <div class="soak-row">
          <span class="soak-meta" data-role="meta">Idle</span>
          <button class="soak-toggle" type="button">Lock ${this.unitLabel} ${anchor.targetUnit}</button>
        </div>
      `;

      const button = card.querySelector(".soak-toggle");
      button.addEventListener("click", () => {
        anchor.enabled = !anchor.enabled;
        this.solve();
      });

      this.controlsRoot.append(card);
    }
  }

  getGap() {
    return parseFloat(window.getComputedStyle(this.flow).columnGap) || 0;
  }

  getUnitWidth() {
    const gap = this.getGap();
    return (this.flow.clientWidth - gap * (this.unitCount - 1)) / this.unitCount;
  }

  scheduleSolve() {
    if (this.solveQueued) {
      return;
    }

    const now = performance.now();
    const wait = Math.max(0, 100 - (now - this.lastSolveAt));
    this.solveQueued = true;

    const run = () => {
      this.solveQueued = false;
      this.solveTimer = 0;
      this.solve();
    };

    if (wait > 0) {
      this.solveTimer = window.setTimeout(run, wait);
      return;
    }

    requestAnimationFrame(run);
  }

  getFloaterCenter(floater) {
    return {
      x: floater.bounds.left + floater.x + floater.element.offsetWidth / 2,
      y: floater.bounds.top + floater.y + floater.element.offsetHeight / 2,
    };
  }

  getUnitIndexForPoint(clientX) {
    const flowRect = this.flow.getBoundingClientRect();
    const width = this.getUnitWidth();
    const gap = this.getGap();
    return Math.max(1, Math.floor((clientX - flowRect.left) / (width + gap)) + 1);
  }

  getObstacleSide(floaterCenterX, targetUnit) {
    const flowRect = this.flow.getBoundingClientRect();
    const width = this.getUnitWidth();
    const gap = this.getGap();
    const unitLeft = flowRect.left + (targetUnit - 1) * (width + gap);
    return floaterCenterX < unitLeft + width / 2 ? "left" : "right";
  }

  findNearestToken(floater) {
    const center = this.getFloaterCenter(floater);
    const targetUnit = this.getUnitIndexForPoint(center.x);
    let bestToken = null;
    let bestUnit = targetUnit;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const token of this.tokens) {
      const rect = token.getBoundingClientRect();
      if (!rect.width && !rect.height) {
        continue;
      }

      const tokenX = rect.left + Math.min(rect.width, 20) / 2;
      const tokenY = rect.top + rect.height / 2;
      const tokenUnit = this.getUnitIndexForPoint(tokenX);
      const score =
        Math.abs(tokenUnit - targetUnit) * 420 +
        Math.abs(tokenX - center.x) * 0.55 +
        Math.abs(tokenY - center.y) * 1.2;

      if (score < bestScore) {
        bestScore = score;
        bestToken = token;
        bestUnit = tokenUnit;
      }
    }

    return bestToken
      ? {
          token: bestToken,
          unit: bestUnit,
          center,
          tokenRect: bestToken.getBoundingClientRect(),
        }
      : null;
  }

  updateFloaterObstacle(floater) {
    const match = this.findNearestToken(floater);
    if (!match) {
      return;
    }

    let obstacle = this.floaterObstacles.get(floater.id);
    if (!obstacle) {
      obstacle = document.createElement("span");
      this.floaterObstacles.set(floater.id, obstacle);
    }

    const size = Math.round(FLOATER_KINDS[floater.kind].size * 1.06);
    const side = this.getObstacleSide(match.center.x, match.unit);
    const tokenCenterY = match.tokenRect.top + match.tokenRect.height / 2;
    const verticalOffset = clamp(match.center.y - tokenCenterY, -size * 0.42, size * 0.42);
    const signature = `${side}:${Math.round(verticalOffset / 6)}:${match.token.textContent}`;
    const movedToNewTarget = obstacle.parentNode !== match.token.parentNode || obstacle.nextSibling !== match.token;
    const layoutChanged = obstacle.dataset.signature !== signature;

    obstacle.className = `flow-obstacle flow-obstacle--${floater.kind}`;
    obstacle.dataset.side = side;
    obstacle.dataset.signature = signature;
    obstacle.style.width = `${size}px`;
    obstacle.style.height = `${size}px`;
    obstacle.style.marginTop = `${Math.round(verticalOffset)}px`;
    obstacle.style.shapeOutside = getObstacleShape(floater.kind, size);
    obstacle.style.webkitShapeOutside = obstacle.style.shapeOutside;

    if (movedToNewTarget) {
      match.token.parentNode.insertBefore(obstacle, match.token);
    }

    if (movedToNewTarget || layoutChanged) {
      this.scheduleSolve();
    }
  }

  removeFloaterObstacle(floaterId) {
    const obstacle = this.floaterObstacles.get(floaterId);
    if (!obstacle) {
      return;
    }

    obstacle.remove();
    this.floaterObstacles.delete(floaterId);
    this.scheduleSolve();
  }

  getFloaterObstacleRect(floaterId) {
    const obstacle = this.floaterObstacles.get(floaterId);
    if (!obstacle || !obstacle.isConnected) {
      return null;
    }

    return obstacle.getBoundingClientRect();
  }

  measureAnchor(anchorState, height) {
    anchorState.soak.style.setProperty("--size", `${height}px`);
    const flowRect = this.flow.getBoundingClientRect();
    const tokenRect = anchorState.token.getBoundingClientRect();
    const width = this.getUnitWidth();
    const gap = this.getGap();
    const left = tokenRect.left - flowRect.left;
    const unit = Math.max(1, Math.floor(left / (width + gap)) + 1);
    const top = tokenRect.top - flowRect.top;
    return { unit, top, height };
  }

  score(result, targetUnit) {
    if (result.unit !== targetUnit) {
      return 10000 + Math.abs(result.unit - targetUnit) * 1000 + result.top;
    }
    return Math.abs(result.top - 6);
  }

  findHeightForTarget(anchorState) {
    const targetUnit = anchorState.config.targetUnit;
    let low = this.baseHeight;
    let high = this.baseHeight;
    let sample = this.measureAnchor(anchorState, high);
    let guard = 0;

    while (sample.unit < targetUnit && high < this.maxHeight && guard < 16) {
      low = high;
      high = Math.round(high * 1.7 + 18);
      sample = this.measureAnchor(anchorState, high);
      guard += 1;
    }

    if (sample.unit < targetUnit) {
      return sample;
    }

    for (let index = 0; index < 20; index += 1) {
      const mid = (low + high) / 2;
      const probe = this.measureAnchor(anchorState, mid);
      if (probe.unit >= targetUnit) {
        high = mid;
      } else {
        low = mid;
      }
    }

    let best = this.measureAnchor(anchorState, high);
    let bestScore = this.score(best, targetUnit);

    for (let offset = -26; offset <= 80; offset += 2) {
      const nextHeight = Math.max(this.baseHeight, high + offset);
      const probe = this.measureAnchor(anchorState, nextHeight);
      const probeScore = this.score(probe, targetUnit);
      if (probeScore < bestScore) {
        best = probe;
        bestScore = probeScore;
      }
    }

    return best;
  }

  solve() {
    this.lastSolveAt = performance.now();
    for (const anchor of this.anchorConfigs) {
      const state = this.anchorState.get(anchor.id);
      if (!state) {
        continue;
      }
      state.soak.style.setProperty("--size", `${this.baseHeight}px`);
      state.height = this.baseHeight;
      state.token.classList.remove("is-targeted", "is-unlocked");
    }

    const activeAnchors = this.anchorConfigs
      .filter((anchor) => anchor.enabled && anchor.targetUnit <= this.unitCount)
      .sort((left, right) => left.targetUnit - right.targetUnit);

    for (const anchor of activeAnchors) {
      const state = this.anchorState.get(anchor.id);
      const result = this.findHeightForTarget(state);
      state.height = result.height;
      state.result = result;
      state.soak.style.setProperty("--size", `${result.height}px`);
      state.token.classList.add("is-targeted");
    }

    for (const anchor of this.anchorConfigs) {
      const state = this.anchorState.get(anchor.id);
      const card = this.controlsRoot.querySelector(`[data-anchor-id="${anchor.id}"]`);
      if (!state || !card) {
        continue;
      }

      const button = card.querySelector(".soak-toggle");
      const meta = card.querySelector('[data-role="meta"]');
      const available = anchor.targetUnit <= this.unitCount;

      button.disabled = !available;
      button.classList.toggle("is-active", anchor.enabled && available);
      button.textContent = available
        ? `${anchor.enabled ? "Unlock" : "Lock"} ${this.unitLabel} ${anchor.targetUnit}`
        : `${this.unitLabel} ${anchor.targetUnit} unavailable`;

      const currentResult = this.measureAnchor(state, state.height);
      state.result = currentResult;
      const aligned = currentResult.unit === anchor.targetUnit && Math.abs(currentResult.top - 6) < 18;
      state.token.classList.toggle("is-unlocked", !anchor.enabled || !available);

      if (!available) {
        meta.textContent = "Not active in this width";
      } else if (currentResult.unit > this.unitCount) {
        meta.textContent = `${Math.round(state.height)}px reserve, overflowed past ${this.unitLabel} ${this.unitCount}`;
      } else if (!anchor.enabled) {
        meta.textContent = `${Math.round(state.height)}px reserve on standby`;
      } else {
        meta.textContent = aligned
          ? `${Math.round(state.height)}px reserve, aligned`
          : `${Math.round(state.height)}px reserve, settling`;
      }
    }

    if (this.summary) {
      const enabledCount = activeAnchors.length;
      const unitWord = this.unitCount === 1 ? this.unitLabel : `${this.unitLabel}s`;
      this.summary.textContent = `${this.unitCount} ${unitWord} active, ${enabledCount} soak lock${enabledCount === 1 ? "" : "s"} engaged`;
    }
  }
}

class FloatingOrnaments {
  constructor(config) {
    this.paletteRoot = config.paletteRoot;
    this.stages = config.stages;
    this.floaters = [];
    this.dragState = null;
    this.dragProxy = null;
    this.lastTime = performance.now();
    this.installPalette();
    this.installGlobalListeners();
    this.seed();
    requestAnimationFrame((time) => this.tick(time));
  }

  installPalette() {
    const items = this.paletteRoot.querySelectorAll("[data-kind]");
    for (const item of items) {
      item.addEventListener("pointerdown", (event) => this.beginPaletteDrag(event, item.dataset.kind));
    }
  }

  installGlobalListeners() {
    document.addEventListener("pointermove", (event) => this.onPointerMove(event));
    document.addEventListener("pointerup", (event) => this.onPointerUp(event));
  }

  getStageById(stageId) {
    return this.stages.find((entry) => entry.id === stageId) || null;
  }

  createDragProxy(kind) {
    if (this.dragProxy) {
      this.dragProxy.remove();
    }
    const proxy = document.createElement("div");
    proxy.className = "drag-proxy";
    proxy.innerHTML = `<div class="floater floater--${kind}">${FLOATER_KINDS[kind].html}</div>`;
    document.body.append(proxy);
    this.dragProxy = proxy;
    return proxy;
  }

  beginPaletteDrag(event, kind) {
    event.preventDefault();
    const proxy = this.createDragProxy(kind);
    this.dragState = { type: "new", kind };
    proxy.style.left = `${event.clientX}px`;
    proxy.style.top = `${event.clientY}px`;
  }

  beginFloaterDrag(event, floater) {
    event.preventDefault();
    floater.dragging = true;
    floater.element.classList.add("is-dragging");
    floater.vx = 0;
    floater.vy = 0;
    this.dragState = {
      type: "existing",
      floater,
      offsetX: event.clientX - floater.bounds.left - floater.x,
      offsetY: event.clientY - floater.bounds.top - floater.y,
    };
  }

  getStageAt(clientX, clientY) {
    for (const stage of this.stages) {
      const rect = stage.layer.getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return { ...stage, rect };
      }
    }
    return null;
  }

  spawn(kind, stageId, x, y, options = {}) {
    const stage = this.getStageById(stageId);
    if (!stage) {
      return null;
    }

    const floater = {
      id: `floater-${Math.random().toString(36).slice(2, 10)}`,
      kind,
      stageId,
      x,
      y,
      angle: randomBetween(-14, 14),
      spin: randomBetween(-34, 34),
      vx: options.vx ?? randomBetween(-82, 82),
      vy: options.vy ?? randomBetween(-58, 58),
      wobble: randomBetween(-0.8, 0.8),
      dragging: false,
    };

    const element = document.createElement("button");
    element.type = "button";
    element.className = `floater floater--${kind}`;
    element.innerHTML = FLOATER_KINDS[kind].html;
    element.style.width = `${FLOATER_KINDS[kind].size}px`;
    element.style.height = `${FLOATER_KINDS[kind].size}px`;
    element.addEventListener("pointerdown", (event) => this.beginFloaterDrag(event, floater));

    floater.element = element;
    stage.layer.append(element);
    this.floaters.push(floater);
    this.placeFloater(floater);
    this.syncFloaterWithScene(floater, true);
    return floater;
  }

  placeFloater(floater) {
    const stage = this.getStageById(floater.stageId);
    if (!stage) {
      return;
    }

    const rect = stage.layer.getBoundingClientRect();
    floater.bounds = rect;

    let renderX = floater.x;
    let renderY = floater.y;

    if (!floater.dragging && stage.scene) {
      const obstacleRect = stage.scene.getFloaterObstacleRect(floater.id);
      if (obstacleRect) {
        renderX =
          obstacleRect.left -
          rect.left +
          (obstacleRect.width - floater.element.offsetWidth) / 2;
        renderY =
          obstacleRect.top -
          rect.top +
          (obstacleRect.height - floater.element.offsetHeight) / 2;
      }
    }

    floater.renderX = renderX;
    floater.renderY = renderY;
    floater.element.style.transform = `translate(${renderX}px, ${renderY}px) rotate(${floater.angle}deg)`;
  }

  seed() {
    this.spawn("star", "ad", 80, 84, { vx: 70, vy: 56 });
    this.spawn("moon", "ad", 260, 160, { vx: -62, vy: 48 });
    this.spawn("hammer", "ad", 520, 88, { vx: -38, vy: 78 });
    this.spawn("spark", "paper", 120, 120, { vx: 62, vy: 44 });
    this.spawn("moon", "paper", 540, 210, { vx: -58, vy: 38 });
  }

  nudgeAll(stageId) {
    for (const floater of this.floaters) {
      if (!stageId || floater.stageId === stageId) {
        floater.vx += randomBetween(-110, 110);
        floater.vy += randomBetween(-90, 90);
      }
    }
  }

  syncFloaterWithScene(floater, force = false) {
    const stage = this.getStageById(floater.stageId);
    if (!stage || !stage.scene) {
      return;
    }

    const movedEnough =
      !floater.lastObstacleSync ||
      floater.lastObstacleSync.stageId !== floater.stageId ||
      Math.hypot(floater.lastObstacleSync.x - floater.x, floater.lastObstacleSync.y - floater.y) > 14;

    if (!force && !movedEnough) {
      return;
    }

    stage.scene.updateFloaterObstacle(floater);
    floater.lastObstacleSync = { x: floater.x, y: floater.y, stageId: floater.stageId };
  }

  onPointerMove(event) {
    if (!this.dragState) {
      return;
    }

    if (this.dragProxy) {
      this.dragProxy.style.left = `${event.clientX}px`;
      this.dragProxy.style.top = `${event.clientY}px`;
    }

    if (this.dragState.type !== "existing") {
      return;
    }

    const match = this.getStageAt(event.clientX, event.clientY);
    const floater = this.dragState.floater;
    if (!match) {
      return;
    }

    if (floater.stageId !== match.id) {
      const previousStage = this.getStageById(floater.stageId);
      previousStage?.scene?.removeFloaterObstacle(floater.id);
      const nextStage = this.getStageById(match.id);
      nextStage.layer.append(floater.element);
      floater.stageId = match.id;
    }

    floater.bounds = match.rect;
    const width = floater.element.offsetWidth;
    const height = floater.element.offsetHeight;
    floater.x = clamp(event.clientX - match.rect.left - this.dragState.offsetX, 0, match.rect.width - width);
    floater.y = clamp(event.clientY - match.rect.top - this.dragState.offsetY, 0, match.rect.height - height);
    floater.angle = clamp(floater.angle + randomBetween(-1.2, 1.2), -18, 18);
    this.placeFloater(floater);
    this.syncFloaterWithScene(floater, true);
  }

  onPointerUp(event) {
    if (!this.dragState) {
      return;
    }

    if (this.dragState.type === "new") {
      const match = this.getStageAt(event.clientX, event.clientY);
      if (match) {
        const size = FLOATER_KINDS[this.dragState.kind].size;
        this.spawn(
          this.dragState.kind,
          match.id,
          clamp(event.clientX - match.rect.left - size / 2, 0, match.rect.width - size),
          clamp(event.clientY - match.rect.top - size / 2, 0, match.rect.height - size),
        );
      }
    }

    if (this.dragState.type === "existing") {
      const floater = this.dragState.floater;
      floater.dragging = false;
      floater.element.classList.remove("is-dragging");
      floater.vx = randomBetween(-96, 96);
      floater.vy = randomBetween(-84, 84);
      this.syncFloaterWithScene(floater, true);
    }

    if (this.dragProxy) {
      this.dragProxy.remove();
      this.dragProxy = null;
    }

    this.dragState = null;
  }

  tick(time) {
    const delta = Math.min(0.032, (time - this.lastTime) / 1000 || 0.016);
    this.lastTime = time;

    for (const floater of this.floaters) {
      if (floater.dragging) {
        continue;
      }

      const stage = this.getStageById(floater.stageId);
      if (!stage) {
        continue;
      }

      const rect = stage.layer.getBoundingClientRect();
      const width = floater.element.offsetWidth;
      const height = floater.element.offsetHeight;
      floater.bounds = rect;

      floater.vx += Math.sin(time / 800 + floater.wobble) * 1.4;
      floater.vy += Math.cos(time / 920 + floater.wobble) * 1.2;
      floater.vx = clamp(floater.vx, -140, 140);
      floater.vy = clamp(floater.vy, -120, 120);
      floater.x += floater.vx * delta;
      floater.y += floater.vy * delta;
      floater.angle += floater.spin * delta;

      if (floater.x <= 0) {
        floater.x = 0;
        floater.vx = Math.abs(floater.vx);
      }
      if (floater.x >= rect.width - width) {
        floater.x = rect.width - width;
        floater.vx = -Math.abs(floater.vx);
      }
      if (floater.y <= 0) {
        floater.y = 0;
        floater.vy = Math.abs(floater.vy);
      }
      if (floater.y >= rect.height - height) {
        floater.y = rect.height - height;
        floater.vy = -Math.abs(floater.vy);
      }

      this.placeFloater(floater);
      this.syncFloaterWithScene(floater);
    }

    requestAnimationFrame((nextTime) => this.tick(nextTime));
  }
}

const adScene = new SoakScene({
  flow: document.getElementById("adFlow"),
  guideRoot: document.getElementById("adGuides"),
  summary: document.getElementById("columnSummary"),
  controlsRoot: document.getElementById("adAnchorControls"),
  unitLabel: "column",
  initialUnitCount: 4,
  maxUnitCount: 4,
  baseHeight: 18,
  maxHeight: 1500,
  paragraphs: AD_PARAGRAPHS,
  anchors: [
    {
      id: "col2",
      wordLabel: "Runner",
      targetUnit: 2,
      soakLabel: "Orbit Soak",
      variant: "soak-orbit",
      enabled: true,
    },
    {
      id: "col3",
      wordLabel: "Hammer",
      targetUnit: 3,
      soakLabel: "Ribbon Soak",
      variant: "soak-ribbon",
      enabled: true,
    },
    {
      id: "col4",
      wordLabel: "Macintosh",
      targetUnit: 4,
      soakLabel: "Eclipse Soak",
      variant: "soak-eclipse",
      enabled: true,
    },
  ],
});

const paperScene = new SoakScene({
  flow: document.getElementById("paperFlow"),
  controlsRoot: document.getElementById("paperAnchorControls"),
  unitLabel: "page",
  initialUnitCount: 3,
  maxUnitCount: 3,
  baseHeight: 16,
  maxHeight: 1600,
  paragraphs: PAPER_PARAGRAPHS,
  anchors: [
    {
      id: "page2",
      wordLabel: "Lemma II.",
      targetUnit: 2,
      soakLabel: "Lemma Reserve",
      variant: "soak-lemma",
      enabled: true,
    },
    {
      id: "page3",
      wordLabel: "Lemma III.",
      targetUnit: 3,
      soakLabel: "Final Reservoir",
      variant: "soak-ribbon",
      enabled: true,
    },
  ],
});

const floaters = new FloatingOrnaments({
  paletteRoot: document.getElementById("floaterPalette"),
  stages: [
    { id: "ad", layer: document.getElementById("adMotion"), scene: adScene },
    { id: "paper", layer: document.getElementById("paperMotion"), scene: paperScene },
  ],
});

for (const button of document.querySelectorAll("#columnSelector .segment")) {
  button.addEventListener("click", () => {
    const nextCount = Number(button.dataset.columns);
    document.querySelectorAll("#columnSelector .segment").forEach((segment) => {
      segment.classList.toggle("is-active", segment === button);
    });
    adScene.setUnitCount(nextCount);
  });
}

document.getElementById("skylineToggle").addEventListener("click", (event) => {
  const shell = document.getElementById("adStageShell");
  const enabled = shell.dataset.skyline !== "off";
  shell.dataset.skyline = enabled ? "off" : "on";
  event.currentTarget.textContent = `Skyline Motion: ${enabled ? "Off" : "On"}`;
});

document.getElementById("paperJolt").addEventListener("click", () => {
  floaters.nudgeAll("paper");
});
