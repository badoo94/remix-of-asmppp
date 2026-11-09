import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Au stop de madame — Tableau de bord" },
      { name: "description", content: "Accédez à la méthode, aux exercices Kegel et à votre offre premium." },
      { property: "og:title", content: "Au stop de madame" },
      { property: "og:description", content: "Accédez à la méthode, aux exercices Kegel et à votre offre premium." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/au-stop-de-madame/app" });
  },
});
