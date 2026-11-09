import { createFileRoute } from "@tanstack/react-router";
import { ApexTrainer } from "@/components/exercises/ApexTrainer";
import { useAccess } from "@/lib/auth";

export const Route = createFileRoute("/au-stop-de-madame/app/exercices")({
  head: () => ({
    meta: [
      { title: "Exercices Kegel — Au stop de madame" },
      { name: "description", content: "Entraînement Kegel guidé : classique, squat, ventre et exercices premium." },
      { property: "og:title", content: "Exercices Kegel — Au stop de madame" },
      { property: "og:description", content: "Entraînement Kegel guidé : classique, squat, ventre et exercices premium." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#121212" },
    ],
  }),
  component: ExercisesPage,
});

function ExercisesPage() {
  const { isPremium, user } = useAccess();
  return <ApexTrainer isPremium={isPremium} signedIn={!!user} />;
}
