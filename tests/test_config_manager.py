## test_config_manager.py
import unittest
from unittest.mock import patch
from geekbot_cli.config_manager import ConfigManager
from geekbot_cli.exceptions import APIKeyNotFoundError

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

if __name__ == '__main__':
    unittest.main()
