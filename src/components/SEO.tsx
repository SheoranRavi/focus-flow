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

  // The prerender build uses these tags to populate the document head. In the
  // browser, the effect above owns head updates so hydration stays identical
  // to the generated root markup.
  if (typeof window !== "undefined") {
    return null;
  }

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={indexable ? "index, follow" : "noindex, nofollow"} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={image} />
      <meta property="og:image:alt" content={`${title} preview`} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      {schemaJson && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: schemaJson }}
        />
      )}
    </>
  );
}
