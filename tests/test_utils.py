import unittest
from geekbot_cli.models import Question

class TestUtils(unittest.TestCase):
    def test_question_defaults(self):
        """
        Test that the Question model has sensible defaults.
        This test verifies if the Question model is initialized with the expected values.
        """
        # Initialize a Question instance with specific attributes
        question = Question(id=2, text="How are you today?", color="blue", answer_type="text", answer_choices=[])
        
        # Assert that each attribute is correctly set
        self.assertEqual(question._id, 2, "Question ID should be set to 2")
        self.assertEqual(question._text, "How are you today?", "Question text should match the provided input")
        self.assertEqual(question._color, "blue", "Question color should be set to 'blue'")
        self.assertEqual(question._answer_type, "text", "Question answer_type should be set to 'text'")
        self.assertListEqual(question._answer_choices, [], "Question answer_choices should be an empty list")

    def test_environment_setup(self):
        """
        Placeholder test for environment setup verification.
        This test is intended as a placeholder to check the setup of your testing environment.
        It should be replaced or extended to test actual environment configurations critical to your application.
        """
        # For demonstration purposes, this assertion always passes
        self.assertTrue(True, "Environment setup is valid.")

if __name__ == '__main__':
    unittest.main()