"""
Tests for WorkflowConfigLoader

Tests the workflow configuration loading and management system including
YAML/JSON file loading, caching, validation, and configuration management.
"""

import json
import os
import tempfile
from unittest.mock import MagicMock, mock_open, patch

import pytest
import yaml

from services.ai.workflow_config_loader import (
    WorkflowConfigLoader,
    get_config_loader,
    list_workflows,
    load_workflow,
)


# Shared fixtures for all test classes
@pytest.fixture
def temp_config_dir():
    """Create a temporary config directory for testing"""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield temp_dir


@pytest.fixture
def valid_workflow_config():
    """Valid workflow configuration for testing"""
    return {
        "workflow_name": "Test Workflow",
        "description": "A test workflow",
        "version": "1.0",
        "start_node": "start",
        "nodes": {
            "start": {"type": "analysis", "next": "end"},
            "end": {"type": "result"},
        },
    }


@pytest.fixture
def loader(temp_config_dir):
    """Create a WorkflowConfigLoader instance with temp directory"""
    return WorkflowConfigLoader(temp_config_dir)


class TestWorkflowConfigLoader:
    """Test WorkflowConfigLoader class"""

    def test_init_with_custom_directory(self, temp_config_dir):
        """Test initialization with custom config directory"""
        loader = WorkflowConfigLoader(temp_config_dir)
        assert loader.config_directory == temp_config_dir
        assert loader.cached_configs == {}

    def test_init_with_default_directory(self):
        """Test initialization with default config directory"""
        with patch("os.makedirs") as mock_makedirs:
            loader = WorkflowConfigLoader()

            # Should use default relative path
            expected_path = os.path.join(
                os.path.dirname(__file__).replace("tests", "services/ai"), "workflows"
            )
            expected_path = expected_path.replace("test_workflow_config_loader.py/", "")

            # Directory should be created
            mock_makedirs.assert_called_once()

    def test_load_workflow_yaml_success(
        self, loader, temp_config_dir, valid_workflow_config
    ):
        """Test successful YAML workflow loading"""
        # Create YAML file
        yaml_path = os.path.join(temp_config_dir, "test_workflow.yaml")
        with open(yaml_path, "w") as f:
            yaml.dump(valid_workflow_config, f)

        result = loader.load_workflow("test_workflow")

        assert result == valid_workflow_config
        assert "test_workflow" in loader.cached_configs
        assert loader.cached_configs["test_workflow"] == valid_workflow_config

    def test_load_workflow_json_success(
        self, loader, temp_config_dir, valid_workflow_config
    ):
        """Test successful JSON workflow loading"""
        # Create JSON file
        json_path = os.path.join(temp_config_dir, "test_workflow.json")
        with open(json_path, "w") as f:
            json.dump(valid_workflow_config, f)

        result = loader.load_workflow("test_workflow")

        assert result == valid_workflow_config
        assert "test_workflow" in loader.cached_configs

    def test_load_workflow_from_cache(self, loader, valid_workflow_config):
        """Test loading workflow from cache"""
        # Pre-populate cache
        loader.cached_configs["cached_workflow"] = valid_workflow_config

        with patch("os.path.exists", return_value=False):  # No files exist
            result = loader.load_workflow("cached_workflow")

        assert result == valid_workflow_config

    def test_load_workflow_prefers_yaml_over_json(
        self, loader, temp_config_dir, valid_workflow_config
    ):
        """Test that YAML is preferred over JSON when both exist"""
        yaml_config = valid_workflow_config.copy()
        yaml_config["source"] = "yaml"

        json_config = valid_workflow_config.copy()
        json_config["source"] = "json"

        # Create both files
        yaml_path = os.path.join(temp_config_dir, "test_workflow.yaml")
        json_path = os.path.join(temp_config_dir, "test_workflow.json")

        with open(yaml_path, "w") as f:
            yaml.dump(yaml_config, f)
        with open(json_path, "w") as f:
            json.dump(json_config, f)

        result = loader.load_workflow("test_workflow")

        # Should load YAML version
        assert result["source"] == "yaml"

    def test_load_workflow_file_not_found(self, loader):
        """Test loading non-existent workflow"""
        with pytest.raises(FileNotFoundError) as exc_info:
            loader.load_workflow("nonexistent_workflow")

        assert "Workflow 'nonexistent_workflow' not found" in str(exc_info.value)

    def test_load_yaml_file_error(self, loader, temp_config_dir):
        """Test YAML file loading error"""
        # Create invalid YAML file
        yaml_path = os.path.join(temp_config_dir, "invalid.yaml")
        with open(yaml_path, "w") as f:
            f.write("invalid: yaml: content: [")  # Invalid YAML syntax

        with pytest.raises(yaml.YAMLError):
            loader._load_yaml(yaml_path)

    def test_load_json_file_error(self, loader, temp_config_dir):
        """Test JSON file loading error"""
        # Create invalid JSON file
        json_path = os.path.join(temp_config_dir, "invalid.json")
        with open(json_path, "w") as f:
            f.write('{"invalid": json, content}')  # Invalid JSON syntax

        with pytest.raises(json.JSONDecodeError):
            loader._load_json(json_path)

    def test_validate_workflow_config_success(self, loader, valid_workflow_config):
        """Test successful workflow config validation"""
        # Should not raise any exception
        loader._validate_workflow_config(valid_workflow_config, "test")

    def test_validate_workflow_config_missing_required_field(self, loader):
        """Test workflow validation with missing required fields"""
        invalid_configs = [
            {},  # Missing all fields
            {"workflow_name": "Test"},  # Missing start_node and nodes
            {"workflow_name": "Test", "start_node": "start"},  # Missing nodes
            {"workflow_name": "Test", "nodes": {}},  # Missing start_node
        ]

        for invalid_config in invalid_configs:
            with pytest.raises(ValueError) as exc_info:
                loader._validate_workflow_config(invalid_config, "test")
            assert "missing required field" in str(exc_info.value)

    def test_validate_workflow_config_invalid_nodes_type(self, loader):
        """Test workflow validation with invalid nodes type"""
        invalid_config = {
            "workflow_name": "Test",
            "start_node": "start",
            "nodes": ["not", "a", "dictionary"],  # Should be dict
        }

        with pytest.raises(ValueError) as exc_info:
            loader._validate_workflow_config(invalid_config, "test")
        assert "'nodes' must be a dictionary" in str(exc_info.value)

    def test_validate_workflow_config_start_node_not_in_nodes(self, loader):
        """Test workflow validation when start_node not in nodes"""
        invalid_config = {
            "workflow_name": "Test",
            "start_node": "nonexistent",
            "nodes": {"start": {"type": "analysis"}, "end": {"type": "result"}},
        }

        with pytest.raises(ValueError) as exc_info:
            loader._validate_workflow_config(invalid_config, "test")
        assert "start_node 'nonexistent' not found in nodes" in str(exc_info.value)

    def test_validate_workflow_config_node_missing_type(self, loader):
        """Test workflow validation when node missing type field"""
        invalid_config = {
            "workflow_name": "Test",
            "start_node": "start",
            "nodes": {"start": {}, "end": {"type": "result"}},  # Missing type field
        }

        with pytest.raises(ValueError) as exc_info:
            loader._validate_workflow_config(invalid_config, "test")
        assert "Node 'start' missing required field: type" in str(exc_info.value)

    def test_list_available_workflows(self, loader, temp_config_dir):
        """Test listing available workflows"""
        # Create test files
        files = [
            "workflow1.yaml",
            "workflow2.yml",
            "workflow3.json",
            "not_workflow.txt",  # Should be ignored
            "workflow4.json",
        ]

        for filename in files:
            with open(os.path.join(temp_config_dir, filename), "w") as f:
                f.write("test content")

        workflows = loader.list_available_workflows()

        expected = ["workflow1", "workflow2", "workflow3", "workflow4"]
        assert sorted(workflows) == sorted(expected)
        assert "not_workflow" not in workflows

    def test_list_available_workflows_nonexistent_directory(self, temp_config_dir):
        """Test listing workflows when directory doesn't exist"""
        # Use a subdirectory that doesn't exist but is within temp dir
        nonexistent_dir = os.path.join(temp_config_dir, "nonexistent")

        # Remove the directory after creation to simulate nonexistent
        loader = WorkflowConfigLoader(nonexistent_dir)
        os.rmdir(nonexistent_dir)  # Remove the directory that was created

        workflows = loader.list_available_workflows()
        assert workflows == []

    def test_reload_workflow(self, loader, temp_config_dir, valid_workflow_config):
        """Test reloading a workflow"""
        # Create and load workflow
        yaml_path = os.path.join(temp_config_dir, "test_workflow.yaml")
        with open(yaml_path, "w") as f:
            yaml.dump(valid_workflow_config, f)

        # Load initially
        loader.load_workflow("test_workflow")
        assert "test_workflow" in loader.cached_configs

        # Modify file
        modified_config = valid_workflow_config.copy()
        modified_config["version"] = "2.0"
        with open(yaml_path, "w") as f:
            yaml.dump(modified_config, f)

        # Reload should get new version
        result = loader.reload_workflow("test_workflow")
        assert result["version"] == "2.0"

    def test_clear_cache(self, loader, valid_workflow_config):
        """Test clearing workflow cache"""
        # Populate cache
        loader.cached_configs["workflow1"] = valid_workflow_config
        loader.cached_configs["workflow2"] = valid_workflow_config

        assert len(loader.cached_configs) == 2

        loader.clear_cache()

        assert len(loader.cached_configs) == 0

    def test_save_workflow_yaml(self, loader, temp_config_dir, valid_workflow_config):
        """Test saving workflow in YAML format"""
        loader.save_workflow("new_workflow", valid_workflow_config, "yaml")

        # Check file was created
        yaml_path = os.path.join(temp_config_dir, "new_workflow.yaml")
        assert os.path.exists(yaml_path)

        # Check content
        with open(yaml_path, "r") as f:
            saved_config = yaml.safe_load(f)
        assert saved_config == valid_workflow_config

        # Check cache was updated
        assert loader.cached_configs["new_workflow"] == valid_workflow_config

    def test_save_workflow_json(self, loader, temp_config_dir, valid_workflow_config):
        """Test saving workflow in JSON format"""
        loader.save_workflow("new_workflow", valid_workflow_config, "json")

        # Check file was created
        json_path = os.path.join(temp_config_dir, "new_workflow.json")
        assert os.path.exists(json_path)

        # Check content
        with open(json_path, "r") as f:
            saved_config = json.load(f)
        assert saved_config == valid_workflow_config

    def test_save_workflow_invalid_format(self, loader, valid_workflow_config):
        """Test saving workflow with invalid format"""
        with pytest.raises(ValueError) as exc_info:
            loader.save_workflow("workflow", valid_workflow_config, "invalid")
        assert "Unsupported format: invalid" in str(exc_info.value)

    def test_save_workflow_validation_error(self, loader):
        """Test saving workflow with validation error"""
        invalid_config = {"invalid": "config"}

        with pytest.raises(ValueError):
            loader.save_workflow("workflow", invalid_config, "yaml")


