import unittest
from geekbot_cli.models import Standup, Question

class TestStandup(unittest.TestCase):
    def test_init(self):
        questions = [Question(id=1, text="What did you do yesterday?", color="green", answer_type="text", answer_choices=[])]
        standup = Standup(id=1, name="Daily Standup", questions=questions)
        self.assertEqual(standup._id, 1)
        self.assertEqual(standup._name, "Daily Standup")
        self.assertEqual(standup._questions, questions)

    def test_to_dict(self):
        questions = [Question(id=1, text="What did you do yesterday?", color="green", answer_type="text", answer_choices=[])]
        standup = Standup(id=1, name="Daily Standup", questions=questions)
        expected_dict = {
            'id': 1,
            'name': "Daily Standup",
            'questions': [{'id': 1, 'text': "What did you do yesterday?", 'color': "green", 'answer_type': "text", 'answer_choices': []}]
        }
        self.assertEqual(standup.to_dict(), expected_dict)

class TestQuestion(unittest.TestCase):
    def test_init(self):
        question = Question(id=1, text="What did you do yesterday?", color="green", answer_type="text", answer_choices=[])
        self.assertEqual(question._id, 1)
        self.assertEqual(question._text, "What did you do yesterday?")
        self.assertEqual(question._color, "green")
        self.assertEqual(question._answer_type, "text")
        self.assertEqual(question._answer_choices, [])

    def test_to_dict(self):
        question = Question(id=1, text="What did you do yesterday?", color="green", answer_type="text", answer_choices=[])
        expected_dict = {
            'id': 1,
            'text': "What did you do yesterday?",
            'color': "green",
            'answer_type': "text",
            'answer_choices': []
        }
        self.assertEqual(question.to_dict(), expected_dict)

if __name__ == '__main__':
    unittest.main()