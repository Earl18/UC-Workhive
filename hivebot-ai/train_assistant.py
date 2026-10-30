"""Train a local, system-specific intent model on approved WorkHive FAQs."""
import hashlib
import json
import re
from pathlib import Path

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import FeatureUnion
from sklearn.svm import LinearSVC

from greeting_intent import build_greeting_model

ROOT = Path(__file__).resolve().parent
KNOWLEDGE = ROOT / "knowledge.json"
ARTIFACTS = ROOT / "artifacts"
APPROVED_TEACHER = ROOT / "data" / "approved_teacher_questions.json"


def load_knowledge():
    data = json.loads(KNOWLEDGE.read_text(encoding="utf-8-sig"))
    cards = data.get("cards")
    if data.get("version") != 1 or not isinstance(cards, list) or len(cards) < 20:
        raise ValueError("Knowledge base is missing or incomplete")
    ids = [c["id"] for c in cards]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate intent IDs")
    for card in cards:
        if not all(isinstance(card.get(k), str) and card[k].strip() for k in ("id", "title", "answer", "source", "test")):
            raise ValueError("Incomplete card")
        if not isinstance(card.get("train"), list) or len(card["train"]) < 4:
            raise ValueError("Need at least four training questions per card")
        if any(not isinstance(x, str) or not x.strip() for x in card["train"]):
            raise ValueError("Blank training question")
    return cards



def load_approved_teacher(cards):
    """Load reviewed teacher questions; reject incomplete or changed training data."""
    if not APPROVED_TEACHER.is_file():
        raise ValueError("Reviewed teacher questions are required")
    data = json.loads(APPROVED_TEACHER.read_text(encoding="utf-8"))
    if data.get("guide_sha256") != hashlib.sha256(KNOWLEDGE.read_bytes()).hexdigest():
        raise ValueError("Guide changed after teacher question review")
    items = data.get("items")
    if (not isinstance(items, list) or not all(isinstance(x, dict) for x in items)
            or {x.get("id") for x in items} != {c["id"] for c in cards}):
        raise ValueError("Teacher questions do not cover every approved topic")
    if len(items) != len(cards):
        raise ValueError("Duplicate or missing teacher topic")
    seen = {}
    cleaned = {}
    for item in items:
        questions = item.get("questions")
        if not isinstance(questions, list):
            raise ValueError(f"Missing teacher question list for {item['id']}")
        accepted = []
        for question in questions:
            if (not isinstance(question, str) or not 12 <= len(question) <= 160
                    or not question.endswith("?")
                    or any(ch in question for ch in "\r\n<>")
                    or re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b(?:\+?63|0)9\d{9}\b|\b\d{9,15}\b", question)) :
                raise ValueError(f"Malformed teacher question for {item['id']}")
            normalized = " ".join(question.casefold().split())
            if normalized in seen and seen[normalized] != item["id"]:
                raise ValueError("Conflicting teacher labels")
            seen[normalized] = item["id"]
            if question not in accepted:
                accepted.append(question)
        cleaned[item["id"]] = accepted
    if sum(len(v) for v in cleaned.values()) < 60:
        raise ValueError("Too few reviewed teacher questions")
    return cleaned

def build_model(cards):
    teacher = load_approved_teacher(cards)
    greeting_vectorizer, greeting_classifier = build_greeting_model()
    questions = []
    labels = []
    for card in cards:
        for question in [card["title"], *card["train"], *teacher[card["id"]]]:
            questions.append(question)
            labels.append(card["id"])
    vectorizer = FeatureUnion([
        ("word", TfidfVectorizer(lowercase=True, ngram_range=(1, 2), sublinear_tf=True)),
        ("char", TfidfVectorizer(lowercase=True, analyzer="char_wb", ngram_range=(2, 5), sublinear_tf=True)),
    ])
    matrix = vectorizer.fit_transform(questions)
    classifier = LinearSVC(C=5.0, random_state=18).fit(matrix, labels)
    return {
        "vectorizer": vectorizer,
        "classifier": classifier,
        "training_matrix": matrix,
        "training_labels": labels,
        "knowledge_sha256": hashlib.sha256(KNOWLEDGE.read_bytes()).hexdigest(),
        "teacher_sha256": hashlib.sha256(APPROVED_TEACHER.read_bytes()).hexdigest(),
        "teacher_question_count": sum(len(v) for v in teacher.values()),
        "min_similarity": 0.29,
        "min_svm_margin": 0.06,
        "greeting_vectorizer": greeting_vectorizer,
        "greeting_classifier": greeting_classifier,
    }


def main():
    cards = load_knowledge()
    ARTIFACTS.mkdir(exist_ok=True)
    artifact = build_model(cards)
    path = ARTIFACTS / "system_assistant.joblib"
    joblib.dump(artifact, path, compress=3)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    (ARTIFACTS / "system_assistant.sha256").write_text(digest + "\n", encoding="ascii")
    print(f"Trained on {len(artifact['training_labels'])} approved questions across {len(cards)} intents")
    print(f"Model SHA-256: {digest}")


if __name__ == "__main__":
    main()
