"""Offline, source-grounded WorkHive assistant. No database, network, or AI API."""
import argparse
import hashlib
import json
import re
from pathlib import Path

import joblib
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from greeting_intent import GREETING_REPLY, prepare_question
from train_assistant import ROOT, KNOWLEDGE, ARTIFACTS, APPROVED_TEACHER, load_knowledge

MODEL = ARTIFACTS / "system_assistant.joblib"
HASH = ARTIFACTS / "system_assistant.sha256"
PRIVATE_REPLY = (
    "I can explain WorkHive features, but I cannot access or disclose personal, "
    "confidential, or live records. Use the appropriate signed-in WorkHive page "
    "or contact authorized campus staff."
)
UNKNOWN_REPLY = (
    "I do not have approved information to answer that reliably. "
    "Please check the relevant WorkHive page or ask authorized campus staff."
)
INPUT_REPLY = "Please ask a WorkHive question without including personal identifiers or confidential details."

IDENTIFIER = re.compile(
    r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b|"
    r"\b(?:\+?63|0)9\d{9}\b|"
    r"\b\d{9,15}\b", re.I
)
CONFIDENTIAL = re.compile(
    r"\b(?:api\s*key|secret\s*key|database\s*(?:password|credentials|dump)|"
    r"source\s*code|environment\s*variables?|\.env|access\s*token|"
    r"session\s*cookie|bypass|exploit|hack)\b", re.I
)
LIVE_RECORD = re.compile(
    r"\b(?:show|give|tell|retrieve|look\s*up|find|list|export|download|"
    r"what\s+is|what\s+are|how\s+much|who\s+is|who\s+was|check)\b"
    r".{0,100}\b(?:my|mine|me|his|her|their|someone'?s|an?\s+employee'?s|"
    r"applicant'?s|employee\s+\w+|all\s+employees|specific\s+employee)\b"
    r".{0,100}\b(?:salary|pay|leave|balance|attendance|record|application|"
    r"contact|address|email|phone|id|tin|sss|philhealth|pag-ibig|"
    r"document|resume|medical|rating|performance)\b", re.I | re.S
)
# Direct value requests in which the record appears before the owner.
LIVE_RECORD_ALT = re.compile(
    r"\b(?:salary|pay|leave\s+balance|attendance\s+(?:record|logs?)|"
    r"application\s+status|medical\s+record|employee\s+record)\b"
    r".{0,70}\b(?:of|for)\s+(?:me|my|him|her|them|an?\s+employee|"
    r"an?\s+applicant|[A-Z][a-z]+\s+[A-Z][a-z]+)\b", re.I
)


DIRECT_PRIVATE = re.compile(
    r"\b(?:list|show|reveal|export|download|retrieve|find|give)\b"
    r".{0,70}\b(?:all\s+employees|employee\s+(?:names|records|ids|salaries)|"
    r"applicant\s+(?:names|records|resumes)|staff\s+(?:names|records|salaries)|"
    r"payroll|medical\s+records|attendance\s+records|leave\s+records)\b|"
    r"\b(?:who|which\s+employees?)\b.{0,60}\b(?:late|absent|on\s+leave|"
    r"applied|salary|paid)\b|"
    r"\b(?:status|result|balance|record|salary|pay)\b.{0,60}"
    r"\b(?:employee|applicant|person|candidate)\s*(?:#|id\s*)?\d+\b",
    re.I | re.S,
)


DOMAIN_ANCHOR = re.compile(
    r"\b(?:workhive|employees?|staff|hr|admin|applicants?|candidates?|recruiters?|attendance|timekeeping|leave|time\s+off|job|career|vacancy|"
    r"interviews?|recruitment|portal|dashboard|profile|documents?|certificates?|notifications?|email\s+templates?|account|"
    r"holiday|calendar|report|login|sign\s*in|password|time\s*in|time\s*out|clock\s*in|clock\s*out|"
    r"qr|geofence|gps|privacy|data\s*rights)\b", re.I
)


