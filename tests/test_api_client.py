## test_api_client.py
import unittest
from unittest.mock import patch, Mock
import requests
from geekbot_cli.api_client import APIClient
from geekbot_cli.exceptions import StandupAPIError, StandupValidationError, InvalidAPIKeyError, StandupNotFoundError

class TestAPIClient(unittest.TestCase):
    def setUp(self):
        self.api_client = APIClient(base_url='https://api.teststandup.example.com')

    @patch('requests.get')
    def test_get_standups_success(self, mock_get):
        mock_response = Mock()
        expected_standups = [
            {'id': 1, 'name': 'Morning Standup', 'questions': []},
            {'id': 2, 'name': 'Evening Standup', 'questions': []}
        ]
        mock_response.json.return_value = expected_standups
        mock_response.raise_for_status = Mock()
        mock_get.return_value = mock_response

        standups = self.api_client.get_standups()
        self.assertEqual(standups, expected_standups)
        mock_get.assert_called_once_with('https://api.teststandup.example.com/v1/standups', headers=self.api_client.headers)

    @patch('requests.get')
    def test_get_standups_api_error(self, mock_get):
        mock_get.side_effect = requests.exceptions.HTTPError()
        with self.assertRaises(StandupAPIError):
            self.api_client.get_standups()

    @patch('requests.post')
    def test_post_report_success(self, mock_post):
        mock_response = Mock()
        expected_response = {'success': True, 'message': 'Report submitted successfully'}
        mock_response.json.return_value = expected_response
        mock_response.raise_for_status = Mock()
        mock_post.return_value = mock_response

        answers = [{'id': 1, 'text': 'Answer 1'}]
        response = self.api_client.post_report(1, answers)
        self.assertEqual(response, expected_response)
        mock_post.assert_called_once_with(
            'https://api.teststandup.example.com/v1/reports',
            json={'standup_id': 1, 'answers': answers},
            headers=self.api_client.headers
        )

    @patch('requests.post')
    def test_post_report_validation_error(self, mock_post):
        mock_response = Mock()
        mock_response.status_code = 400
        mock_post.side_effect = requests.exceptions.HTTPError(response=mock_response)
        with self.assertRaises(StandupValidationError):
            self.api_client.post_report(1, [{'id': 1, 'text': ''}])  # Empty answer text

    @patch('requests.post')
    def test_post_report_invalid_api_key_error(self, mock_post):
        mock_response = Mock()
        mock_response.status_code = 401
        mock_post.side_effect = requests.exceptions.HTTPError(response=mock_response)
        with self.assertRaises(InvalidAPIKeyError):
            self.api_client.post_report(1, [{'id': 1, 'text': 'Answer 1'}])

    @patch('requests.post')
    def test_post_report_not_found_error(self, mock_post):
        mock_response = Mock()
        mock_response.status_code = 404
        mock_post.side_effect = requests.exceptions.HTTPError(response=mock_response)
        with self.assertRaises(StandupNotFoundError):
            self.api_client.post_report(999, [{'id': 1, 'text': 'Answer 1'}])  # Non-existent standup ID

    @patch('geekbot_cli.api_client.requests.post')
    def test_post_report_api_error(self, mock_post):
        # Setup the mock to raise HTTPError with a specific status code
        mock_response = Mock()
        mock_response.raise_for_status.side_effect = requests.exceptions.HTTPError("Error message", response=Mock(status_code=500))
        mock_post.return_value = mock_response

        client = APIClient()

        with self.assertRaises(StandupAPIError):
            client.post_report(1, [{'question_id': 1, 'answer': 'Test answer'}])

    def test_set_headers_invalid_key(self):
        with self.assertRaises(InvalidAPIKeyError):
            self.api_client.set_headers('')  # Empty API key

        with self.assertRaises(InvalidAPIKeyError):
            self.api_client.set_headers(None)  # None API key

        with self.assertRaises(InvalidAPIKeyError):
            self.api_client.set_headers(123)  # Non-string API key

    def test_set_headers_valid_key(self):
        valid_api_key = 'valid_api_key'
        self.api_client.set_headers(valid_api_key)
        # Corrected to match the expected format with "Bearer" prefix
        self.assertEqual(self.api_client.headers['Authorization'], f"Bearer {valid_api_key}")

if __name__ == '__main__':
    unittest.main()
