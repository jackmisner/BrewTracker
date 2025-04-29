import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import Navigation from "./Navigation";
import { TextEncoder, TextDecoder } from "util";

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe("Navigation", () => {
  test("renders login and register links when user is not logged in", () => {
    renderWithRouter(<Navigation user={null} />);
    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.getByText("Register")).toBeInTheDocument();
  });

  test("renders user navigation when user is logged in", () => {
    const user = { username: "testuser" };
    renderWithRouter(<Navigation user={user} />);
    expect(screen.getByText("Recipes")).toBeInTheDocument();
    expect(screen.getByText("Brew Sessions")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();
    expect(screen.getByText(`Hello, ${user.username}`)).toBeInTheDocument();
  });

  test("calls onLogout when logout button is clicked", () => {
    const onLogout = jest.fn();
    const user = { username: "testuser" };
    renderWithRouter(<Navigation user={user} onLogout={onLogout} />);

    fireEvent.click(screen.getByText("Logout"));
    expect(onLogout).toHaveBeenCalled();
  });

  test("renders app title that links to home", () => {
    renderWithRouter(<Navigation />);
    const titleLink = screen.getByText("Homebrew Tracker");
    expect(titleLink).toBeInTheDocument();
    expect(titleLink.closest("a")).toHaveAttribute("href", "/");
  });
});
