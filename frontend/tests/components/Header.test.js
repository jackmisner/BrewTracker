import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import Header from "../../src/components/Header/Header";
import { TextEncoder, TextDecoder } from "util";

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe("Header", () => {
  test("renders login and register links when user is not logged in", () => {
    renderWithRouter(<Header user={null} />);
    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.getByText("Register")).toBeInTheDocument();
  });

  test("renders user Header when user is logged in", () => {
    const user = { username: "testuser" };
    renderWithRouter(<Header user={user} />);
    expect(screen.getByText("Recipes")).toBeInTheDocument();
    expect(screen.getByText("Brew Sessions")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();
    expect(screen.getByText(`Hello, ${user.username}`)).toBeInTheDocument();
  });

  test("calls onLogout when logout button is clicked", () => {
    const onLogout = jest.fn();
    const user = { username: "testuser" };
    renderWithRouter(<Header user={user} onLogout={onLogout} />);

    fireEvent.click(screen.getByText("Logout"));
    expect(onLogout).toHaveBeenCalled();
  });

  test("renders app title that links to home", () => {
    renderWithRouter(<Header />);
    const titleLink = screen.getByText("Homebrew Tracker");
    expect(titleLink).toBeInTheDocument();
    expect(titleLink.closest("a")).toHaveAttribute("href", "/");
  });
});