def explicit_route(question):
    q = question.casefold()
    def has(pattern):
        return re.search(pattern, q) is not None
    if has(r"\b(?:privacy rights|request (?:access to )?(?:my |personal )?data|request access to .{0,40}(?:own|my|personal).{0,40}data|correct my information)\b"):
        return "data_rights"
    if has(r"\b(?:privacy|personal information|data protection|data practices|collected data)\b"):
        return "privacy"
    if has(r"\b(?:forgot|reset|recover|password recovery)\b") and has(r"\b(?:password|login|account|credentials|recovery)\b"):
        return "password_reset"
    if has(r"\b(?:sign in|log in|login|enter workhive|access my account)\b"):
        return "sign_in"
    if has(r"\b(?:qr|scan code)\b") and has(r"\b(?:attendance|time in|clock|scan)\b"):
        return "qr_attendance"
    if has(r"\b(?:audit log|audit trail|recorded system actions)\b"):
        return "admin_audit"
    if has(r"\b(?:interview schedul|arrang(?:e|es?) interviews?|schedule interviews?)"):
        return "hr_interview_scheduling"
    if has(r"\b(?:interview results?|interview scor|scoring interviews?)"):
        return "hr_interview_results"
    if has(r"\b(?:video conferenc|online interviews?|conduct online interviews?)"):
        return "hr_video"
    if has(r"\b(?:email templates?|system emails?)\b") and has(r"\b(?:edit|wording|message|template|admin)\b"):
        return "admin_email"
    if has(r"\b(?:admin|administrator)\b"):
        if has(r"\b(?:audit|activity log)\b"):
            return "admin_audit"
        if has(r"\b(?:email template|message template)\b"):
            return "admin_email"
        if has(r"\b(?:users?|roles?|accounts?)\b"):
            return "admin_users"
        if has(r"\b(?:feature|toggle|enable|disable|module)\b"):
            return "feature_toggles"
        if has(r"\b(?:gps|geofence|zone|location)\b"):
            return "gps_zones"
        return "admin_tools"
    if has(r"\bhr\b"):
        if has(r"\b(?:video|conference|online interview)\b"):
            return "hr_video"
        if has(r"\b(?:interview result|score|scoring|outcome)\b"):
            return "hr_interview_results"
        if has(r"\b(?:interview schedul|arrange interview)\b"):
            return "hr_interview_scheduling"
        if has(r"\b(?:dashboard|home page)\b"):
            return "hr_dashboard"
        if has(r"\b(?:interview|recruit|hiring|applicant|posting|application)\b"):
            return "hr_recruitment"
        if has(r"\b(?:leave|credit)\b"):
            return "hr_leave"
        if has(r"\b(?:tardiness|late|lateness)\b"):
            return "hr_tardiness"
        if has(r"\b(?:attendance|time logs?)\b"):
            if has(r"\b(?:validation|flagged?|incomplete|unmatched)\b"):
                return "hr_attendance_validation"
            if has(r"\b(?:summary|summaries|analytics|trends)\b"):
                return "hr_attendance_summary"
            return "hr_attendance_report"
        if has(r"\b(?:master list|employee list|employee records?|import employees)\b"):
            return "hr_master_list"
        if has(r"\b(?:reports?|hub)\b"):
            return "hr_reports"
    if has(r"\b(?:hiring pipeline|recruitment workflow|hiring process|recruitment stages?|recruitment process)\b"):
        return "hr_recruitment"
    if has(r"\b(?:my applications|employee applications|submitted applications)\b"):
        return "employee_applications"
    if has(r"\b(?:job opening|open jobs?|vacanc|careers|posted jobs?|job postings?)\b"):
        if has(r"\b(?:apply|submit|application form|applicant)\b"):
            return "apply"
        return "careers"
    if has(r"\b(?:apply|applying|application form)\b") and has(r"\b(?:job|opening|workhive posting)\b"):
        return "apply"
    if has(r"\b(?:time in|time out|clock in|clock out|time clock|log time)\b"):
        return "time_clock"
    if has(r"\b(?:attendance|time records?|time logs?)\b"):
        if has(r"\b(?:summary|analytics)\b"):
            return "hr_attendance_summary"
        return "attendance_history"
    if has(r"\b(?:leave|vacation|sick leave)\b"):
        if has(r"\b(?:balance|credits?|remaining|available days?)\b"):
            return "leave_balance"
        if has(r"\b(?:status|approval|track|filed|progress)\b"):
            return "leave_status"
        return "leave_file"
    if has(r"\b(?:upload|documents?|certificates?|diplomas?|vault)\b"):
        return "documents"
    if has(r"\b(?:profile|contact information|employee details)\b"):
        return "profile"
    if has(r"\b(?:notification|alert|notices?)\b"):
        return "notifications"
    if has(r"\b(?:holidays?|calendar)\b"):
        return "holidays"
    if has(r"\b(?:roles?|portals?|types of users)\b"):
        return "roles"
    if has(r"\b(?:dashboard|home page|quick links?)\b"):
        return "employee_dashboard"
    if re.fullmatch(r"\s*(?:what is workhive(?: used for)?|what does workhive do(?: for (?:the )?(?:campus|university|employees|staff))?|tell me about (?:the )?(?:workhive|system)|give (?:an )?overview of workhive|purpose of workhive|what is this platform)\??\s*", q):
        return "overview"
    return None


def load_artifact():
    if not MODEL.is_file() or not HASH.is_file():
        raise ValueError("Train the assistant model first")
    expected = HASH.read_text(encoding="ascii").strip()
    if hashlib.sha256(MODEL.read_bytes()).hexdigest() != expected:
        raise ValueError("Local model checksum mismatch")
    artifact = joblib.load(MODEL)  # Fixed, locally trained artifact only.
    if artifact["knowledge_sha256"] != hashlib.sha256(KNOWLEDGE.read_bytes()).hexdigest():
        raise ValueError("Approved knowledge changed; retrain and review before use")
    if artifact.get("teacher_sha256") != hashlib.sha256(APPROVED_TEACHER.read_bytes()).hexdigest():
        raise ValueError("Reviewed training questions changed; retrain before use")
    if "greeting_vectorizer" not in artifact or "greeting_classifier" not in artifact:
        raise ValueError("Greeting intent is missing; retrain before use")
    return artifact


