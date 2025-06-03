# Data Gathering Crew Configuration Directory

## Purpose

This directory is designated for storing configuration files that define the setup and operation of the data gathering crew. These configurations likely include settings for AI agents, the tasks they need to perform, and other parameters that dictate how the crew functions to achieve its data collection objectives.

## Important Files

The primary configuration files in this directory are:

- **`agents.yaml`**: This file typically defines the different AI agents that are part of the crew. It might include their roles, goals, backstories, specific tools they can use, and any other agent-level configurations (e.g., LLM settings, verbosity).
- **`tasks.yaml`**: This file outlines the tasks that the crew needs to accomplish. Each task definition might include a description, the expected output, which agent(s) are assigned to it, and any specific parameters or context for that task.

## Interaction

The configuration files within this directory (primarily `agents.yaml` and `tasks.yaml`) are read and parsed by the main script of the data gathering crew (e.g., a `crew.py` or `main.py` located in the parent directory or an entry point script).

This script uses the information from these YAML files to:
- Instantiate and initialize the defined AI agents.
- Create and assign the specified tasks.
- Set up the overall workflow and orchestration of the crew.

The settings in these files are crucial as they directly determine the composition, behavior, and objectives of the data gathering crew.

## Usage

These YAML files (`agents.yaml`, `tasks.yaml`) are intended to be edited manually to customize and fine-tune the data gathering process. By modifying these files, users can:

- Add, remove, or modify AI agents.
- Change agent roles, goals, or specific tool access.
- Define new tasks or alter existing ones.
- Adjust parameters for how tasks are executed.

Care should be taken when editing these files to ensure the YAML syntax is valid and the configuration aligns with the capabilities of the crew's underlying framework (e.g., CrewAI).
