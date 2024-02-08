"""Setup script for Geekbot-CLI."""
from pathlib import Path

from setuptools import Command, find_packages, setup

here = Path(__file__).resolve().parent
long_description = (here / "README.md").read_text(encoding="utf-8")
requirements = (here / "requirements.txt").read_text(encoding="utf-8").splitlines()

setup(
    name="geekbot_cli",
    version="0.1",
    description="Interact with Geekbot through terminal",
    long_description_content_type="text/markdown",
    url="https://github.com/geekbot-com/geekbot-cli",
    author="The Geekbot team",
    author_email="hey@geekbot.io",
    license="MIT",
    keywords="geekbot standup workflow",
    packages=find_packages(exclude=["tests*"]),
    install_requires=requirements,
    entry_points={
        'console_scripts': [
            'geekbot=geekbot_cli.main:main',
        ],
    },
)