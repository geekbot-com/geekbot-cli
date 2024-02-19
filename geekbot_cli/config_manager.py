import keyring
from geekbot_cli.exceptions import APIKeyNotFoundError
import sys
import json
import os

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
        
    def delete_api_key(self, username: str = 'api_key') -> None:
        """
        Deletes a stored API key from the system's keyring.

        Args:
            username (str): The username or key identifier. Defaults to 'api_key'.
        """
        try:
            keyring.delete_password(self.service_name, username)
        except Exception as e:
            print(f"Failed to remove the key: {e}")
            sys.exit(1)

    def get_git_directories(self) -> list:
        """
        Retrieves the git directories from the system's secure key storage.
        
        Returns:
            A list of directories if they exist, otherwise an empty list.
        """
        try:
            git_dirs = keyring.get_password(self.service_name, 'git_directories')
            if git_dirs is None:
                return []
            return json.loads(git_dirs)
        except keyring.errors.KeyringError as e:
            raise RuntimeError(f"Error accessing keyring: {e}")

    def save_git_directories(self, directories: list) -> None:
        """
        Saves the git directories to the system's secure key storage.
        
        Args:
            directories: A list of directory paths to be saved.
        """
        try:
            git_dirs_str = json.dumps(directories)
            keyring.set_password(self.service_name, 'git_directories', git_dirs_str)
        except keyring.errors.KeyringError as e:
            raise RuntimeError(f"Error accessing keyring: {e}")

    def load_git_directories_from_file(self, file_path: str) -> None:
        """
        Loads git directories from a JSON file and saves them in the system's secure key storage.

        Args:
            file_path: The path to the JSON file containing the git directories.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"The file {file_path} does not exist.")
        
        with open(file_path, 'r') as f:
            try:
                data = json.load(f)
                git_directories = data.get('git_directories', [])
                if not isinstance(git_directories, list):
                    raise ValueError("The 'git_directories' key must contain a list.")
                self.save_git_directories(git_directories)
            except json.JSONDecodeError as e:
                raise json.JSONDecodeError(f"Error decoding JSON: {e}")