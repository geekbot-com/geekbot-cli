import click
from geekbot_cli.api_client import APIClient
from geekbot_cli.config_manager import ConfigManager
from geekbot_cli.cli import CLI
import sys
import json

git_json = 'geekbot_cli/git_directories.json'

@click.command()
@click.option('--clear-api-key', is_flag=True, help='Removes the saved API key from keyring')
def main(clear_api_key):
    """
    Entry point for the CLI that can now handle `--clear-api-key` to remove the saved API key.
    """
    config_manager = ConfigManager()
    
    try:
        config_manager.load_git_directories_from_file(git_json)
    except FileNotFoundError:
        click.echo(f"Git directories JSON file not found at {git_json}.", err=True)
        sys.exit(1)
    except json.JSONDecodeError:
        click.echo(f"Invalid JSON format in file {git_json}.", err=True)
        sys.exit(1)
    except Exception as e:
        click.echo(f"Failed to load git directories: {e}", err=True)
        sys.exit(1)

    if clear_api_key:
        # If --clear-api-key was passed, ask for confirmation before clearing the API key
        # Explicitly include 'yes/no' in the prompt
        if click.confirm('Are you sure you want to remove the API key?'):
            config_manager.delete_api_key()
            click.echo("API key has been removed.")
        else:
            click.echo("Operation cancelled.")
    else:
        # Normal CLI operation
        try:
            api_client = APIClient()
            cli = CLI(api_client, config_manager)
            cli.start()
        except Exception as e:
            click.echo(f"Error: {e}")
            sys.exit(1)

if __name__ == '__main__':
    main()