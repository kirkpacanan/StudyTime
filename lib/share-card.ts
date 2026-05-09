/** Generate a shareable PNG (Instagram Stories style 9:16-ish). Pure Canvas — no deps. */

export type ShareCardInput = {
  userName: string;
  avatarUrl: string;
  focusScore: number;
  studyMinutes: number;
  monthlyRank: number | null;
  streakDays: number;
  badges: string[];
};

export async function renderShareCardPng(input: ShareCardInput): Promise<Blob> {
  const w = 720;
  const h = 1280;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");

  const grd = ctx.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, "#0f172a");
  grd.addColorStop(0.45, "#1e1b4b");
  grd.addColorStop(1, "#312e81");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  ctx.shadowColor = "rgba(34, 211, 238, 0.5)";
  ctx.shadowBlur = 28;
  ctx.fillStyle = "rgba(34, 211, 238, 0.15)";
  ctx.beginPath();
  ctx.arc(w * 0.82, h * 0.18, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 52px system-ui, sans-serif";
  ctx.fillText("StudyTime", 56, 100);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "28px system-ui, sans-serif";
  ctx.fillText("Focus session complete", 56, 150);

  let avatarImg: HTMLImageElement | null = null;
  try {
    avatarImg = await loadImage(input.avatarUrl);
  } catch {
    // ignore
  }
  const ax = 56;
  const ay = 200;
  const as = 140;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax + as / 2, ay + as / 2, as / 2, 0, Math.PI * 2);
  ctx.clip();
  if (avatarImg) {
    ctx.drawImage(avatarImg, ax, ay, as, as);
  } else {
    ctx.fillStyle = "#475569";
    ctx.fillRect(ax, ay, as, as);
  }
  ctx.restore();
  ctx.strokeStyle = "#22d3ee";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(ax + as / 2, ay + as / 2, as / 2 + 3, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#f1f5f9";
  ctx.font = "bold 42px system-ui, sans-serif";
  ctx.fillText(input.userName, ax + as + 28, ay + 55);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "26px system-ui, sans-serif";
  ctx.fillText("Study session summary", ax + as + 28, ay + 100);

  const cards: { label: string; value: string }[] = [
    { label: "Focus score", value: `${input.focusScore}%` },
    { label: "Study time", value: `${Math.max(1, Math.round(input.studyMinutes))} min` },
    {
      label: "Monthly rank",
      value: input.monthlyRank != null ? `#${input.monthlyRank}` : "—",
    },
    { label: "Streak", value: `${input.streakDays} days` },
  ];

  let cy = 420;
  for (const c of cards) {
    ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
    ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
    ctx.lineWidth = 1;
    roundRect(ctx, 48, cy, w - 96, 100, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "22px system-ui, sans-serif";
    ctx.fillText(c.label, 72, cy + 38);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 34px system-ui, sans-serif";
    ctx.fillText(c.value, 72, cy + 78);
    cy += 118;
  }

  if (input.badges.length) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "22px system-ui, sans-serif";
    ctx.fillText("Achievements", 56, cy + 20);
    cy += 52;
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "24px system-ui, sans-serif";
    let bx = 56;
    for (const b of input.badges.slice(0, 4)) {
      const text = b.length > 22 ? `${b.slice(0, 20)}…` : b;
      ctx.fillStyle = "rgba(34, 211, 238, 0.12)";
      roundRect(ctx, bx, cy, Math.min(320, ctx.measureText(text).width + 36), 44, 12);
      ctx.fill();
      ctx.fillStyle = "#22d3ee";
      ctx.fillText(text, bx + 18, cy + 30);
      bx += 340;
      if (bx > w - 200) {
        bx = 56;
        cy += 56;
      }
    }
  }

  ctx.fillStyle = "#64748b";
  ctx.font = "20px system-ui, sans-serif";
  ctx.fillText("studytime.app · Focus that compounds", 56, h - 56);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("toBlob failed"));
    }, "image/png");
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
