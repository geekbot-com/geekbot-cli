"""Setup script for Geekbot-CLI."""
from pathlib import Path

from setuptools import Command, find_packages, setup
from setuptools.command.install import install as _install

here = Path(__file__).resolve().parent
long_description = (here / "README.md").read_text(encoding="utf-8")
requirements = (here / "requirements.txt").read_text(encoding="utf-8").splitlines()

class install(_install):
    def run(self):
        _install.run(self)  # Call the original `install` command
        print("Thank you for installing Geekbot!")
        print("Run the application using the following command:")
        print("$ geekbot")
        print("For issues/contributions please visit our Github:")
        print("https://github.com/geekbot-com/geekbot-cli")
        

setup(
    name="geekbot_cli",
    # Do not change version. It will be changed from ./github/workflows/pypi-release.yml
    version='0.0.1',
    description="Interact with Geekbot through terminal",
    long_description=long_description,
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
    cmdclass={
        'install': install,
    },
)