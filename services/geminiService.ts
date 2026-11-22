import { RubricData } from "../types";

export const generateRubricFromGemini = async (
  assignmentText: string,
  maxScore: number = 100,
  fileData?: { mimeType: string; data: string }
): Promise<RubricData> => {
  const response = await fetch("/api/rubric/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      assignmentText,
      maxScore,
      fileData,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload && typeof payload.error === "string" && payload.error) ||
      `Serverio klaida (${response.status}).`;
    throw new Error(message);
  }

  if (!payload || !Array.isArray(payload.criteria)) {
    throw new Error("Neteisingas serverio atsakymo formatas.");
  }

  return payload as RubricData;
};
