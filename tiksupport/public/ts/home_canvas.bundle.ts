const scene = document.querySelector<HTMLElement>(".tiksupport-home-scene");
const home = document.querySelector<HTMLElement>(".tiksupport-home");
const canvas = document.querySelector<HTMLCanvasElement>(".home-canvas");
const context = canvas?.getContext("2d");

if (scene && home && canvas && context) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  const navbar = document.querySelector<HTMLElement>(".tiksupport-navbar");
  const footer = document.querySelector<HTMLElement>("#ticket-footer");
  let width = 0;
  let height = 0;
  let animationFrame = 0;
  let lastFrame = 0;
  let isVisible = true;

  function themeColor(variable: string, fallback: string): string {
    const previousColor = canvas.style.color;
    canvas.style.color = `var(${variable}, ${fallback})`;
    const color = window.getComputedStyle(canvas).color;
    canvas.style.color = previousColor;
    return color || fallback;
  }

  const brand = themeColor("--brand-color", "#2c6e9e");
  const accent = themeColor("--secondary-color", "#cc9933");
  const ink = themeColor("--heading-color", "#132238");

  interface Zone {
    top: number;
    height: number;
  }

  const fallbackZone: Zone = { top: 0, height: window.innerHeight };
  let heroZone: Zone = fallbackZone;
  let pathZone: Zone = fallbackZone;
  let kbZone: Zone = fallbackZone;

  function zoneFor(el: Element | null): Zone | null {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    return { top: rect.top - canvasRect.top, height: rect.height };
  }

  function captureZones() {
    heroZone = zoneFor(home.querySelector(".hero")) || fallbackZone;
    pathZone = zoneFor(home.querySelector(".path")) || fallbackZone;
    kbZone = zoneFor(home.querySelector(".top-knowledge-base-list")) || fallbackZone;
  }

  function roundedRect(
    x: number,
    y: number,
    rectWidth: number,
    rectHeight: number,
    radius: number,
  ) {
    const r = Math.min(radius, rectWidth / 2, rectHeight / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + rectWidth, y, x + rectWidth, y + rectHeight, r);
    context.arcTo(x + rectWidth, y + rectHeight, x, y + rectHeight, r);
    context.arcTo(x, y + rectHeight, x, y, r);
    context.arcTo(x, y, x + rectWidth, y, r);
    context.closePath();
  }

  function drawTicket(
    x: number,
    y: number,
    ticketWidth: number,
    angle: number,
    opacity = 0.62,
  ) {
    const ticketHeight = ticketWidth * 0.62;
    context.save();
    context.translate(x, y);
    context.rotate(angle);

    roundedRect(-ticketWidth / 2, -ticketHeight / 2, ticketWidth, ticketHeight, 13);
    context.globalAlpha = 0.3 * opacity;
    context.fillStyle = "#ffffff";
    context.fill();
    context.globalAlpha = 0.3 * opacity;
    context.strokeStyle = brand;
    context.lineWidth = 1.4;
    context.stroke();

    context.globalAlpha = 0.62 * opacity;
    context.fillStyle = accent;
    context.beginPath();
    context.arc(-ticketWidth * 0.34, -ticketHeight * 0.2, ticketWidth * 0.07, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = 0.3 * opacity;
    context.strokeStyle = ink;
    context.lineWidth = 2.4;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(-ticketWidth * 0.2, -ticketHeight * 0.2);
    context.lineTo(ticketWidth * 0.3, -ticketHeight * 0.2);
    context.moveTo(-ticketWidth * 0.34, ticketHeight * 0.08);
    context.lineTo(ticketWidth * 0.34, ticketHeight * 0.08);
    context.moveTo(-ticketWidth * 0.34, ticketHeight * 0.25);
    context.lineTo(ticketWidth * 0.12, ticketHeight * 0.25);
    context.stroke();

    context.globalAlpha = 0.62 * opacity;
    context.fillStyle = brand;
    context.beginPath();
    context.arc(ticketWidth * 0.34, ticketHeight * 0.31, 4, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawChatBubble(x: number, y: number, size: number) {
    const bubbleWidth = size;
    const bubbleHeight = size * 0.62;
    context.save();
    context.globalAlpha = 0.2;
    context.strokeStyle = brand;
    context.lineWidth = 1.6;
    roundedRect(x, y, bubbleWidth, bubbleHeight, 14);
    context.stroke();

    context.globalAlpha = 0.16;
    context.fillStyle = "#ffffff";
    context.fill();

    context.beginPath();
    context.moveTo(x + bubbleWidth * 0.25, y + bubbleHeight);
    context.lineTo(x + bubbleWidth * 0.18, y + bubbleHeight + 10);
    context.lineTo(x + bubbleWidth * 0.42, y + bubbleHeight);
    context.stroke();

    context.fillStyle = accent;
    context.globalAlpha = 0.72;
    for (let index = 0; index < 3; index += 1) {
      context.beginPath();
      context.arc(
        x + bubbleWidth * (0.35 + index * 0.16),
        y + bubbleHeight * 0.51,
        3,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    context.restore();
  }

  function drawSignalNode(x: number, y: number, radius: number) {
    context.save();
    context.globalAlpha = 0.14;
    context.strokeStyle = brand;
    context.lineWidth = 1;
    context.beginPath();
    context.arc(x, y, radius * 2.8, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 0.2;
    context.beginPath();
    context.arc(x, y, radius * 1.8, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 0.75;
    context.fillStyle = accent;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function pointOnCurve(
    progress: number,
    startX: number,
    startY: number,
    controlX1: number,
    controlY1: number,
    controlX2: number,
    controlY2: number,
    endX: number,
    endY: number,
  ) {
    const inverse = 1 - progress;
    return {
      x:
        inverse ** 3 * startX +
        3 * inverse ** 2 * progress * controlX1 +
        3 * inverse * progress ** 2 * controlX2 +
        progress ** 3 * endX,
      y:
        inverse ** 3 * startY +
        3 * inverse ** 2 * progress * controlY1 +
        3 * inverse * progress ** 2 * controlY2 +
        progress ** 3 * endY,
    };
  }

  function drawAnimatedBubbles(
    startX: number,
    startY: number,
    controlX1: number,
    controlY1: number,
    controlX2: number,
    controlY2: number,
    endX: number,
    endY: number,
    time: number,
    phase: number,
  ) {
    for (let index = 0; index < 3; index += 1) {
      const progress = reducedMotion.matches
        ? (index + 1) / 4
        : ((time / 18000 + index / 3 + phase) % 1 + 1) % 1;
      const point = pointOnCurve(
        progress,
        startX,
        startY,
        controlX1,
        controlY1,
        controlX2,
        controlY2,
        endX,
        endY,
      );
      const radius = index === 1 ? 4.5 : 3.5;

      context.save();
      context.globalAlpha = 0.24;
      context.fillStyle = "#ffffff";
      context.strokeStyle = brand;
      context.lineWidth = 1.2;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();

      context.globalAlpha = 0.38;
      context.fillStyle = index === 1 ? accent : brand;
      context.beginPath();
      context.arc(point.x, point.y, 1.5, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function draw(time: number) {
    context.clearRect(0, 0, width, height);

    for (let x = 28; x < width; x += 58) {
      for (let y = 28; y < height; y += 58) {
        context.globalAlpha = 0.09;
        context.fillStyle = brand;
        context.beginPath();
        context.arc(x, y, 1.25, 0, Math.PI * 2);
        context.fill();
      }
    }

    drawAnimatedBubbles(
      0,
      heroZone.top + heroZone.height * 0.24,
      width * 0.28,
      heroZone.top + heroZone.height * 0.12,
      width * 0.61,
      heroZone.top + heroZone.height * 0.4,
      width,
      heroZone.top + heroZone.height * 0.2,
      time,
      0,
    );
    drawAnimatedBubbles(
      0,
      pathZone.top + pathZone.height * 0.38,
      width * 0.3,
      pathZone.top + pathZone.height * 0.2,
      width * 0.68,
      pathZone.top + pathZone.height * 0.58,
      width,
      pathZone.top + pathZone.height * 0.35,
      time,
      0.36,
    );
    drawAnimatedBubbles(
      0,
      kbZone.top + kbZone.height * 0.28,
      width * 0.32,
      kbZone.top + kbZone.height * 0.12,
      width * 0.72,
      kbZone.top + kbZone.height * 0.45,
      width,
      kbZone.top + kbZone.height * 0.3,
      time,
      0.68,
    );

    drawSignalNode(width * 0.08, heroZone.top + heroZone.height * 0.3, 3.5);
    drawSignalNode(width * 0.92, pathZone.top + pathZone.height * 0.48, 3.5);
    drawSignalNode(width * 0.1, kbZone.top + kbZone.height * 0.7, 3.5);

    if (width <= 640) {
      drawSignalNode(width * 0.9, kbZone.top + kbZone.height * 0.8, 3);
    }

    const topCardScale = Math.min(1, Math.max(0.72, width / 1100));
    const topCardWidth = Math.min(184, Math.max(width < 640 ? 52 : 112, width * 0.12));
    const topBubbleSize = Math.min(86, Math.max(width < 640 ? 44 : 68, width * 0.075));
    const topCardY = Math.max(96, heroZone.top - 155 * topCardScale);
    drawTicket(width * 0.2, topCardY + 9 * topCardScale, topCardWidth, -0.06, 0.3);
    drawChatBubble(
      width * 0.5 - topBubbleSize / 2,
      topCardY - topBubbleSize * 0.3,
      topBubbleSize,
    );
    drawTicket(width * 0.8, topCardY + 9 * topCardScale, topCardWidth, 0.06, 0.3);
  }

  function resize() {
    const pageBottom = [navbar, home, footer].reduce((bottom, element) => {
      if (!element) return bottom;
      return Math.max(bottom, element.getBoundingClientRect().bottom + window.scrollY);
    }, window.innerHeight);
    width = document.documentElement.clientWidth || window.innerWidth;
    height = pageBottom;
    scene.style.height = `${height}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.ceil(width * pixelRatio);
    canvas.height = Math.ceil(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    captureZones();
    draw(0);
  }

  function stopAnimation() {
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
  }

  function startAnimation() {
    if (reducedMotion.matches || document.hidden || !isVisible || animationFrame) {
      return;
    }

    const animate = (time: number) => {
      if (time - lastFrame >= 1000 / 30) {
        draw(time);
        lastFrame = time;
      }
      animationFrame = window.requestAnimationFrame(animate);
    };
    animationFrame = window.requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("load", resize, { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopAnimation();
    } else {
      startAnimation();
    }
  });
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) {
      stopAnimation();
      draw(0);
    } else {
      startAnimation();
    }
  });

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(home);
  if (footer) {
    resizeObserver.observe(footer);
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      isVisible = entry.isIntersecting;
      if (isVisible) {
        startAnimation();
      } else {
        stopAnimation();
      }
    });
    observer.observe(home);
  }

  resize();
  startAnimation();
}
