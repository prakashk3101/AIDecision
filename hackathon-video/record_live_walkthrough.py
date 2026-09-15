import os
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
RAW_DIR = ROOT / "live-raw"
BASE_URL = os.environ.get("DEMO_URL", "http://127.0.0.1:5177/")
TIME_SCALE = float(os.environ.get("LIVE_TIME_SCALE", "0.5"))
EDGE = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
SCENE_DURATIONS = [75, 85, 92, 105, 90, 90, 85, 85, 98, 85, 75, 85, 75, 75]

USE_CASE = (
    "Build an autonomous travel-planning system where specialized agents search flight, hotel, "
    "restaurant, activity, and transport APIs, maintain itinerary state, recover from failures, "
    "and dynamically re-plan based on traveler preferences. Sensitive bookings and payments "
    "require human approval."
)

DEMO_INPUT = {
    "name": "Intelligent Travel Planning",
    "problem": USE_CASE,
    "scale": "Enterprise (50K+ users)",
    "aiRequirement": "Required",
    "latency": "Under 15 seconds",
    "sensitivity": "High / Confidential",
    "monthlyRequests": "1M - 5M",
    "peakRequestsPerMinute": "1,000 - 5,000",
    "cloudPreference": "Azure",
    "regulatoryRequirements": ["GDPR", "SOC 2"],
    "securityRequirements": ["PII Protection", "Private Networking"],
    "existingTechnology": "Microsoft 365, Azure",
    "integrations": "Flight, hotel, maps, payments, weather, and booking APIs",
    "requiresSourceCitations": True,
    "capabilities": ["Multi-agent coordination", "Tool calling", "Dynamic re-planning", "Failure recovery", "Human approval"],
    "workloads": ["Travel search", "Itinerary orchestration", "Grounded recommendation"],
    "assumptions": ["External travel APIs are available", "Booking actions require approval"],
    "signals": {
        "predictiveScoring": False,
        "documentProcessing": False,
        "knowledgeRetrieval": True,
        "generativeResponse": True,
        "toolExecution": True,
        "workflowOrchestration": True,
        "humanReview": True,
        "eventStreaming": False,
        "realTime": False,
    },
    "potentialCompliance": ["GDPR"],
}


def click_nav(page, label: str) -> None:
    page.evaluate(
        "label => [...document.querySelectorAll('nav button')].find(el => el.textContent.includes(label))?.click()",
        label,
    )
    page.wait_for_timeout(350)


def finish_scene(started: float, scene_index: int) -> None:
    target = SCENE_DURATIONS[scene_index] * TIME_SCALE
    remaining = target - (time.monotonic() - started)
    if remaining > 0:
        time.sleep(remaining)