class TestGlobalFunctions:
    """Test global convenience functions"""

    def test_get_config_loader_singleton(self):
        """Test that get_config_loader returns singleton instance"""
        # Clear global state
        import services.ai.workflow_config_loader

        services.ai.workflow_config_loader._config_loader = None

        loader1 = get_config_loader()
        loader2 = get_config_loader()

        assert loader1 is loader2

    def test_get_config_loader_with_custom_directory(self):
        """Test get_config_loader with custom directory"""
        # Clear global state
        import services.ai.workflow_config_loader

        services.ai.workflow_config_loader._config_loader = None

        with tempfile.TemporaryDirectory() as temp_dir:
            loader = get_config_loader(temp_dir)
            assert loader.config_directory == temp_dir

    def test_load_workflow_function(self):
        """Test global load_workflow function"""
        with patch("services.ai.workflow_config_loader.get_config_loader") as mock_get:
            mock_loader = MagicMock()
            mock_loader.load_workflow.return_value = {"test": "config"}
            mock_get.return_value = mock_loader

            result = load_workflow("test_workflow")

            mock_loader.load_workflow.assert_called_once_with("test_workflow")
            assert result == {"test": "config"}

    def test_list_workflows_function(self):
        """Test global list_workflows function"""
        with patch("services.ai.workflow_config_loader.get_config_loader") as mock_get:
            mock_loader = MagicMock()
            mock_loader.list_available_workflows.return_value = [
                "workflow1",
                "workflow2",
            ]
            mock_get.return_value = mock_loader

            result = list_workflows()

            mock_loader.list_available_workflows.assert_called_once()
            assert result == ["workflow1", "workflow2"]

    def test_error_handling_in_file_operations(self):
        """Test error handling in file operations"""
        with tempfile.TemporaryDirectory() as temp_dir:
            loader = WorkflowConfigLoader(temp_dir)

            # Test file permission error simulation
            with patch(
                "builtins.open", side_effect=PermissionError("Permission denied")
            ):
                with pytest.raises(PermissionError):
                    loader._load_yaml("test.yaml")

                with pytest.raises(PermissionError):
                    loader._load_json("test.json")

    def test_edge_cases_workflow_names(self, temp_config_dir):
        """Test edge cases with workflow names"""
        loader = WorkflowConfigLoader(temp_config_dir)

        # Test with empty string
        with pytest.raises(FileNotFoundError):
            loader.load_workflow("")

        # Test with special characters
        with pytest.raises(FileNotFoundError):
            loader.load_workflow("workflow-with-special.chars!")

    def test_file_encoding_handling(self, temp_config_dir, valid_workflow_config):
        """Test handling of different file encodings"""
        loader = WorkflowConfigLoader(temp_config_dir)

        # Create file with UTF-8 encoding (including unicode characters)
        config_with_unicode = valid_workflow_config.copy()
        config_with_unicode["description"] = "Test with unicode: ñáéíóú 中文 🔥"

        yaml_path = os.path.join(temp_config_dir, "unicode_test.yaml")
        with open(yaml_path, "w", encoding="utf-8") as f:
            yaml.dump(config_with_unicode, f, allow_unicode=True)

        result = loader.load_workflow("unicode_test")
        assert result["description"] == "Test with unicode: ñáéíóú 中文 🔥"

    def test_concurrent_access_simulation(self, temp_config_dir, valid_workflow_config):
        """Test simulation of concurrent access to cache"""
        loader = WorkflowConfigLoader(temp_config_dir)

        # Create workflow file
        yaml_path = os.path.join(temp_config_dir, "concurrent_test.yaml")
        with open(yaml_path, "w") as f:
            yaml.dump(valid_workflow_config, f)

        # Load workflow multiple times (simulating concurrent access)
        results = []
        for _ in range(5):
            result = loader.load_workflow("concurrent_test")
            results.append(result)

        # All results should be identical and from cache
        assert all(result == valid_workflow_config for result in results)
        assert len(loader.cached_configs) == 1

    def test_directory_creation_on_init(self):
        """Test that directory is created on initialization"""
        with tempfile.TemporaryDirectory() as temp_dir:
            nonexistent_dir = os.path.join(temp_dir, "new_config_dir")
            assert not os.path.exists(nonexistent_dir)

            loader = WorkflowConfigLoader(nonexistent_dir)

            assert os.path.exists(nonexistent_dir)
            assert os.path.isdir(nonexistent_dir)
