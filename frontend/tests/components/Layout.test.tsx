// @ts-ignore - React needed for JSX in test files
import React from "react";
import { render, screen } from "@testing-library/react";
import Layout from "../../src/components/Header/Layout";

// Mock the Header component
jest.mock("../../src/components/Header/Header", () => ({ user, onLogout }: { user: any; onLogout: any }) => (
  <div data-testid="header-mock">
    Header - {user ? user.name : "Guest"}
    <button onClick={onLogout}>Logout</button>
  </div>
));

describe("Layout", () => {
  it("renders Header with user and onLogout props", () => {
    const user = { name: "Alice", user_id: "1", username: "alice", email: "alice@test.com", is_active: true, date_joined: "2024-01-01", last_login: "2024-01-01" } as any;
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
      <Layout user={null} onLogout={() => {}}>
        <div data-testid="child">Child Content</div>
      </Layout>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Child Content");
  });

  it("applies correct layout classes", () => {
    render(<Layout user={null} onLogout={() => {}}>Content</Layout>);
    const container = screen.getByText("Content").closest("main");
    expect(container).toHaveClass("flex-grow", "container", "mx-auto", "p-4");
  });
});
