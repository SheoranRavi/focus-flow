import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./Home";

const authState = vi.hoisted(() => ({
  user: null as unknown,
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => authState.user,
}));

const renderHome = () => {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  );
};

describe("Home", () => {
  beforeEach(() => {
    authState.user = null;
  });

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

  it("redirects signed-in users to the app", () => {
    authState.user = { uid: "user-1" };

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/app" element={<div>App page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("App page")).toBeInTheDocument();
  });
});
