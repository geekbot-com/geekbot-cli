## api_client.py
import requests
from geekbot_cli.exceptions import (
    StandupAPIError,
    StandupValidationError,
    InvalidAPIKeyError,
    StandupNotFoundError
)
from typing import List, Dict

class APIClient:
    """
    Manages HTTP communication with the standup service.
    """
    def __init__(self, base_url: str = 'https://api.geekbot.com'):
        self.base_url = base_url
        self.headers = {'Content-Type': 'application/json'}

    def get_standups(self) -> List[Dict]:
        """
        Retrieves a list of available standups from the service.

        Returns:
            A list of standup dictionaries.

        Raises:
            StandupAPIError: If the API call fails.
        """
        try:
            response = requests.get(f"{self.base_url}/v1/standups", headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            raise StandupAPIError(f"HTTP error occurred: {e} ")
        except requests.exceptions.RequestException as e:
            raise StandupAPIError(f"Error occurred during the API call: {e}")

    def post_report(self, standup_id: int, answers: List[Dict]) -> Dict:
        """
        Posts a standup report to the service.

        Args:
            standup_id: The ID of the standup to report on.
            answers: A list of answer dictionaries.

        Returns:
            A dictionary containing the response from the service.

        Raises:
            StandupValidationError: If the validation of the report fails.
            InvalidAPIKeyError: If the API key provided is invalid.
            StandupAPIError: If the API call fails.
        """
        try:
            payload = {
                'standup_id': standup_id,
                'answers': answers
            }
            response = requests.post(f"{self.base_url}/v1/reports", json=payload, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            status_code = e.response.status_code
            if status_code == 400:
                raise StandupValidationError(f"Validation error: {e} {payload}")
            elif status_code == 401:
                raise InvalidAPIKeyError(f"Invalid API key: {e}")
            elif status_code == 404:
                raise StandupNotFoundError(f"Standup not found: {e}")
            elif status_code >= 500:
                raise StandupAPIError(f"Server error: {e}")
            else:
                raise StandupAPIError(f"HTTP error occurred: {e}")
        except requests.exceptions.RequestException as e:
            raise StandupAPIError(f"Error occurred during the API call: {e}")

    def set_headers(self, api_key: str) -> None:
        """
        Sets the authorization headers for the API client.

        Args:
            api_key: The API key to be used for authorization.
        
        Raises:
            InvalidAPIKeyError: If the API key is invalid.
        """
        if not isinstance(api_key, str) or not api_key:
            raise InvalidAPIKeyError("Invalid API key provided.")
        self.headers['Authorization'] = f"Bearer {api_key}"
