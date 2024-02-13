## main.py
import click
import sys
from geekbot_cli.cli import CLI
from geekbot_cli.api_client import APIClient
from geekbot_cli.config_manager import ConfigManager
from geekbot_cli.exceptions import APIKeyNotFoundError, StandupException

@click.command()
@click.version_option(version='1.0.0')
def main():
    """
    The main function that sets up the CLI and starts the interaction.
    """
    try:
        # Create instances of the API client and the configuration manager
        api_client = APIClient()
        config_manager = ConfigManager()

        # Create the CLI instance with the API client and configuration manager
        cli = CLI(api_client, config_manager)

        # Start the CLI workflow
        cli.start()

    except APIKeyNotFoundError as e:
        click.echo("Error: API key not found. Please configure your API key.")
        sys.exit(1)
    except StandupException as e:
        click.echo("Error: A standup exception occurred.")
        sys.exit(1)

if __name__ == '__main__':
    main()