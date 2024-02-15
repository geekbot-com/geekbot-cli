# test_cli.py
import unittest
from unittest.mock import Mock, patch, MagicMock
from click.testing import CliRunner
from geekbot_cli.cli import main, CLI
from geekbot_cli.exceptions import StandupException,APIKeyNotFoundError, StandupAPIError
from geekbot_cli.cli import get_multiline_input

class TestCLI(unittest.TestCase):

    def setUp(self):
        super().setUp()  # Ensure the superclass's setUp method is called
        self.runner = CliRunner()
        self.api_client_mock = MagicMock()
        self.config_manager_mock = MagicMock()
        self.cli_instance = CLI(api_client=self.api_client_mock, config_manager=self.config_manager_mock)
        # Mock the post_report to return a dictionary with an integer 'done_at'
        self.api_client_mock.post_report.return_value = {'done_at': 1}

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


    @patch('geekbot_cli.cli.console')
    @patch('geekbot_cli.cli.Prompt.ask')
    def test_select_standup_out_of_range(self, mock_prompt_ask, mock_console):
        # Setup to simulate user input that selects a standup outside the available range
        mock_prompt_ask.return_value = '100'  # Assuming you have less than 100 standups
        standups = [{'id': 1, 'name': 'Daily Standup'}]  # Mock standup list

        cli_instance = CLI(api_client=self.api_client_mock, config_manager=self.config_manager_mock)
        cli_instance.select_standup(standups)

        mock_console.print.assert_called_with("Selection out of range.", style="red")


    @patch('geekbot_cli.cli.console')
    def test_start_with_api_error(self, mock_console):
        self.api_client_mock.get_standups.side_effect = StandupAPIError("API error")
        
        cli_instance = CLI(api_client=self.api_client_mock, config_manager=self.config_manager_mock)
        cli_instance.start()

        mock_console.print.assert_called_with("An error occurred: API error", style="red")

    @patch('geekbot_cli.cli.console.print')
    @patch('builtins.input', side_effect=['not a number', '123'])
    def test_get_multiline_input_numeric(self, mock_input, mock_print):
        result = get_multiline_input('green', 'numeric')
        self.assertEqual(result, '123')
        # Verify input was called twice: once for the non-numeric input and once for the numeric input
        self.assertEqual(mock_input.call_count, 2)


    @patch('geekbot_cli.cli.console')
    @patch('geekbot_cli.cli.Prompt.ask')
    def test_start_api_key_not_found_exception(self, mock_ask, mock_console):
        # Setup mocks
        self.config_manager_mock.get_api_key.side_effect = [APIKeyNotFoundError, "dummy_api_key"]
        self.api_client_mock.get_standups.return_value = []

        # Initialize CLI and call start
        cli_instance = CLI(api_client=self.api_client_mock, config_manager=self.config_manager_mock)
        cli_instance.start()

        # Verify that Prompt.ask was called with the expected argument for the API key at least once
        mock_ask.assert_any_call("API key: ", password=True)

        # Additional checks to verify the flow
        mock_console.print.assert_any_call("Please enter your API key. Get one here:")
        mock_console.print.assert_any_call("https://app.geekbot.com/dashboard/api-webhooks", style="link https://app.geekbot.com/dashboard/api-webhooks")
    

    @patch('geekbot_cli.cli.console')
    def test_successful_report_submission(self, mock_console):
        # Set the mock return value before calling the start method
        self.api_client_mock.post_report.return_value = {'done_at': 1, 'channel': 'test_channel'}

        with patch.object(CLI, 'input_answers', return_value={'dummy': 'answers'}), \
            patch.object(CLI, 'send_report', new=self.api_client_mock.post_report), \
            patch.object(CLI, 'select_standup', return_value={'id': 1, 'questions': []}):
            
            self.config_manager_mock.get_api_key.return_value = 'dummy_api_key'
            self.cli_instance.start()

            # This ensures the assertion checks for the expected console output including the channel information
            mock_console.print.assert_called_with("Report submitted successfully! Check #test_channel", style="green")

    @patch('geekbot_cli.cli.console')
    def test_unsuccessful_report_submission(self, mock_console):
        with patch.object(CLI, 'input_answers', return_value={'dummy': 'answers'}), \
            patch.object(CLI, 'send_report', return_value={'done_at': 0}), \
            patch.object(CLI, 'select_standup', return_value={'id': 1, 'questions': []}):

            self.config_manager_mock.get_api_key.return_value = 'dummy_api_key'
            self.cli_instance.start()

            # Check for call without considering the style
            mock_console.print.assert_any_call("Report could not be saved")

    @patch('geekbot_cli.cli.APIClient')
    @patch('geekbot_cli.cli.ConfigManager')
    @patch('geekbot_cli.cli.CLI')
    def test_cli_application_start(self, mock_cli_class, mock_config_manager_class, mock_api_client_class):
        # Setup the mock for the CLI's start method
        mock_cli_instance = MagicMock()
        mock_cli_class.return_value = mock_cli_instance

        # Use CliRunner to invoke the CLI application
        runner = CliRunner()
        result = runner.invoke(main)

        # Assertions to ensure the CLI behaves as expected
        self.assertEqual(result.exit_code, 0)
        mock_api_client_class.assert_called_once()
        mock_config_manager_class.assert_called_once()
        mock_cli_instance.start.assert_called_once()



if __name__ == '__main__':
    unittest.main()