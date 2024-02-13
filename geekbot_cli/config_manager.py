import keyring
from geekbot_cli.exceptions import APIKeyNotFoundError

class ConfigManager:
    """
    Handles API key storage and retrieval using the system's secure key storage.
    """
    def __init__(self, service_name: str = 'Geekbot-CLI'):
        self.service_name = service_name

    def get_api_key(self) -> str:
        """
        Retrieves the API key from the system's secure key storage.
        
        Returns:
            The API key if it exists, otherwise raises APIKeyNotFoundError.
        
        Raises:
            APIKeyNotFoundError: If the API key is not found in the keyring.
            RuntimeError: If there is an error accessing the keyring.
        """
        try:
            api_key = keyring.get_password(self.service_name, 'api_key')
            if api_key is None:
                raise APIKeyNotFoundError("API key not found in keyring.")
            return api_key
        except keyring.errors.KeyringError as e:
            raise RuntimeError(f"Error accessing keyring: {e}")

    def save_api_key(self, api_key: str) -> None:
        """
        Saves the API key to the system's secure key storage.
        
        Args:
            api_key: The API key to be saved.
        
        Raises:
            RuntimeError: If there is an error accessing the keyring.
        """
        try:
            keyring.set_password(self.service_name, 'api_key', api_key)
        except keyring.errors.KeyringError as e:
            raise RuntimeError(f"Error accessing keyring: {e}")
        
