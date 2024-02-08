## main.py
import click
from geekbot_cli.cli import CLI
from geekbot_cli.api_client import APIClient
from geekbot_cli.config_manager import ConfigManager

@click.command()
@click.version_option(version='1.0.0')
def main():
    """
    The main function that sets up the CLI and starts the interaction.
    """
    # Create instances of the API client and the configuration manager
    api_client = APIClient()
    config_manager = ConfigManager()
    
    # Create the CLI instance with the API client and configuration manager
    cli = CLI(api_client, config_manager)
    
    # Start the CLI workflow
    cli.start()

if __name__ == '__main__':
    main()
