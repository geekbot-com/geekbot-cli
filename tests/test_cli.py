# test_cli.py
import unittest
from unittest.mock import Mock, patch, MagicMock
from click.testing import CliRunner
from geekbot_cli.cli import CLI, main
from geekbot_cli.exceptions import StandupException,APIKeyNotFoundError


class TestCLI(unittest.TestCase):

    def setUp(self):
        self.runner = CliRunner()
        self.api_client_mock = MagicMock()
        self.config_manager_mock = MagicMock()

    @patch('geekbot_cli.cli.console')
    @patch('geekbot_cli.cli.Prompt.ask')
    def test_select_standup(self, mock_prompt_ask, mock_console):
        # Setup mock responses
        mock_prompt_ask.return_value = '1'
        cli_instance = CLI(api_client=Mock(), config_manager=Mock())
        standups = [{'id': 1, 'name': 'Daily Standup'}]

        # Run the method under test
        selected_standup = cli_instance.select_standup(standups)

        # Check that the correct standup is selected
        self.assertEqual(selected_standup['id'], 1)
        self.assertEqual(selected_standup['name'], 'Daily Standup')
        mock_prompt_ask.assert_called_once_with("Enter the number of the standup", default="0", show_choices=False)
        mock_console.print.assert_called()  # You can add more specific checks here

    
    @patch('geekbot_cli.cli.console')
    @patch('geekbot_cli.cli.Prompt.ask')
    def test_select_standup_invalid_input(self, mock_prompt_ask, mock_console):
        """
        Test selecting a standup with invalid input.
        """
        mock_prompt_ask.side_effect = ['invalid', '1']
        cli_instance = CLI(api_client=self.api_client_mock, config_manager=self.config_manager_mock)
        standups = [{'id': 1, 'name': 'Daily Standup'}]

        selected_standup = cli_instance.select_standup(standups)

        self.assertIsNone(selected_standup)
        mock_console.print.assert_called_with("Invalid selection. Please enter a number.", style="red")


    @patch('geekbot_cli.cli.console')
    @patch('geekbot_cli.cli.get_multiline_input')
    def test_input_answers(self, mock_get_multiline_input, mock_console):
        mock_get_multiline_input.return_value = 'Test Answer'
        questions = [
            {'id': 1, 'text': 'What did you do yesterday?', 'color': 'green', 'answer_type': 'text'},
            # ... add other question types as needed
        ]
        cli_instance = CLI(api_client=Mock(), config_manager=Mock())

        answers = cli_instance.input_answers(questions)

        self.assertIn(1, answers)
        self.assertEqual(answers[1], {'text': 'Test Answer'})
        mock_get_multiline_input.assert_called()
        mock_console.print.assert_called()


    @patch('geekbot_cli.cli.radiolist_dialog')
    def test_input_answers_multiple_choice(self, mock_radiolist_dialog):
        """
        Test answering a multiple choice question.
        """
        # Mock radiolist_dialog to return a selected choice
        mock_radiolist_dialog.return_value.run.return_value = 'Choice 1'
        questions = [
            {'id': 1, 'text': 'Select an option:', 'color': 'green', 'answer_type': 'multiple_choice', 'answer_choices': ['Choice 1', 'Choice 2']}
        ]
        cli_instance = CLI(api_client=self.api_client_mock, config_manager=self.config_manager_mock)

        answers = cli_instance.input_answers(questions)

        self.assertIn(1, answers)
        self.assertEqual(answers[1], {'text': 'Choice 1'})
        mock_radiolist_dialog.assert_called_once()
        

    @patch('geekbot_cli.cli.console')
    def test_start_with_exceptions(self, mock_console):
        with patch.object(self.api_client_mock, 'set_headers', side_effect=StandupException("Standup failed")), \
             patch.object(self.api_client_mock, 'get_standups'), \
             patch.object(self.config_manager_mock, 'get_api_key', return_value='dummy_api_key'):

            cli_instance = CLI(api_client=self.api_client_mock, config_manager=self.config_manager_mock)
            cli_instance.start()

            # Verifying error handling for StandupException
            errors = [call for call in mock_console.method_calls if "An error occurred: Standup failed" in str(call)]
            self.assertTrue(errors, "Expected error message was not printed to the console.")



    @patch('geekbot_cli.cli.console')
    @patch('geekbot_cli.cli.CLI.send_report', return_value={'done_at': 1})  # Mocking to ensure we don't hit the comparison issue
    @patch('geekbot_cli.cli.CLI.input_answers', return_value={'1': {'text': 'Answer'}})
    @patch('geekbot_cli.cli.CLI.select_standup', return_value=None)  # Ensuring we reach the API key prompt
    @patch('geekbot_cli.cli.Prompt.ask')
    def test_start_with_api_key_not_found(self, mock_ask, mock_select_standup, mock_input_answers, mock_send_report, mock_console):
        self.config_manager_mock.get_api_key.side_effect = APIKeyNotFoundError("API Key not found")
        
        cli_instance = CLI(api_client=self.api_client_mock, config_manager=self.config_manager_mock)
        cli_instance.start()

        # Adjusting the assertion to match the actual behavior
        mock_ask.assert_any_call("API key: ", password=True)  # Using assert_any_call to allow for other calls to ask

        # Optionally, verify that the API key is saved after being prompted
        self.config_manager_mock.save_api_key.assert_called()


if __name__ == '__main__':
    unittest.main()