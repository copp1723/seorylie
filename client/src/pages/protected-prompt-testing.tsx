import { ProtectedRoute } from "@/components/protected-route";
import PromptTesting from "./prompt-testing";

export default function ProtectedPromptTesting() {
  return (
    <ProtectedRoute>
      <PromptTesting />
    </ProtectedRoute>
  );
}