def answer(question, artifact=None, cards=None):
    if not isinstance(question, str) or not question.strip() or len(question) > 500:
        return {"status": "invalid_input", "answer": INPUT_REPLY, "source": None}
    if IDENTIFIER.search(question):
        return {"status": "private_input", "answer": INPUT_REPLY, "source": None}
    if (re.search(r"\b(?:employee|applicant|staff|person|candidate)\b.{0,50}\b(?:salary|pay|medical|resume)\b", question, re.I) or
            CONFIDENTIAL.search(question) or LIVE_RECORD.search(question) or
            LIVE_RECORD_ALT.search(question) or DIRECT_PRIVATE.search(question)):
        return {"status": "private_request", "answer": PRIVATE_REPLY, "source": None}
    if re.search(
        r"\b(?:reveal|show|give|tell|retrieve|list)\b.{0,100}"
        r"\b(?:applicant|candidate|employee|person)\b.{0,100}"
        r"\b(?:interview (?:score|result)|evaluation|performance|salary|pay)\b",
        question, re.I
    ):
        return {"status": "private_request", "answer": PRIVATE_REPLY, "source": None}
    artifact = artifact or load_artifact()
    cards = cards or load_knowledge()
    question, greeting_only = prepare_question(question, artifact)
    if greeting_only:
        return {"status": "greeting", "answer": GREETING_REPLY, "source": None, "topic": None}
    if (re.match(r"^\s*(?:does|can|is)\s+(?:the\s+)?workhive\b", question, re.I)
            and not re.search(
                r"\b(?:attendance|leave|job|career|recruit|interview|application|"
                r"employee|hr|admin|dashboard|document|notification|holiday|calendar|"
                r"report|profile|account|sign in|password|privacy|role|feature)\b",
                question, re.I
            )):
        return {"status": "unknown", "answer": UNKNOWN_REPLY, "source": None}
    if re.search(r"\b(?:what is|reveal|give|show|tell)\b.{0,55}\b(?:admin|administrator|root|user|employee)\b.{0,30}\b(?:password|credentials|recovery code|otp)\b", question, re.I):
        return {"status": "private_request", "answer": PRIVATE_REPLY, "source": None}
    if re.search(r"\b(?:subscription|pricing|price|payslip|payroll taxes?)\b", question, re.I):
        return {"status": "unknown", "answer": UNKNOWN_REPLY, "source": None}
    routed = explicit_route(question)
    if routed is not None:
        card = next(c for c in cards if c["id"] == routed)
        return {"status": "answered", "answer": card["answer"], "source": card["source"],
                "topic": routed, "confidence_note": "Explicit approved-topic route"}
    if not DOMAIN_ANCHOR.search(question):
        return {"status": "unknown", "answer": UNKNOWN_REPLY, "source": None}
    x = artifact["vectorizer"].transform([question.strip()])
    similarities = cosine_similarity(x, artifact["training_matrix"])[0]
    labels = artifact["training_labels"]
    by_id = {}
    for sim, label in zip(similarities, labels):
        by_id[label] = max(by_id.get(label, 0.0), float(sim))
    ordered = sorted(by_id.items(), key=lambda pair: pair[1], reverse=True)
    chosen, best = ordered[0]
    gap = best - ordered[1][1]
    scores = artifact["classifier"].decision_function(x)[0]
    class_names = artifact["classifier"].classes_
    winner = class_names[int(np.argmax(scores))]
    sorted_scores = np.sort(scores)
    svm_margin = float(sorted_scores[-1] - sorted_scores[-2])
    if (chosen != winner or svm_margin < 0.25 or
            (best < 0.42 and not (best >= 0.37 and gap >= 0.15)) or
            (best >= 0.42 and gap < 0.12)):
        return {"status": "unknown", "answer": UNKNOWN_REPLY, "source": None}
    card = next(c for c in cards if c["id"] == chosen)
    return {"status": "answered", "answer": card["answer"], "source": card["source"],
            "topic": chosen, "confidence_note": "Approved-answer retrieval; not a factual probability"}


def main():
    parser = argparse.ArgumentParser(description="Local public-information WorkHive assistant")
    parser.add_argument("--question", help="Ask one question. Omit for interactive mode.")
    args = parser.parse_args()
    artifact = load_artifact()
    cards = load_knowledge()
    from dialogue import ask
    if args.question:
        result = ask(args.question, artifact, cards)
        result.pop("source", None)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    print("WorkHive assistant (public system information only). Type exit to quit.")
    previous_topic = None
    while True:
        try:
            question = input("You: ")
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if question.strip().casefold() in {"exit", "quit"}:
            break
        result = ask(question, artifact, cards, previous_topic)
        if result["status"] == "answered":
            previous_topic = result["topic"]
        print("Assistant:", result["answer"])


if __name__ == "__main__":
    main()
