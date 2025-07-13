// @ts-ignore - React needed for JSX in test files
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import RecipeActions from "../../src/components/RecipeActions";
import ApiService from "../../src/services/api";

// Mock the API service
jest.mock("../../src/services/api");

// Mock react-router
const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
}));

const renderWithRouter = (component: any) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe("RecipeActions", () => {
  const originalConsoleError = console.error;

  const mockRecipe = {
    recipe_id: "test-recipe-123",
    name: "Test IPA",
  } as any;

  const defaultProps = {
    recipe: mockRecipe,
    onDelete: jest.fn(),
    showViewButton: true,
    compact: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    // Reset API mocks
    ApiService.recipes = {
      clone: jest.fn(),
      clonePublic: jest.fn(),
      delete: jest.fn(),
      getAll: jest.fn(),
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      calculateMetrics: jest.fn(),
      getPublic: jest.fn(),
      search: jest.fn(),
      importBeerXML: jest.fn(),
      exportBeerXML: jest.fn(),
    } as any;
  });
  afterEach(() => {
    console.error = originalConsoleError;
  });

  test("renders all action buttons in full mode", () => {
    renderWithRouter(<RecipeActions {...defaultProps} />);

    expect(screen.getByText("View Recipe")).toBeInTheDocument();
    expect(screen.getByText("Edit Recipe")).toBeInTheDocument();
    expect(screen.getByText("Clone Recipe")).toBeInTheDocument();
    expect(screen.getByText("Delete Recipe")).toBeInTheDocument();
    expect(screen.getByText("Brew This Recipe")).toBeInTheDocument();
  });

  test("renders compact buttons in compact mode", () => {
    renderWithRouter(<RecipeActions {...defaultProps} compact={true} />);

    expect(screen.getByText("View")).toBeInTheDocument();
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.getByText("Clone")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Brew")).toBeInTheDocument();
  });

  test("hides view button when showViewButton is false", () => {
    renderWithRouter(
      <RecipeActions {...defaultProps} showViewButton={false} />
    );

    expect(screen.queryByText("View Recipe")).not.toBeInTheDocument();
    expect(screen.getByText("Edit Recipe")).toBeInTheDocument();
  });

  test("navigates to recipe view when view button clicked", () => {
    renderWithRouter(<RecipeActions {...defaultProps} />);

    fireEvent.click(screen.getByText("View Recipe"));
    expect(mockNavigate).toHaveBeenCalledWith("/recipes/test-recipe-123");
  });

  test("navigates to recipe edit when edit button clicked", () => {
    renderWithRouter(<RecipeActions {...defaultProps} />);

    fireEvent.click(screen.getByText("Edit Recipe"));
    expect(mockNavigate).toHaveBeenCalledWith("/recipes/test-recipe-123/edit");
  });

  test("navigates to brew session creation when brew button clicked", () => {
    renderWithRouter(<RecipeActions {...defaultProps} />);

    fireEvent.click(screen.getByText("Brew This Recipe"));
    expect(mockNavigate).toHaveBeenCalledWith(
      "/brew-sessions/new?recipeId=test-recipe-123"
    );
  });

  test("handles successful recipe cloning", async () => {
    const mockCloneResponse = {
      status: 201,
      data: { recipe_id: "cloned-recipe-456" },
    };
    (ApiService.recipes.clone as jest.Mock).mockResolvedValue(mockCloneResponse);

    // Mock alert
    window.alert = jest.fn();

    renderWithRouter(<RecipeActions {...defaultProps} />);

    fireEvent.click(screen.getByText("Clone Recipe"));

    await waitFor(() => {
      expect(ApiService.recipes.clone).toHaveBeenCalledWith("test-recipe-123");
    });

    expect(window.alert).toHaveBeenCalledWith("Recipe cloned successfully!");
    expect(mockNavigate).toHaveBeenCalledWith(
      "/recipes/cloned-recipe-456/edit"
    );
  });

  test("handles clone error", async () => {
    const mockError = {
      response: { data: { error: "Clone failed" } },
    };
    (ApiService.recipes.clone as jest.Mock).mockRejectedValue(mockError);

    // Mock alert
    window.alert = jest.fn();

    renderWithRouter(<RecipeActions {...defaultProps} />);

    fireEvent.click(screen.getByText("Clone Recipe"));

    await waitFor(() => {
      expect(ApiService.recipes.clone).toHaveBeenCalledWith("test-recipe-123");
    });

    expect(window.alert).toHaveBeenCalledWith(
      "Failed to clone recipe: Clone failed"
    );
  });

  test("shows loading state during cloning", async () => {
    // Make the clone request hang
    (ApiService.recipes.clone as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithRouter(<RecipeActions {...defaultProps} />);

    fireEvent.click(screen.getByText("Clone Recipe"));

    await waitFor(() => {
      expect(screen.getByText("Cloning Recipe...")).toBeInTheDocument();
    });

    expect(screen.getByText("Cloning Recipe...")).toBeDisabled();
  });

  test("handles recipe deletion with confirmation", async () => {
    // Mock window.confirm
    window.confirm = jest.fn().mockReturnValue(true);
    (ApiService.recipes.delete as jest.Mock).mockResolvedValue({});

    const onDeleteMock = jest.fn();

    renderWithRouter(
      <RecipeActions {...defaultProps} onDelete={onDeleteMock} />
    );

    fireEvent.click(screen.getByText("Delete Recipe"));

    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to delete "Test IPA"?'
    );

    await waitFor(() => {
      expect(ApiService.recipes.delete).toHaveBeenCalledWith("test-recipe-123");
    });

    expect(onDeleteMock).toHaveBeenCalledWith("test-recipe-123");
  });

  test("cancels deletion when user cancels confirmation", () => {
    // Mock window.confirm to return false
    window.confirm = jest.fn().mockReturnValue(false);

    const onDeleteMock = jest.fn();

    renderWithRouter(
      <RecipeActions {...defaultProps} onDelete={onDeleteMock} />
    );

    fireEvent.click(screen.getByText("Delete Recipe"));

    expect(window.confirm).toHaveBeenCalled();
    expect(ApiService.recipes.delete).not.toHaveBeenCalled();
    expect(onDeleteMock).not.toHaveBeenCalled();
  });

  test("handles delete error", async () => {
    window.confirm = jest.fn().mockReturnValue(true);
    window.alert = jest.fn();

    const mockError = {
      response: { data: { error: "Delete failed" } },
    };
    (ApiService.recipes.delete as jest.Mock).mockRejectedValue(mockError);

    renderWithRouter(<RecipeActions {...defaultProps} />);

    fireEvent.click(screen.getByText("Delete Recipe"));

    await waitFor(() => {
      expect(ApiService.recipes.delete).toHaveBeenCalledWith("test-recipe-123");
    });

    expect(window.alert).toHaveBeenCalledWith(
      "Failed to delete recipe: Delete failed"
    );
  });

  test("shows loading state during deletion", async () => {
    window.confirm = jest.fn().mockReturnValue(true);
    // Make the delete request hang
    (ApiService.recipes.delete as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithRouter(<RecipeActions {...defaultProps} />);

    fireEvent.click(screen.getByText("Delete Recipe"));

    await waitFor(() => {
      expect(screen.getByText("Deleting Recipe...")).toBeInTheDocument();
    });

    expect(screen.getByText("Deleting Recipe...")).toBeDisabled();
  });

  test("navigates back to recipes list after deletion in non-compact mode", async () => {
    window.confirm = jest.fn().mockReturnValue(true);
    (ApiService.recipes.delete as jest.Mock).mockResolvedValue({});

    renderWithRouter(<RecipeActions {...defaultProps} compact={false} />);

    fireEvent.click(screen.getByText("Delete Recipe"));

    await waitFor(() => {
      expect(ApiService.recipes.delete).toHaveBeenCalledWith("test-recipe-123");
    });

    expect(mockNavigate).toHaveBeenCalledWith("/recipes");
  });

  test("calls refreshTrigger when provided after cloning", async () => {
    const mockCloneResponse = {
      status: 201,
      data: { recipe_id: "cloned-recipe-456" },
    };
    (ApiService.recipes.clone as jest.Mock).mockResolvedValue(mockCloneResponse);

    const refreshTriggerMock = jest.fn();
    window.alert = jest.fn();

    renderWithRouter(
      <RecipeActions {...defaultProps} refreshTrigger={refreshTriggerMock} />
    );

    fireEvent.click(screen.getByText("Clone Recipe"));

    await waitFor(() => {
      expect(refreshTriggerMock).toHaveBeenCalled();
    });
  });

  test("disables all buttons during operations", async () => {
    // Mock a hanging clone operation
    (ApiService.recipes.clone as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithRouter(<RecipeActions {...defaultProps} />);

    fireEvent.click(screen.getByText("Clone Recipe"));

    await waitFor(() => {
      expect(screen.getByText("Cloning Recipe...")).toBeDisabled();
    });

    // All other buttons should still be enabled since they're separate operations
    expect(screen.getByText("View Recipe")).not.toBeDisabled();
    expect(screen.getByText("Edit Recipe")).not.toBeDisabled();
  });

  describe("Public Recipe Mode", () => {
    const publicRecipeProps = {
      ...defaultProps,
      isPublicRecipe: true,
      originalAuthor: "John Brewer",
    };

    test("hides Edit and Delete buttons for public recipes", () => {
      renderWithRouter(<RecipeActions {...publicRecipeProps} />);

      expect(screen.getByText("View Recipe")).toBeInTheDocument();
      expect(screen.getByText("Clone Recipe")).toBeInTheDocument();
      expect(screen.getByText("Brew This Recipe")).toBeInTheDocument();
      
      expect(screen.queryByText("Edit Recipe")).not.toBeInTheDocument();
      expect(screen.queryByText("Delete Recipe")).not.toBeInTheDocument();
    });

    test("uses clonePublic API for public recipe cloning", async () => {
      window.alert = jest.fn();
      (ApiService.recipes.clonePublic as jest.Mock).mockResolvedValue({
        status: 201,
        data: { recipe_id: "new-recipe-456" },
      });

      renderWithRouter(<RecipeActions {...publicRecipeProps} />);

      fireEvent.click(screen.getByText("Clone Recipe"));

      await waitFor(() => {
        expect(ApiService.recipes.clonePublic).toHaveBeenCalledWith(
          "test-recipe-123",
          "John Brewer"
        );
      });

      expect(window.alert).toHaveBeenCalledWith(
        "Recipe cloned successfully with attribution to John Brewer!"
      );
      expect(mockNavigate).toHaveBeenCalledWith("/recipes/new-recipe-456/edit");
    });

    test("shows compact buttons for public recipes", () => {
      const compactPublicProps = {
        ...publicRecipeProps,
        compact: true,
      };

      renderWithRouter(<RecipeActions {...compactPublicProps} />);

      expect(screen.getByText("View")).toBeInTheDocument();
      expect(screen.getByText("Clone")).toBeInTheDocument();
      expect(screen.getByText("Brew")).toBeInTheDocument();
      
      expect(screen.queryByText("Edit")).not.toBeInTheDocument();
      expect(screen.queryByText("Delete")).not.toBeInTheDocument();
    });

    test("handles clonePublic API error", async () => {
      window.alert = jest.fn();
      const mockError = {
        response: { data: { error: "Clone failed" } },
      };
      (ApiService.recipes.clonePublic as jest.Mock).mockRejectedValue(mockError);

      renderWithRouter(<RecipeActions {...publicRecipeProps} />);

      fireEvent.click(screen.getByText("Clone Recipe"));

      await waitFor(() => {
        expect(ApiService.recipes.clonePublic).toHaveBeenCalledWith(
          "test-recipe-123",
          "John Brewer"
        );
      });

      expect(window.alert).toHaveBeenCalledWith(
        "Failed to clone recipe: Clone failed"
      );
    });

    test("falls back to regular clone when originalAuthor is not provided", async () => {
      window.alert = jest.fn();
      (ApiService.recipes.clone as jest.Mock).mockResolvedValue({
        status: 201,
        data: { recipe_id: "new-recipe-789" },
      });

      const propsWithoutAuthor = {
        ...defaultProps,
        isPublicRecipe: true,
        // originalAuthor is undefined
      };

      renderWithRouter(<RecipeActions {...propsWithoutAuthor} />);

      fireEvent.click(screen.getByText("Clone Recipe"));

      await waitFor(() => {
        expect(ApiService.recipes.clone).toHaveBeenCalledWith("test-recipe-123");
        expect(ApiService.recipes.clonePublic).not.toHaveBeenCalled();
      });
    });
  });
});
