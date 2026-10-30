"""Small, locally trained greeting intent for the WorkHive assistant."""
import re

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC


GREETING_REPLY = (
    "Hello! I'm the WorkHive assistant. You can ask me about WorkHive features "
    "and how to use them. Please leave out personal or confidential details."
)
GRATITUDE_REPLY = "You're welcome! Feel free to ask another question about WorkHive."
GRATITUDE_WORDS = r"(?:thanks(?:\s+(?:so much|a lot))?|thank you(?:\s+(?:so much|very much))?|salamat(?:\s+po)?|maraming salamat(?:\s+po)?)"
GRATITUDE_CONTEXT = r"(?:\s+for\s+(?:your|the)\s+(?:help|answer|information|explanation|response))?"
GRATITUDE_ONLY = re.compile(rf"^\s*{GRATITUDE_WORDS}{GRATITUDE_CONTEXT}\s*[!.]*\s*$", re.I)
GRATITUDE_PREFIX = re.compile(rf"^\s*{GRATITUDE_WORDS}{GRATITUDE_CONTEXT}(?:\s*[,!.]\s*|\s+(?=(?:how|what|where|when|who|why|can|could|does|do|is|are|please|tell|show)\b))", re.I)
QUESTION_START = re.compile(r"^(?:how|what|where|when|who|why|can|could|does|do|is|are|please|tell|show)\b", re.I)

GREETINGS = [
    "hi", "hello", "hey", "hey there", "hello there", "hi there",
    "good morning", "good afternoon", "good evening", "good day",
    "greetings", "hi po", "hello po", "good morning po",
    "magandang umaga", "magandang hapon", "magandang gabi",
    "magandang araw", "kumusta", "kamusta", "kumusta po",
    "hello assistant", "hi assistant", "hello WorkHive", "hi WorkHive",
]

NOT_GREETINGS = [
    "what is WorkHive", "how do I sign in", "where is the dashboard",
    "how do employees clock in", "can I file leave", "what is attendance",
    "show applicant resumes", "what is my salary", "what is my leave balance",
    "is QR attendance available", "who can use WorkHive", "how do I apply",
    "where are job openings", "what does HR do", "thank you", "thanks",
    "goodbye", "bye", "what is the weather", "tell me a joke",
    "can you help me", "please help", "I need help with my account",
    "good morning shift attendance", "good afternoon meeting schedule",
    "morning attendance report", "hello world program", "heyday of recruitment",
]

PREFIX = re.compile(
    r"^\s*(?:hi|hello|hey|greetings|good\s+(?:morning|afternoon|evening|day)|"
    r"magandang\s+(?:umaga|hapon|gabi|araw)|kumusta|kamusta)\b"
    r"(?:\s+po)?(?:\s+(?:there|workhive|assistant))?"
    r"(?:\s*[,!.?]\s*|\s+(?=(?:how|what|where|when|who|why|can|does|do|is|are|tell|show|give|please)\b)|$)",
    re.I,
)


def build_greeting_model():
    examples = GREETINGS + NOT_GREETINGS
    labels = [1] * len(GREETINGS) + [0] * len(NOT_GREETINGS)
    vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), lowercase=True)
    matrix = vectorizer.fit_transform(examples)
    classifier = LinearSVC(C=1.0, random_state=18).fit(matrix, labels)
    return vectorizer, classifier


def prepare_question(question, artifact):
    """Return the WorkHive question and whether the input is a greeting alone."""
    text = question.strip()
    match = PREFIX.match(text)
    if match:
        remainder = text[match.end():].strip(" ,!.?")
        if not remainder or remainder.casefold() in {"how are you", "how are you doing"}:
            return "", True
        return remainder, False

    # The trained intent handles short greeting variants missed by the prefix list.
    if len(text.split()) <= 5 and len(text) <= 40:
        vectorizer = artifact["greeting_vectorizer"]
        classifier = artifact["greeting_classifier"]
        score = float(classifier.decision_function(vectorizer.transform([text]))[0])
        if score >= 0.35:
            return "", True
    return text, False


def prepare_gratitude(question):
    """Recognize a thank-you alone or remove it before a real question."""
    text = question.strip()
    if GRATITUDE_ONLY.fullmatch(text):
        return "", True
    match = GRATITUDE_PREFIX.match(text)
    if match:
        remainder = text[match.end():].strip(" ,!.?")
        if QUESTION_START.match(remainder):
            return remainder, True
    return text, False
