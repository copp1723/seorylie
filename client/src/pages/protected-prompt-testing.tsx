import { ProtectedRoute } from "../components/ProtectedRoute";
import PromptTesting from "./prompt-testing";

export default function ProtectedPromptTesting() {
  return (
    <ProtectedRoute>
      <PromptTesting />
    </ProtectedRoute>
  );
}