def run() -> Path:
    RAW_DIR.mkdir(exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=str(EDGE), headless=True)
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            record_video_dir=str(RAW_DIR),
            record_video_size={"width": 1440, "height": 900},
        )
        page = context.new_page()
        page.goto(BASE_URL, wait_until="networkidle", timeout=30_000)
        page.evaluate(
            "input => { const key='ai-architect.assessments.v1'; const records=JSON.parse(localStorage.getItem(key)||'[]'); "
            "const record={id:'hackathon-travel-live',input,platformOverride:'Azure',recommendedArchitecture:'Agentic Orchestration',status:'eligible',updatedAt:new Date().toISOString()}; "
            "localStorage.setItem(key,JSON.stringify([record,...records.filter(r=>r.id!==record.id)])); }",
            DEMO_INPUT,
        )
        page.reload(wait_until="networkidle")

        started = time.monotonic()
        page.mouse.move(1050, 160, steps=20)
        finish_scene(started, 0)

        started = time.monotonic()
        click_nav(page, "New Assessment")
        name = page.get_by_label("Assessment Name")
        name.fill("")
        name.type("Intelligent Travel Planning", delay=45)
        problem = page.get_by_label("Describe your business problem")
        problem.fill("")
        problem.type(USE_CASE, delay=12)
        page.get_by_label("Expected Scale").select_option(label="Enterprise (50K+ users)")
        page.get_by_label("AI Requirement").select_option(label="Required")
        page.get_by_label("Response Time").select_option(label="Under 15 seconds")
        page.get_by_label("Expected Monthly Requests").select_option(label="1M - 5M")
        page.get_by_label("Peak Requests Per Minute").select_option(label="1,000 - 5,000")
        page.mouse.wheel(0, 520)
        finish_scene(started, 1)

        started = time.monotonic()
        click_nav(page, "Dashboard")
        page.wait_for_timeout(400)
        page.evaluate("() => [...document.querySelectorAll('button')].find(el => el.textContent.includes('Intelligent Travel Planning'))?.click()")
        page.wait_for_timeout(600)
        page.mouse.wheel(0, 250)
        finish_scene(started, 2)

        started = time.monotonic()
        page.evaluate("() => document.querySelector('.architecture-card')?.scrollIntoView({behavior:'smooth'})")
        page.wait_for_timeout(1200)
        page.mouse.move(760, 520, steps=20)
        finish_scene(started, 3)

        started = time.monotonic()
        page.evaluate("() => document.querySelector('#decision-trace')?.scrollIntoView({behavior:'smooth'})")
        page.wait_for_timeout(1200)
        page.mouse.wheel(0, 280)
        page.wait_for_timeout(500)
        page.mouse.wheel(0, -180)
        finish_scene(started, 4)

        started = time.monotonic()
        click_nav(page, "Compare")
        page.mouse.move(1100, 120, steps=20)
        page.get_by_label("Right platform").select_option(label="AWS")
        page.mouse.wheel(0, 420)
        finish_scene(started, 5)

        started = time.monotonic()
        click_nav(page, "What-If Simulator")
        page.evaluate("() => scrollTo({top:0,behavior:'smooth'})")
        page.wait_for_timeout(800)
        finish_scene(started, 6)

        started = time.monotonic()
        page.select_option('select[aria-label="What-if traffic"]', label="More than 5M")
        page.select_option('select[aria-label="What-if availability"]', label="99.999%")
        page.get_by_role("button", name="Run Simulation").evaluate("el => el.click()")
        page.wait_for_timeout(500)
        page.evaluate("() => document.querySelector('.impact-panel')?.scrollIntoView({behavior:'smooth'})")
        page.wait_for_timeout(1000)
        finish_scene(started, 7)

        started = time.monotonic()
        click_nav(page, "Cost Analysis")
        page.evaluate("() => scrollTo({top:0,behavior:'smooth'})")
        page.wait_for_timeout(800)
        page.mouse.move(900, 450, steps=20)
        finish_scene(started, 8)

        started = time.monotonic()
        page.evaluate("() => document.querySelector('.recommended-comparison')?.scrollIntoView({behavior:'smooth'})")
        page.wait_for_timeout(1000)
        page.mouse.move(1140, 650, steps=20)
        finish_scene(started, 9)

        started = time.monotonic()
        row = page.locator(".recommended-comparison tbody tr").filter(has_text="GPT-5.4 nano")
        if row.count() and row.get_by_role("button", name="Use model").count():
            row.get_by_role("button", name="Use model").evaluate("el => el.click()")
        page.wait_for_timeout(600)
        finish_scene(started, 10)

        started = time.monotonic()
        click_nav(page, "Decide")
        page.evaluate("() => scrollTo({top:0,behavior:'smooth'})")
        page.wait_for_timeout(800)
        page.mouse.move(1160, 120, steps=20)
        finish_scene(started, 11)

        started = time.monotonic()
        page.evaluate("() => document.querySelector('.decide-main-grid')?.scrollIntoView({behavior:'smooth'})")
        page.wait_for_timeout(1000)
        page.mouse.move(1050, 520, steps=20)
        finish_scene(started, 12)

        started = time.monotonic()
        page.evaluate("() => document.querySelector('.final-cost-panel')?.scrollIntoView({behavior:'smooth'})")
        page.wait_for_timeout(1000)
        page.mouse.move(1160, 110, steps=20)
        finish_scene(started, 13)

        video = page.video
        context.close()
        browser.close()
        raw_path = Path(video.path())
        output = ROOT / "live-walkthrough-raw.webm"
        if output.exists():
            output.unlink()
        raw_path.replace(output)
        return output


if __name__ == "__main__":
    print(run())
