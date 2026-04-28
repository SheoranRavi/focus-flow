import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Home from "./Home";

const renderHome = () => {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  );
};

describe("Home", () => {
  it("shows the account sync benefit", () => {
    renderHome();

    expect(screen.getByText(/sync sessions across multiple devices/i)).toBeInTheDocument();
  });

  it("links account creation to register", () => {
    renderHome();

    expect(screen.getByRole("link", { name: /create an account/i })).toHaveAttribute("href", "/register");
  });

  it("links guest continuation to the app", () => {
    renderHome();

    expect(screen.getByRole("link", { name: /continue as guest/i })).toHaveAttribute("href", "/app");
  });

  it("links existing users to sign in", () => {
    renderHome();

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });
});
