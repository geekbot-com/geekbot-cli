## test_main.py
import unittest
import subprocess
import sys
from unittest.mock import patch
from click.testing import CliRunner
from geekbot_cli.main import main
from geekbot_cli.exceptions import APIKeyNotFoundError, StandupException
from geekbot_cli.config_manager import ConfigManager


class TestMain(unittest.TestCase):

    def setUp(self):
        self.runner = CliRunner()

    @patch('click.confirm')
    @patch('geekbot_cli.config_manager.ConfigManager.delete_api_key')
    def test_clear_api_key_no_confirmation(self, mock_delete_api_key, mock_confirm):
        mock_confirm.return_value = False
        result = self.runner.invoke(main, ['--clear-api-key'])
        self.assertIn("Operation cancelled.", result.output)
        mock_delete_api_key.assert_not_called()

    @patch('click.confirm')
    @patch('geekbot_cli.config_manager.ConfigManager.delete_api_key')
    def test_clear_api_key_with_confirmation(self, mock_delete_api_key, mock_confirm):
        mock_confirm.return_value = True
        result = self.runner.invoke(main, ['--clear-api-key'])
        self.assertIn("API key has been removed.", result.output)
        mock_delete_api_key.assert_called_once()

    @patch('geekbot_cli.cli.CLI.start', side_effect=Exception("Generic Error"))
    def test_main_generic_exception(self, mock_start):
        result = self.runner.invoke(main)
        self.assertNotEqual(result.exit_code, 0)
        self.assertIn("Error: Generic Error", result.output)

    @patch('geekbot_cli.cli.CLI.start')
    def test_main_workflow(self, mock_start):
        """
        Test the main workflow by ensuring the CLI's start method is called.
        """
        result = self.runner.invoke(main)
        self.assertEqual(result.exit_code, 0)
        mock_start.assert_called_once()

    @patch('geekbot_cli.config_manager.ConfigManager.get_api_key')
    def test_main_api_key_retrieval(self, mock_get_api_key):
        """
        Test the retrieval of the API key during the main workflow.
        """
        mock_get_api_key.return_value = 'test_api_key'
        result = self.runner.invoke(main)
        self.assertEqual(result.exit_code, 0)
        mock_get_api_key.assert_called_once()


    @patch('geekbot_cli.cli.CLI.start', side_effect=StandupException)
    def test_main_standup_exception(self, mock_start):
        """
        Test the behavior when a StandupException is raised during the main workflow.
        """
        result = self.runner.invoke(main)
        self.assertNotEqual(result.exit_code, 0)

    @patch('geekbot_cli.cli.CLI.start', side_effect=StandupException("Standup error"))
    def test_main_standup_exception_error(self, mock_cli_start):
        """
        Test the behavior when a StandupException is raised during the main workflow.
        """
        result = self.runner.invoke(main)
        # Check that the exit code indicates an error
        self.assertEqual(result.exit_code, 1)
        # Check that the specific error message is displayed to the user
        self.assertIn("Error: Standup error", result.output)
        mock_cli_start.assert_called_once()

    @patch('geekbot_cli.cli.CLI.start', side_effect=APIKeyNotFoundError("API key not found"))
    def test_main_api_key_not_found_exception(self, mock_cli_start):
        result = self.runner.invoke(main)
        self.assertEqual(result.exit_code, 1)
        self.assertIn("Error: API key not found", result.output)

    
    
if __name__ == '__main__':
    unittest.main() # pragma: no cover