"""Conservative spelling repair for WorkHive questions before intent matching."""

import json
import re
from difflib import SequenceMatcher, get_close_matches
from functools import lru_cache

from train_assistant import APPROVED_TEACHER


WORDS = re.compile(r"[A-Za-z]{3,}")
GLOSSARY = """
thank thanks you hello hi salamat goodbye please help how what where when who why
workhive cebu employee employees applicant applicants public admin administrator hr
clock attendance shift leave approval approve approved request balance credits profile
document documents upload career careers application applications recruitment interview
scheduling scoring score results dashboard master list report reports validation summary
tardiness monitoring management feature features toggle toggles gps zone zones geofence
geofencing audit log email template templates system settings role roles user users
password sign privacy holidays notification notifications portal job postings
"""


@lru_cache(maxsize=1)
def vocabulary():
    from train_assistant import load_knowledge

    words = set(GLOSSARY.split())
    for card in load_knowledge():
        for text in [card["title"], card["test"], *card["train"]]:
            words.update(word.casefold() for word in WORDS.findall(text))
    reviewed = json.loads(APPROVED_TEACHER.read_text(encoding="utf-8"))
    for item in reviewed["items"]:
        for text in item["questions"]:
            words.update(word.casefold() for word in WORDS.findall(text))
    return frozenset(words)


@lru_cache(maxsize=2048)
def repair_word(word):
    known = vocabulary()
    lower = word.casefold()
    if lower in known or len(lower) > 24:
        return word
    if lower == "hrr":
        return "HR"
    candidates = [item for item in known if item[0] == lower[0] and abs(len(item) - len(lower)) <= 2]
    matches = get_close_matches(lower, candidates, n=2, cutoff=0.78)
    if not matches:
        return word
    best = SequenceMatcher(None, lower, matches[0]).ratio()
    runner_up = SequenceMatcher(None, lower, matches[1]).ratio() if len(matches) > 1 else 0
    if best - runner_up < 0.04:
        return word
    replacement = matches[0]
    if word.isupper():
        return replacement.upper()
    if word[0].isupper():
        return replacement.capitalize()
    return replacement


def repair(question):
    return WORDS.sub(lambda match: repair_word(match.group()), question)
