#!/usr/bin/env python3
"""
Replay Cursor agent tools from transcript JSONL in original order until the
pretrained eyebink / eyeOpennessMl patches (exclusive).

Also fixes patch order quirks: inserts getLiveFlags() before fmt() when helper
would have been patched between `type Phase` and `fmt` but AlarmController is
actually there.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRANSCRIPT = Path.home() / (
    ".cursor/projects/Users-kirkrodenc-pacanan-Documents-GitHub-StudyTime/"
    "agent-transcripts/0d3c3b02-1f63-4289-8e21-e1e74c55eefa/"
    "0d3c3b02-1f63-4289-8e21-e1e74c55eefa.jsonl"
)

# From transcript ApplyPatch transcript line @ session page (minus leading + lines)
_SESSION_GET_LIVE_FLAGS = '''function getLiveFlags(sample: FocusFrameResult): {
  flags?: {
    phoneDetected?: boolean;
    eyesClosed?: boolean;
    lookingAway?: boolean;
    headDown?: boolean;
    drowsy?: boolean;
    hasFace?: boolean;
  };
  durations?: {
    eyesClosedMs?: number;
    lookingAwayMs?: number;
    headDownMs?: number;
    phoneDetectedMs?: number;
    engagedMs?: number;
  };
} {
  const any = sample as FocusFrameResult & {
    flags?: unknown;
    durations?: unknown;
  };
  return {
    flags: (any.flags as any) ?? undefined,
    durations: (any.durations as any) ?? undefined,
  };
}'''


def abort(msg: str) -> None:
    print("ERROR:", msg, file=sys.stderr)
    sys.exit(1)


def rel_under_root(abs_path: str) -> Path:
    p = Path(abs_path).resolve()
    try:
        return p.relative_to(ROOT.resolve())
    except ValueError:
        abort(f"Path outside repo: {abs_path}")


def find_transcript_stop_line(raw_lines: list[str]) -> int:
    """First JSON line containing ApplyPatch that wires eyeOpennessMl pretrained path."""
    for i, ln in enumerate(raw_lines):
        if '"ApplyPatch"' not in ln:
            continue
        if "eyeOpennessMl" in ln:
            return i
    return len(raw_lines)


def parse_apply_patch(patch: str) -> list[tuple[str, Path, list[str]]]:
    if not patch.strip().startswith("*** Begin Patch"):
        abort("Not a Begin Patch")
    segments: list[tuple[str, Path, list[str]]] = []
    lines = patch.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("*** Begin Patch"):
            i += 1
            continue
        if line.startswith("*** End Patch"):
            break
        if line.startswith("*** Add File:"):
            rel = line.split(":", 1)[1].strip()
            path = ROOT / rel_under_root(rel)
            i += 1
            chunk: list[str] = []
            while i < len(lines) and not lines[i].startswith("***"):
                chunk.append(lines[i])
                i += 1
            segments.append(("add", path, chunk))
            continue
        if line.startswith("*** Update File:"):
            rel = line.split(":", 1)[1].strip()
            path = ROOT / rel_under_root(rel)
            i += 1
            chunk: list[str] = []
            while i < len(lines) and not lines[i].startswith("***"):
                chunk.append(lines[i])
                i += 1
            segments.append(("update", path, chunk))
            continue
        i += 1
    return segments


def finish_add(lines: list[str]) -> list[str]:
    out: list[str] = []
    for ln in lines:
        if ln.startswith("+"):
            out.append(ln[1:])
        elif ln.startswith("\\"):
            out.append(ln)
        elif ln == "":
            out.append("")
    while out and out[-1] == "":
        out.pop()
    return out


def split_update_hunks(chunk: list[str]) -> list[list[str]]:
    hunks: list[list[str]] = []
    cur: list[str] = []
    for ln in chunk:
        ln = ln.rstrip("\r")
        if ln.strip() == "@@":
            if cur:
                hunks.append(cur)
            cur = []
            continue
        cur.append(ln)
    if cur:
        hunks.append(cur)
    return hunks


def apply_hunk_to_lines(file_lines: list[str], hunk: list[str]) -> list[str]:
    old: list[str] = []
    new: list[str] = []
    for ln in hunk:
        ln = ln.rstrip("\r")
        if ln == "":
            abort("Empty line in hunk (ambiguous); fix transcript chunking")
        c = ln[0]
        rest = ln[1:]
        if c == " ":
            old.append(rest)
            new.append(rest)
        elif c == "-":
            old.append(rest)
        elif c == "+":
            new.append(rest)
        else:
            abort(f"Bad hunk line first char {c!r}: {ln!r}")

    olen = len(old)
    n = len(file_lines)
    for start in range(0, max(1, n - olen + 1)):
        if file_lines[start : start + olen] == old:
            return file_lines[:start] + new + file_lines[start + olen :]
    snippet = "\n".join(old[:8])
    raise ValueError(f"Hunk mismatch; expected:\n{snippet}\n...")


def ensure_get_live_flags_page(path: Path) -> None:
    t = path.read_text(encoding="utf-8")
    if "function getLiveFlags" in t:
        return
    needle = "function fmt(sec: number) {"
    ix = t.find(needle)
    if ix == -1:
        abort(f"Cannot insert getLiveFlags: missing {needle!r} in session page")
    t = t[:ix] + _SESSION_GET_LIVE_FLAGS + "\n\n" + t[ix:]
    path.write_text(t, encoding="utf-8")


def apply_update(path: Path, chunk: list[str]) -> None:
    text = path.read_text(encoding="utf-8")
    file_lines = text.split("\n")
    hunks = split_update_hunks(chunk)

    if "session/page.tsx" in path.as_posix() and hunks:
        joined_h0 = "\n".join(hunks[0])
        if "+function getLiveFlags" in joined_h0:
            ensure_get_live_flags_page(path)
            file_lines = path.read_text(encoding="utf-8").split("\n")
            hunks = hunks[1:]

    for h in hunks:
        file_lines = apply_hunk_to_lines(file_lines, h)

    out = "\n".join(file_lines)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(out + ("\n" if out and not out.endswith("\n") else ""), encoding="utf-8")


def apply_add(path: Path, chunk: list[str]) -> None:
    lines = finish_add(chunk)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def apply_str_replace_try(path_abs: str, old: str, new: str) -> None:
    path = Path(path_abs).expanduser().resolve()
    rr = ROOT.resolve()
    try:
        path.relative_to(rr)
    except ValueError:
        print("SKIP StrReplace outside repo", path)
        return
    if not path.exists():
        print("SKIP missing", path)
        return
    txt = path.read_text(encoding="utf-8")
    if old not in txt:
        print("WARN skip StrReplace (old not found):", path.relative_to(rr))
        return
    path.write_text(txt.replace(old, new, 1), encoding="utf-8")
    print("StrReplace", path.relative_to(rr))


def apply_write_try(path_abs: str, contents: str) -> None:
    """Skip pretrained-era helper files."""
    low = path_abs.lower()
    if "focus-constants.ts" in low:
        print("SKIP Write (post-cut):", path_abs)
        return
    path = Path(path_abs).expanduser().resolve()
    rr = ROOT.resolve()
    rp = path.relative_to(rr)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(contents, encoding="utf-8")
    print("Write", rp)


def replay() -> None:
    if not TRANSCRIPT.is_file():
        abort(f"Missing transcript file: {TRANSCRIPT}")

    raw_lines = TRANSCRIPT.read_text(encoding="utf-8").splitlines()
    stop_idx = find_transcript_stop_line(raw_lines)
    print(f"Transcript lines: {len(raw_lines)}; replay up to exclusive index {stop_idx}")

    for line_idx, raw in enumerate(raw_lines):
        if line_idx >= stop_idx:
            break
        try:
            o = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if o.get("role") != "assistant":
            continue
        for c in o.get("message", {}).get("content", []):
            if c.get("type") != "tool_use":
                continue
            name = c.get("name")
            if name == "ApplyPatch":
                patch = c.get("input", "")
                if "StudyTime" not in patch and "/GitHub/StudyTime" not in patch:
                    continue
                rp_session = ROOT / "app/(app)/session/page.tsx"
                stxt = rp_session.read_text(encoding="utf-8") if rp_session.exists() else ""
                if (
                    "session/page.tsx" in patch
                    and "+function getLiveFlags" in patch
                    and "function getLiveFlags" in stxt
                ):
                    print("SKIP duplicate getLiveFlags ApplyPatch")
                    continue
                if (
                    "session/page.tsx" in patch
                    and "phoneDetectionEnabled" in patch
                    and "phoneDetectionEnabled" in stxt
                ):
                    print("SKIP duplicate phoneDetection session patch")
                    continue
                if (
                    "session/page.tsx" in patch
                    and "phoneDetectionEnabled={phoneDetectionEnabled}" in patch
                    and "phoneDetectionEnabled={phoneDetectionEnabled}" in stxt
                ):
                    print("SKIP duplicate FocusCamera props patch")
                    continue
                if (
                    "session/page.tsx" in patch
                    and "<Badge" in patch
                    and "getLiveFlags(lastSample)" in patch
                    and "getLiveFlags(lastSample)" in stxt
                ):
                    print("SKIP duplicate Live focus Badge ApplyPatch")
                    continue
                for kind, path, chunk in parse_apply_patch(patch):
                    rp = path
                    print(kind, rp.relative_to(ROOT))
                    if kind == "add":
                        apply_add(rp, chunk)
                    else:
                        apply_update(rp, chunk)
            elif name == "StrReplace":
                inp = c.get("input") or {}
                p = inp.get("path") or ""
                if "StudyTime" not in p:
                    continue
                apply_str_replace_try(p, inp.get("old_string", ""), inp.get("new_string", ""))
            elif name == "Write":
                inp = c.get("input") or {}
                p = inp.get("path") or ""
                if "StudyTime" not in p:
                    continue
                apply_write_try(p, inp.get("contents", ""))


def main() -> None:
    os.chdir(ROOT)
    replay()


if __name__ == "__main__":
    main()
    print("Done.")
