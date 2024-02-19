# git_integration.py

import os
import subprocess
from typing import List, Dict

class GitIntegration:
    def __init__(self):
        """
        Initializes an instance of GitIntegration.
        """
        pass  # Add any initialization logic here if necessary

    def find_git_repos(self, base_dirs: List[str]) -> List[str]:
        """
        Recursively searches for git repositories in the given base directories.

        Args:
            base_dirs: A list of directory paths to search for git repositories.

        Returns:
            A list of paths to the found git repositories.
        """
        git_repos = []
        for base_dir in base_dirs:
            for root, dirs, files in os.walk(base_dir):
                if '.git' in dirs:
                    git_repos.append(root)
                    dirs.remove('.git')  # Prevent further exploration into the .git folder
        return git_repos

    def get_recent_commits(self, repo_path: str, max_count: int = 5) -> List[Dict[str, str]]:
        """
        Retrieves the most recent commits from the specified git repository.

        Args:
            repo_path: The file path to the git repository.
            max_count: Maximum number of commits to retrieve.

        Returns:
            A list of dictionaries with each containing the commit hash and message.
        """
        try:
            log_format = "%H|%s"
            result = subprocess.run(
                ["git", "-C", repo_path, "log", f"--pretty=format:{log_format}", f"-{max_count}"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True
            )
            commits = [line.split('|') for line in result.stdout.strip().split('\n')]
            return [{'hash': commit[0], 'message': commit[1]} for commit in commits]
        except subprocess.CalledProcessError as e:
            print(f"Error retrieving commits: {e.stderr}")
            return []