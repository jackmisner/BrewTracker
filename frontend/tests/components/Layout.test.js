import React from "react";
import { render, screen } from "@testing-library/react";
import Layout from "../../src/components/Header/Layout";

// Mock the Header component
jest.mock("../../src/components/Header/Header", () => ({ user, onLogout }) => (
  <div data-testid="header-mock">
    Header - {user ? user.name : "Guest"}
    <button onClick={onLogout}>Logout</button>
  </div>
));

describe("Layout", () => {
  it("renders Header with user and onLogout props", () => {
    const user = { name: "Alice" };
    const onLogout = jest.fn();

    render(
      <Layout user={user} onLogout={onLogout}>
        <div>Child Content</div>
      </Layout>
    );

    expect(screen.getByTestId("header-mock")).toHaveTextContent("Alice");
    expect(screen.getByText("Logout")).toBeInTheDocument();
  });

  it("renders children inside main", () => {
    render(
      <Layout>
        <div data-testid="child">Child Content</div>
      </Layout>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Child Content");
  });

  it("applies correct layout classes", () => {
    render(<Layout>Content</Layout>);
    const container = screen.getByText("Content").closest("main");
    expect(container).toHaveClass("flex-grow", "container", "mx-auto", "p-4");
  });
});
