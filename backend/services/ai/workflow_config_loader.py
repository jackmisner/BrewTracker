"""
Workflow configuration loader for flowchart-based AI system.

This module provides utilities for loading and managing workflow configurations
from YAML and JSON files.
"""

import os
import yaml
import json
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)


class WorkflowConfigLoader:
    """
    Handles loading and caching of workflow configurations.
    """
    
    def __init__(self, config_directory: Optional[str] = None):
        """
        Initialize the config loader.
        
        Args:
            config_directory: Directory containing workflow config files.
                            Defaults to backend/services/ai/workflows/
        """
        if config_directory is None:
            # Default to workflows directory relative to this file
            current_dir = os.path.dirname(__file__)
            config_directory = os.path.join(current_dir, 'workflows')
        
        self.config_directory = config_directory
        self.cached_configs: Dict[str, Dict[str, Any]] = {}
        
        # Ensure config directory exists
        os.makedirs(config_directory, exist_ok=True)
    
    def load_workflow(self, workflow_name: str) -> Dict[str, Any]:
        """
        Load a workflow configuration by name.
        
        Args:
            workflow_name: Name of the workflow (without file extension)
            
        Returns:
            Workflow configuration dictionary
            
        Raises:
            FileNotFoundError: If workflow file not found
            ValueError: If workflow configuration is invalid
        """
        # Check cache first
        if workflow_name in self.cached_configs:
            logger.debug(f"Loading cached workflow: {workflow_name}")
            return self.cached_configs[workflow_name]
        
        # Try to load from file
        config = None
        
        # Try YAML first
        yaml_path = os.path.join(self.config_directory, f"{workflow_name}.yaml")
        if os.path.exists(yaml_path):
            config = self._load_yaml(yaml_path)
        else:
            # Try JSON
            json_path = os.path.join(self.config_directory, f"{workflow_name}.json")
            if os.path.exists(json_path):
                config = self._load_json(json_path)
        
        if config is None:
            raise FileNotFoundError(f"Workflow '{workflow_name}' not found in {self.config_directory}")
        
        # Validate basic structure
        self._validate_workflow_config(config, workflow_name)
        
        # Cache and return
        self.cached_configs[workflow_name] = config
        logger.info(f"Loaded workflow: {workflow_name}")
        return config
    
    def _load_yaml(self, file_path: str) -> Dict[str, Any]:
        """Load workflow from YAML file."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        except Exception as e:
            logger.error(f"Error loading YAML from {file_path}: {e}")
            raise
    
    def _load_json(self, file_path: str) -> Dict[str, Any]:
        """Load workflow from JSON file."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading JSON from {file_path}: {e}")
            raise
    
    def _validate_workflow_config(self, config: Dict[str, Any], workflow_name: str):
        """Validate basic workflow configuration structure."""
        required_fields = ['workflow_name', 'start_node', 'nodes']
        
        for field in required_fields:
            if field not in config:
                raise ValueError(f"Workflow '{workflow_name}' missing required field: {field}")
        
        nodes = config['nodes']
        start_node = config['start_node']
        
        if not isinstance(nodes, dict):
            raise ValueError(f"Workflow '{workflow_name}' 'nodes' must be a dictionary")
        
        if start_node not in nodes:
            raise ValueError(f"Workflow '{workflow_name}' start_node '{start_node}' not found in nodes")
        
        # Validate each node has required fields
        for node_id, node_config in nodes.items():
            if 'type' not in node_config:
                raise ValueError(f"Node '{node_id}' missing required field: type")
    
    def list_available_workflows(self) -> List[str]:
        """List all available workflow names in the config directory."""
        workflows = []
        
        if not os.path.exists(self.config_directory):
            return workflows
        
        for filename in os.listdir(self.config_directory):
            if filename.endswith(('.yaml', '.yml', '.json')):
                workflow_name = os.path.splitext(filename)[0]
                workflows.append(workflow_name)
        
        return sorted(workflows)
    
    def reload_workflow(self, workflow_name: str) -> Dict[str, Any]:
        """Force reload a workflow from file, bypassing cache."""
        if workflow_name in self.cached_configs:
            del self.cached_configs[workflow_name]
        return self.load_workflow(workflow_name)
    
    def clear_cache(self):
        """Clear all cached workflows."""
        self.cached_configs.clear()
        logger.info("Workflow cache cleared")
    
    def save_workflow(self, workflow_name: str, config: Dict[str, Any], format: str = 'yaml'):
        """
        Save a workflow configuration to file.
        
        Args:
            workflow_name: Name of the workflow
            config: Workflow configuration dictionary
            format: File format ('yaml' or 'json')
        """
        # Validate before saving
        self._validate_workflow_config(config, workflow_name)
        
        if format.lower() == 'yaml':
            file_path = os.path.join(self.config_directory, f"{workflow_name}.yaml")
            with open(file_path, 'w', encoding='utf-8') as f:
                yaml.dump(config, f, default_flow_style=False, indent=2)
        elif format.lower() == 'json':
            file_path = os.path.join(self.config_directory, f"{workflow_name}.json")
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2)
        else:
            raise ValueError(f"Unsupported format: {format}")
        
        # Update cache
        self.cached_configs[workflow_name] = config
        logger.info(f"Saved workflow: {workflow_name} ({format})")


# Global config loader instance
_config_loader: Optional[WorkflowConfigLoader] = None


def get_config_loader(config_directory: Optional[str] = None) -> WorkflowConfigLoader:
    """Get the global workflow config loader instance."""
    global _config_loader
    if _config_loader is None:
        _config_loader = WorkflowConfigLoader(config_directory)
    return _config_loader


def load_workflow(workflow_name: str) -> Dict[str, Any]:
    """Convenience function to load a workflow using the global loader."""
    return get_config_loader().load_workflow(workflow_name)


def list_workflows() -> List[str]:
    """Convenience function to list available workflows."""
    return get_config_loader().list_available_workflows()