## exceptions.py

class StandupException(Exception):
    """
    Base exception class for standup-related errors.
    """
    def __init__(self, message: str):
        super().__init__(message)


class APIKeyNotFoundError(StandupException):
    """
    Exception raised when the API key is not found.
    """
    def __init__(self, message: str = "API key not found."):
        super().__init__(message)


class InvalidAPIKeyError(StandupException):
    """
    Exception raised when the API key is invalid.
    """
    def __init__(self, message: str = "Invalid API key provided."):
        super().__init__(message)


class StandupNotFoundError(StandupException):
    """
    Exception raised when the specified standup is not found.
    """
    def __init__(self, message: str = "Standup not found."):
        super().__init__(message)


class StandupAPIError(StandupException):
    """
    Exception raised for errors that occur during API calls.
    """
    def __init__(self, message: str = "Error occurred during an API call."):
        super().__init__(message)


class StandupValidationError(StandupException):
    """
    Exception raised for validation errors when processing standup reports.
    """
    def __init__(self, message: str = "Validation error in standup report."):
        super().__init__(message)
