import { useEffect } from "react";

const SITE_URL = "https://www.taskquota.com";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.svg`;

export interface SEOProps {
  title: string;
  description: string;
  path?: string;
  indexable?: boolean;
  image?: string;
  schema?: Record<string, unknown>;
}

function upsertMeta(attribute: "name" | "property", value: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${value}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, value);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function upsertCanonical(url: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }

  element.href = url;
}

export default function SEO({
  title,
  description,
  path = "/",
  indexable = true,
  image = DEFAULT_IMAGE,
  schema,
}: SEOProps) {
  const canonicalUrl = new URL(path, SITE_URL).toString();
  const schemaJson = schema ? JSON.stringify(schema) : null;

  useEffect(() => {
    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", indexable ? "index, follow" : "noindex, nofollow");
    upsertCanonical(canonicalUrl);

    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:image", image);
    upsertMeta("property", "og:image:alt", `${title} preview`);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", image);

    const existingSchema = document.head.querySelector<HTMLScriptElement>('script[data-seo-schema="true"]');
    if (schemaJson) {
      const schemaElement = existingSchema ?? document.createElement("script");
      schemaElement.type = "application/ld+json";
      schemaElement.dataset.seoSchema = "true";
      schemaElement.textContent = schemaJson;
      if (!existingSchema) document.head.appendChild(schemaElement);
    } else {
      existingSchema?.remove();
    }
  }, [canonicalUrl, description, image, indexable, schemaJson, title]);

  return null;
}
