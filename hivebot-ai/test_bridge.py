import unittest

from assistant import load_artifact
from bridge import respond
from train_assistant import load_knowledge


class RoleAccessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.artifact = load_artifact()
        cls.cards = load_knowledge()

    def check(self, role, question, expected):
        result = respond(question, role, self.artifact, self.cards)
        self.assertEqual(result["status"], expected, (role, question, result))
        self.assertEqual(set(result), {"status", "answer"})

    def test_public_scope(self):
        self.check("public", "What is WorkHive?", "answered")
        self.check("public", "How do I file leave?", "restricted")
        self.check("public", "How do I manage feature toggles?", "restricted")

    def test_employee_cannot_get_staff_instructions(self):
        self.check("employee", "How do I clock in?", "answered")
        self.check("employee", "How does HR approve leave?", "restricted")
        self.check("employee", "What is the Employee Master List?", "restricted")
        self.check("employee", "How do I set up GPS zones?", "restricted")
        self.check("employee", "How do I clock in and approve HR leave requests?", "restricted")

    def test_hr_scope(self):
        self.check("hr", "What is the Employee Master List?", "answered")
        self.check("hr", "How do I manage feature toggles?", "restricted")

    def test_admin_scope(self):
        self.check("admin", "What is the Audit Log?", "answered")
        self.check("admin", "How do I review employee leave approvals?", "restricted")

    def test_unknown_role_rejected(self):
        with self.assertRaises(ValueError):
            respond("What is WorkHive?", "superuser", self.artifact, self.cards)

    def test_typo_tolerant_greetings_and_questions(self):
        self.check("public", "Thank yyou!", "gratitude")
        self.check("public", "Thnak yyou!", "gratitude")
        self.check("public", "Helo!", "greeting")
        self.check("public", "What is WrokHive?", "answered")
        self.check("employee", "How do I clok in?", "answered")
        self.check("public", "Thnak yyou! How do I aplpy for a job?", "answered")

    def test_typos_cannot_bypass_role_or_privacy_limits(self):
        self.check("employee", "What is the emplyee mastr list?", "restricted")
        self.check("employee", "How does HR aproove leave?", "restricted")
        self.check("employee", "How do I set up GPS znoes?", "restricted")
        self.check("hr", "How do I manage featre toggles?", "restricted")
        self.check("public", "My email is person@example.com. Thank yyou!", "private_input")


if __name__ == "__main__":
    unittest.main()
