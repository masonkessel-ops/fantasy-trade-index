import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const PAGES = ["", "/values", "/trade", "/trade-finder", "/my-team", "/assistant", "/rankings", "/waivers", "/live", "/team-of-the-week", "/about", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: p === "" || p === "/values" ? "daily" : "weekly", priority: p === "" ? 1 : 0.7 }));
}
