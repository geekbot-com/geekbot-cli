## test_main.py
import unittest
from unittest.mock import patch
from click.testing import CliRunner
from geekbot_cli.main import main
from geekbot_cli.exceptions import APIKeyNotFoundError, StandupException


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

if __name__ == '__main__':
    unittest.main()