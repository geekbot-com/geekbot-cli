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
        self.assertIn("Error: A standup exception occurred.", result.output)
        mock_cli_start.assert_called_once()

    @patch('geekbot_cli.cli.CLI.start', side_effect=APIKeyNotFoundError("API key not found"))
    def test_main_api_key_not_found_exception(self, mock_cli_start):
        result = self.runner.invoke(main)
        self.assertEqual(result.exit_code, 1)
        self.assertIn("Error: API key not found. Please configure your API key.", result.output)

if __name__ == '__main__':
    unittest.main() # pragma: no cover