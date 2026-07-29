import json
import os
import urllib.request
import base64
import pathlib
import sys

key = os.environ.get("OPENAI_API_KEY")
base = os.environ.get("OPENAI_BASE_URL", "https://tokenx24.com/v1").rstrip("/")
if not key:
    print("missing OPENAI_API_KEY", file=sys.stderr)
    sys.exit(1)

out_dir = pathlib.Path(".impeccable/mocks")
out_dir.mkdir(parents=True, exist_ok=True)

prompts = {
    "comp-a-today-desk.png": """UI product design mock, light modern personal project execution workbench named Clarity.
Desktop app screenshot style (not photo of a laptop). Cool fog grey canvas #F3F5F7, white panels, near-black text, single teal accent #0F766E.
LEFT: clean sidebar with brand mark (teal dot), nav labels 今日 项目 日历, no numbers.
MAIN: Today action desk — 4 compact stats on top, then grouped task lists (overdue / due today / in progress), project progress cards below.
Right drawer slightly open showing a task detail with subtasks checklist and time log.
Premium Linear-like product UI, Chinese labels, high fidelity, crisp, no purple gradients, no gold glow, no dark theme, no 3D mockup frame.""",
    "comp-b-project-board.png": """UI product design mock, Clarity project board screen.
Light modern workbench, cool paper background, white kanban columns (待办 / 进行中 / 已完成), teal accent buttons.
Task cards with priority dots, due dates, subtle project color chips.
Top header with project name, progress, board/list toggle, primary teal "新建任务" button.
Clean Chinese SaaS product UI, dense but breathable, no marketing hero, no glassmorphism overload, no neon.""",
    "comp-c-calendar-empty.png": """UI product design mock, Clarity calendar month view + empty state variant composition.
Left/main: month calendar grid Monday-start, tasks as soft teal-tinted pills on dates, selected day panel on right listing due tasks.
Bottom or secondary panel: elegant empty state for "还没有进行中的项目" with calm illustration of a clean desk notebook and teal accent, primary CTA button.
Light fog background, white cards, Chinese UI, premium minimal product design, no dark mode, no purple AI look.""",
}

for name, prompt in prompts.items():
    print(f"generating {name}...")
    body = json.dumps(
        {
            "model": "gpt-image-2",
            "prompt": prompt,
            "size": "1536x1024",
            "quality": "medium",
            "n": 1,
        }
    ).encode()
    req = urllib.request.Request(
        f"{base}/images/generations",
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        print("FAIL", name, e)
        if hasattr(e, "read"):
            try:
                print(e.read()[:800])
            except Exception:
                pass
        continue

    item = (data.get("data") or [None])[0] or {}
    path = out_dir / name
    if item.get("b64_json"):
        path.write_bytes(base64.b64decode(item["b64_json"]))
        print("OK_B64", path, path.stat().st_size)
    elif item.get("url"):
        with urllib.request.urlopen(item["url"], timeout=120) as img:
            path.write_bytes(img.read())
        print("OK_URL", path, path.stat().st_size)
    else:
        print("UNEXPECTED", name, json.dumps(data)[:500])

print("done")
