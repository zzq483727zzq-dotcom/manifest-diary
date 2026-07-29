from pathlib import Path
import os
from playwright.sync_api import sync_playwright

base = "http://127.0.0.1:3017"
out = Path(".impeccable/qa")
out.mkdir(parents=True, exist_ok=True)
token_path = Path(os.environ.get("TEMP", "/tmp")) / "clarity.session"
token = token_path.read_text(encoding="utf-8").strip() if token_path.exists() else ""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 1100}, device_scale_factor=1)
    if token:
        context.add_cookies([{
            "name": "manifest-local-session",
            "value": token,
            "domain": "127.0.0.1",
            "path": "/",
        }])
    page = context.new_page()
    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.goto(base + "/", wait_until="networkidle")
    page.screenshot(path=str(out / "today-desktop.png"), full_page=True)
    print("desktop", page.url, page.title(), page.locator("body").inner_text()[:160].replace("\n", " | "))
    print("desktop screenshot", out / "today-desktop.png")
    print("desktop panels", page.locator(".td-panel").count(), "metrics", page.locator(".td-metric").count())
    print("desktop console errors", console_errors)

    mobile_context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
    if token:
        mobile_context.add_cookies([{
            "name": "manifest-local-session",
            "value": token,
            "domain": "127.0.0.1",
            "path": "/",
        }])
    mobile = mobile_context.new_page()
    mobile.goto(base + "/", wait_until="networkidle")
    mobile.screenshot(path=str(out / "today-mobile.png"), full_page=True)
    print("mobile", mobile.url, mobile.title(), mobile.locator("body").inner_text()[:160].replace("\n", " | "))
    print("mobile screenshot", out / "today-mobile.png")
    print("mobile panels", mobile.locator(".td-panel").count(), "mobile nav", mobile.locator(".dashboard-mobile-nav").count())
    mobile_context.close()
    browser.close()
