import { createFileRoute, redirect } from "@tanstack/react-router";

// Alias: the spec also refers to /app/exercice (singular).
export const Route = createFileRoute("/au-stop-de-madame/app/exercice")({
  beforeLoad: () => {
    throw redirect({ to: "/au-stop-de-madame/app/exercices" });
  },
});
