## test_config_manager.py
import unittest
from unittest.mock import patch, MagicMock
from geekbot_cli.config_manager import ConfigManager
from geekbot_cli.exceptions import APIKeyNotFoundError
from io import StringIO

class TestConfigManager(unittest.TestCase):
    def setUp(self):
        self.config_manager = ConfigManager(service_name='TestStandupApp')

    @patch('keyring.get_password')
    def test_get_api_key_success(self, mock_get_password):
        mock_get_password.return_value = 'test_api_key'
        api_key = self.config_manager.get_api_key()
        self.assertEqual(api_key, 'test_api_key')

    @patch('keyring.get_password')
    def test_get_api_key_not_found_error(self, mock_get_password):
        mock_get_password.return_value = None
        with self.assertRaises(APIKeyNotFoundError) as context:
            self.config_manager.get_api_key()
        self.assertTrue('API key not found in keyring.' in str(context.exception))

    @patch('keyring.set_password')
    def test_save_api_key_success(self, mock_set_password):
        self.config_manager.save_api_key('new_test_api_key')
        mock_set_password.assert_called_once_with('TestStandupApp', 'api_key', 'new_test_api_key')

    @patch('keyring.set_password')
    def test_save_api_key_error(self, mock_set_password):
        mock_set_password.side_effect = RuntimeError('Error accessing keyring')
        with self.assertRaises(RuntimeError) as context:
            self.config_manager.save_api_key('new_test_api_key')
        self.assertTrue('Error accessing keyring' in str(context.exception))

    
    @patch('keyring.delete_password')
    def test_delete_api_key_success(self, mock_delete_password):
        """
        Test that the delete_api_key method successfully calls keyring.delete_password
        with the correct parameters.
        """
        # Call the method under test
        self.config_manager.delete_api_key()

        # Assert that keyring.delete_password was called once with the correct arguments
        mock_delete_password.assert_called_once_with('TestStandupApp', 'api_key')

    @patch('keyring.delete_password')
    def test_delete_api_key_error(self, mock_delete_password):
        """
        Test that the delete_api_key method prints an error message
        and exits with sys.exit(1) when keyring.delete_password fails.
        """
        # Setup the mock to raise an exception when called
        mock_delete_password.side_effect = Exception('Failed to delete the key')

        # Use StringIO object to capture stdout
        with patch('sys.stdout', new=StringIO()) as fake_out:
            # Expect SystemExit to be raised due to sys.exit(1) in the method
            with self.assertRaises(SystemExit) as cm:
                self.config_manager.delete_api_key()

            # Check the exit code
            self.assertEqual(cm.exception.code, 1)

            # Check that the expected error message was printed to stdout
            self.assertIn("Failed to remove the key: Failed to delete the key", fake_out.getvalue())

if __name__ == '__main__':
    unittest.main()
