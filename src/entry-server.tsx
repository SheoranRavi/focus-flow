import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import Home from "./pages/Home";
import { getSeoLandingPage } from "./pages/SeoLandingPages";

export function render(url: string) {
  const pathname = new URL(url, "https://www.taskquota.com").pathname;
  const page = pathname === "/" ? <Home /> : getSeoLandingPage(pathname);

  if (!page) {
    throw new Error(`No public prerender route configured for ${pathname}`);
  }

  return renderToString(
    <MemoryRouter initialEntries={[pathname]}>
      {page}
    </MemoryRouter>,
  );
}
