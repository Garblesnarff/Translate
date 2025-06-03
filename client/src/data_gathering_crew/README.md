# Data Gathering Crew

## Purpose

This directory contains the implementation of a "data gathering crew," likely built using a framework such as CrewAI. This system employs AI agents to automate tasks related to data collection, research, analysis, and processing based on predefined configurations.

The goal is to create an autonomous or semi-autonomous workforce that can perform complex data gathering operations.

## Important Files/Directories

- **`config/`**: This subdirectory holds configuration files, primarily `agents.yaml` and `tasks.yaml`. These files define the AI agents, their roles, goals, and the specific tasks the crew needs to accomplish. See the `README.md` within the `config/` directory for more details.
- **`crew.py`**: This Python script is likely responsible for defining the crew's structure. It probably includes the logic for instantiating agents, defining tasks based on the configurations, and setting up the overall crew orchestration (e.g., sequential or hierarchical task execution).
- **`main.py`**: This Python script typically serves as the main entry point to run the data gathering crew. It loads the configurations, initializes the crew using `crew.py`, and kicks off the task execution process.

## Interaction

The system generally operates as follows:
1. The `main.py` script is executed.
2. `main.py` loads the agent and task definitions from the YAML files located in the `config/` directory.
3. It then uses the definitions and logic in `crew.py` to assemble the crew, instantiate the AI agents, and assign them their respective tasks.
4. The crew begins its work, with agents collaborating and executing tasks as defined.
5. The results of the crew's operations (e.g., collected data, reports, analyses) might be outputted to files, logged, or potentially passed to other parts of the broader application for further use or display.

## Usage

To run the data gathering crew, you would typically execute the `main.py` script from within this directory or a relevant parent directory, ensuring the Python environment has the necessary dependencies (like CrewAI and any tools the agents might use).

Example command:

```bash
# Navigate to the directory if needed
# cd client/src/data_gathering_crew

# Ensure your Python virtual environment is activated if you use one
# source .venv/bin/activate

python main.py
```

Before running, ensure that the `config/agents.yaml` and `config/tasks.yaml` files are properly configured for the desired data gathering operation. Any API keys or credentials required by the agents' tools should also be set up in the environment as needed.
