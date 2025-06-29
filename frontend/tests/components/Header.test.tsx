// @ts-ignore - React needed for JSX in test files
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import Header from "../../src/components/Header/Header";

const renderWithRouter = (component: any) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe("Header", () => {
  test("renders login and register links when user is not logged in", () => {
    renderWithRouter(<Header user={null} onLogout={() => {}} />);
    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.getByText("Register")).toBeInTheDocument();
  });

  test("renders user navigation when user is logged in", () => {
    const user = { username: "testuser" } as any;
    renderWithRouter(<Header user={user} onLogout={() => {}} />);
    expect(screen.getByText("Recipes")).toBeInTheDocument();
    expect(screen.getByText("Brew Sessions")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();
    expect(screen.getByText(`Hello, ${user.username}`)).toBeInTheDocument();
  });

  test("calls onLogout when logout button is clicked", () => {
    const onLogout = jest.fn();
    const user = { username: "testuser" } as any;
    renderWithRouter(<Header user={user} onLogout={onLogout} />);

    fireEvent.click(screen.getByText("Logout"));
    expect(onLogout).toHaveBeenCalled();
  });

  test("renders app title that links to home", () => {
    renderWithRouter(<Header user={null} onLogout={() => {}} />);
    const titleLink = screen.getByText("Brewtracker");
    expect(titleLink).toBeInTheDocument();
    expect(titleLink.closest("a")).toHaveAttribute("href", "/");
  });
});
