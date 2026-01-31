# src/data_gathering_crew/crew.py
from crewai import Agent, Crew, Task, Process
from crewai.project import CrewBase, agent, crew, task

@CrewBase
class DataGatheringCrew():
    """Crew for extracting data from PDF documents"""

    agents_config = "src/data_gathering_crew/config/agents.yaml"
    tasks_config = "src/data_gathering_crew/config/tasks.yaml"

    @agent
    def data_extractor(self) -> Agent:
        return Agent(config=self.agents_config['data_extractor'], verbose=True)

    @agent
    def link_creator(self) -> Agent:
        return Agent(config=self.agents_config['link_creator'], verbose=True)

    @task
    def extract_lineage_details_task(self) -> Task:
        return Task(config=self.tasks_config['extract_lineage_details_task'])

    @task
    def generate_relationships_task(self) -> Task:
        return Task(config=self.tasks_config['generate_relationships_task'], context=[self.extract_lineage_details_task])

    @crew
    def crew(self) -> Crew:
        """Creates the Data Gathering crew"""
        return Crew(
            agents=[
                self.data_extractor(),
                self.link_creator()
            ],
            tasks=[
                self.extract_lineage_details_task(),
                self.generate_relationships_task()
            ],
            process=Process.sequential,
            verbose=True,
        )