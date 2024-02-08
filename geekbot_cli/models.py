## models.py

class Standup:
    """
    Represents a standup with its ID, name, and list of questions.
    """
    def __init__(self, id: int, name: str, questions: list):
        """
        Initializes a new instance of the Standup class.

        Args:
            id: The unique identifier for the standup.
            name: The name of the standup.
            questions: A list of Question instances representing the questions for the standup.
        """
        self._id = id
        self._name = name
        self._questions = questions

    def to_dict(self) -> dict:
        """
        Converts the Standup instance into a dictionary.

        Returns:
            A dictionary representation of the Standup instance.
        """
        return {
            'id': self._id,
            'name': self._name,
            'questions': [question.to_dict() for question in self._questions]
        }


class Question:
    """
    Represents a question within a standup.
    """
    def __init__(self, id: int, text: str, color: str, answer_type: str, answer_choices: list):
        """
        Initializes a new instance of the Question class.

        Args:
            id: The unique identifier for the question.
            text: The text of the question.
        """
        self._id = id
        self._text = text
        self._color = color
        self._answer_type = answer_type
        self._answer_choices = answer_choices

    def to_dict(self) -> dict:
        """
        Converts the Question instance into a dictionary.

        Returns:
            A dictionary representation of the Question instance.
        """
        return {
            'id': self._id,
            'text': self._text,
            'color': self._color,
            'answer_type': self._answer_type,
            'answer_choices': self._answer_choices
        }
