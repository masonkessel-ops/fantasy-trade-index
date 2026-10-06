import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/site";

/** Lets people add the site to their home screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "Trade Index",
    description: "Fantasy football trade values, trade analyzer, trade finder and auto lineup.",
    start_url: "/my-team",
    display: "standalone",
    background_color: "#07070c",
    theme_color: "#07070c",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
