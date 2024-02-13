## cli.py
import click
from rich.prompt import Prompt
from geekbot_cli.api_client import APIClient
from geekbot_cli.config_manager import ConfigManager
from geekbot_cli.exceptions import StandupException, APIKeyNotFoundError
from geekbot_cli.models import Standup, Question
from typing import List, Dict

from rich.console import Console
from rich.columns import Columns
from rich.panel import Panel
from prompt_toolkit.shortcuts import radiolist_dialog


console = Console()

def get_multiline_input(prompt_color, answer_type):
    lines = []
    while True:
        console.print("[#" + prompt_color + "]> [/#" + prompt_color + "]", end="")
        line = input("")
        if answer_type == 'numeric':
            while not line.isdigit():
                console.print("[red]Please input a number[/red]")
                console.print("[#" + prompt_color + "]> [/#" + prompt_color + "]", end="")
                line = input("")
            return line    
                
        if line == "":
            break  # Finish on empty input
        lines.append(line)
    return "\n".join(lines)

def get_table_item(standup, index):
    """Extract text from standups to display in table."""
    return f"[b]({index+1}[/b])\n[yellow]{standup['name']}"

class CLI:

    def _(event):
        """
        Insert a newline without submitting when Shift+Enter is pressed.
        """
        event.current_buffer.insert_text('\n')

    def __init__(self, api_client: APIClient, config_manager: ConfigManager):
        self.api_client = api_client
        self.config_manager = config_manager

    def start(self) -> None:
        """
        Entry point for the CLI. Manages the workflow of the standup reporting process.
        """
        try:
            api_key = self.config_manager.get_api_key()

        except APIKeyNotFoundError  as e:
            console.print("Please enter your API key. Get one here:")
            console.print("https://app.geekbot.com/dashboard/api-webhooks", style="link https://app.geekbot.com/dashboard/api-webhooks")
            api_key = Prompt.ask("API key: ", password=True)
            self.config_manager.save_api_key(api_key)

        try:
            self.api_client.set_headers(api_key)
            standups = self.api_client.get_standups()
            selected_standup = self.select_standup(standups)
            if selected_standup:
                answers = self.input_answers(selected_standup['questions'])
                report_response = self.send_report(selected_standup['id'], answers)
                if report_response['done_at'] > 0:
                    console.print(f"Report submitted successfully! Check #{report_response['channel']}", style="green")
                else:
                    console.print(f"Report could not be saved")
                
            else:
                console.print("No standup selected.", style="yellow")
        except StandupException as e:
            console.print(f"An error occurred: {e}", style="red")

    def select_standup(self, standups: List[Dict]) -> Dict:
        """
        Displays a list of standups and prompts the user to select one.

        Args:
            standups: A list of standup dictionaries.

        Returns:
            The selected standup dictionary or None if no selection is made.
        """
        console.print("Please select a standup to report on:", style="bold")
        renderables = [Panel(get_table_item(standup, index), expand=True) for index, standup in enumerate(standups)]
        console.print(Columns(renderables))
        selected_index = Prompt.ask("Enter the number of the standup", default="0", show_choices=False)
        try:
            selected_index = int(selected_index) - 1
            name = standups[selected_index]['name']
            console.print("Starting [i]" + name + "[/i]")
            url = "https://app.geekbot.com/dashboard/w/" + str(standups[selected_index]['id'])
            console.print(url, style="link " + url)
            if 0 <= selected_index <= len(standups):
                return standups[selected_index]
        except ValueError:
            console.print("Invalid selection. Please enter a number.", style="red")
        return None

    def input_answers(self, questions: List[Dict]) -> List[Dict]:
        """
        Prompts the user to answer each question for the selected standup.

        Args:
            questions: A list of question dictionaries.

        Returns:
            A list of answer dictionaries.
        """
        answers = {}
        for question in questions:
            console.print("[#" + question['color'] + "]| [/#" + question['color'] + "]" + question['text'], style="bold")
            if question['answer_type'] == 'text' or question['answer_type'] == 'numeric':
                answer = get_multiline_input(question['color'], question['answer_type'])
            elif question['answer_type'] == 'multiple_choice':
                # todo: This method will create a fullscreen window in order to get user's selection
                #  It should be displayed right after the question
                #  If this isn't possible, here is an alternative approach: https://python-prompt-toolkit.readthedocs.io/en/master/pages/asking_for_input.html#autocompletion
                dialog_choices = []
                for q in question['answer_choices']:
                    dialog_choices.append((q, q))

                answer = radiolist_dialog(
                    title="Choose one",
                    text=question['text'],
                    values=dialog_choices
                ).run()
            else:
                # todo: raise exception
                console.print("Unhandled question type: " + question['answer_type'])
            answers[question['id']] ={'text': answer}
        return answers

    def send_report(self, standup_id: int, answers: List[Dict]) -> Dict:
        """
        Sends the standup report to the service.

        Args:
            standup_id: The ID of the standup to report on.
            answers: A list of answer dictionaries.

        Returns:
            A dictionary containing the response from the service.
        """
        return self.api_client.post_report(standup_id, answers)

@click.command()
@click.version_option(version='1.0.0')
def main():
    """
    The main function that sets up the CLI and starts the interaction.
    """
    api_client = APIClient()
    config_manager = ConfigManager()
    cli = CLI(api_client, config_manager)
    cli.start()

if __name__ == '__main__':
    main()
