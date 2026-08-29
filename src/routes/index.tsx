import { createFileRoute } from "@tanstack/react-router";
import { LessonApp } from "@/components/piano/lesson-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <LessonApp />;
}
