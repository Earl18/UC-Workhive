"""Run the reviewed WorkHive classifier for one website request.

The website derives the role from its signed session. This process still applies
its own allowlist before returning any model answer.
"""

import json
import re
import sys

from assistant import answer, load_artifact
from greeting_intent import GRATITUDE_REPLY, prepare_gratitude
from train_assistant import load_knowledge
from typo_normalizer import repair


PUBLIC = {
    "overview", "roles", "sign_in", "password_reset", "careers", "apply",
    "privacy", "data_rights",
}
EMPLOYEE = PUBLIC | {
    "employee_dashboard", "time_clock", "qr_attendance", "attendance_history",
    "leave_file", "leave_status", "leave_balance", "profile", "documents",
    "notifications", "holidays", "employee_applications",
}
HR = PUBLIC | {
    "hr_dashboard", "hr_master_list", "hr_attendance_report",
    "hr_attendance_validation", "hr_attendance_summary", "hr_tardiness",
    "hr_leave", "hr_recruitment", "hr_reports", "hr_interview_scheduling",
    "hr_interview_results", "hr_video", "notifications", "holidays",
}
ADMIN = PUBLIC | {
    "admin_tools", "feature_toggles", "gps_zones", "admin_users",
    "admin_email", "admin_audit", "notifications", "holidays",
}
ALLOWED = {"public": PUBLIC, "employee": EMPLOYEE, "hr": HR, "admin": ADMIN}

# Explicit operational requests are blocked before classification. This also
# covers mixed requests where a classifier might choose just one allowed topic.
HR_OPERATIONS = re.compile(
    r"\b(?:hr\s+(?:portal|dashboard|features?|tools?|reports?|workflow)|"
    r"employee\s+master\s+list|attendance\s+(?:report|validation|summary)|"
    r"tardiness\s+monitoring|leave\s+(?:management|approval)|"
    r"approv\w*\s+(?:an?\s+)?(?:employee\s+)?leave|"
    r"(?:manage|review|screen|rank)\w*\s+(?:job\s+)?applications?|"
    r"(?:manage|post|publish)\w*\s+job\s+postings?|"
    r"interview\s+(?:scheduling|scoring|results?|scores?|panel)|"
    r"video\s+conferencing|reports?\s+hub)\b", re.I,
)
ADMIN_OPERATIONS = re.compile(
    r"\b(?:admin(?:istrator)?\s+(?:portal|dashboard|features?|tools?|settings?)|"
    r"feature\s+toggles?|gps\s+zones?|geofenc\w*|"
    r"user\s+(?:and\s+)?role\s+management|"
    r"(?:change|assign|manage)\w*\s+(?:a\s+)?user\s+role|"
    r"audit\s+log|email\s+templates?|system\s+settings?)\b", re.I,
)
EMPLOYEE_OPERATIONS = re.compile(
    r"\b(?:employee\s+(?:portal|dashboard)|my\s+(?:leave|attendance|profile|documents)|"
    r"clock\s+(?:in|out)|qr\s+attendance|leave\s+(?:balance|credits?))\b", re.I,
)
DENIED = "I can only help with WorkHive information available to your current portal. Please use an authorized account or contact HR for that topic."


def restricted(question, role):
    if role == "public":
        return bool(HR_OPERATIONS.search(question) or ADMIN_OPERATIONS.search(question)
                    or EMPLOYEE_OPERATIONS.search(question))
    if role == "employee":
        return bool(HR_OPERATIONS.search(question) or ADMIN_OPERATIONS.search(question))
    if role == "hr":
        return bool(ADMIN_OPERATIONS.search(question))
    return bool(HR_OPERATIONS.search(question))


def respond(question, role, artifact, cards):
    if role not in ALLOWED or not isinstance(question, str):
        raise ValueError("Invalid request")
    # Run the original input through the model's privacy guards before repair.
    # Repaired words are checked against the same guards and role rules below.
    original = answer(question, artifact, cards)
    if original["status"] in {"invalid_input", "private_input", "private_request"}:
        return {"status": original["status"], "answer": original["answer"]}
    corrected = repair(question)
    if restricted(question, role) or restricted(corrected, role):
        return {"status": "restricted", "answer": DENIED}
    remaining, thanked = prepare_gratitude(corrected)
    if thanked and not remaining:
        return {"status": "gratitude", "answer": GRATITUDE_REPLY}
    result = answer(remaining if thanked else corrected, artifact, cards)
    if result["status"] in {"invalid_input", "private_input", "private_request"}:
        return {"status": result["status"], "answer": result["answer"]}
    topic = result.get("topic")
    if result["status"] == "answered" and topic not in ALLOWED[role]:
        return {"status": "restricted", "answer": DENIED}
    # Never return source paths, model confidence, or internal classifier data.
    prefix = "You're welcome! " if thanked else ""
    return {"status": result["status"], "answer": prefix + result["answer"]}


def main():
    artifact = load_artifact()
    cards = load_knowledge()
    if len(sys.argv) > 1 and sys.argv[1] == "--serve":
        for line in sys.stdin:
            try:
                payload = json.loads(line)
                result = respond(payload.get("question"), payload.get("role"), artifact, cards)
                reply = {"id": payload.get("id"), **result}
            except (ValueError, TypeError, json.JSONDecodeError):
                reply = {"id": None, "status": "invalid_input", "answer": "Please ask a valid WorkHive question."}
            print(json.dumps(reply, ensure_ascii=False), flush=True)
    else:
        payload = json.load(sys.stdin)
        result = respond(payload.get("question"), payload.get("role"), artifact, cards)
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
