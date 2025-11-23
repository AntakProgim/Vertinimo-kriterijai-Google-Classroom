import { GoogleGenAI, Type, Schema } from "@google/genai";
import { RubricData } from "../types";
import { API_KEY } from "../config";

const SYSTEM_INSTRUCTION = `
You are an expert educational consultant specialized in creating grading rubrics for Google Classroom.
Your task is to analyze an assignment description (which may be text or an attached file) and generate a structured scoring rubric.

Rules:
1. The output must be a valid JSON object strictly following the defined schema.
2. Detect the language of the assignment description. The generated rubric (titles, descriptions) MUST be in the same language as the input.
3. Create clear, distinct criteria relevant to the assignment (e.g., Content, Grammar, Creativity, formatting).
4. For each criterion, provide 3-5 performance levels (e.g., Excellent, Good, Satisfactory, Needs Improvement).
5. Assign points logically. The sum of the maximum points of all criteria MUST equal the requested total score. Distribute points across criteria based on importance.
6. Keep descriptions concise but specific enough for a student to understand why they received a certain grade.
`;

const rubricSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    criteria: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Title of the criterion (e.g., 'Structure')" },
          description: { type: Type.STRING, description: "Brief explanation of what this criterion assesses" },
          levels: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Level name (e.g., 'Exceeds Expectations')" },
                points: { type: Type.NUMBER, description: "Points awarded for this level" },
                description: { type: Type.STRING, description: "Detailed description of performance at this level" }
              },
              required: ["title", "points", "description"],
              propertyOrdering: ["title", "points", "description"]
            }
          }
        },
        required: ["title", "levels"],
        propertyOrdering: ["title", "description", "levels"]
      }
    }
  },
  required: ["criteria"]
};

export const generateRubricFromGemini = async (
  assignmentText: string,
  maxScore: number = 100,
  fileData?: { mimeType: string; data: string }
): Promise<RubricData> => {
  if (!API_KEY) {
    throw new Error("Trūksta API rakto (API Key).");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  try {
    const promptText = `Create a detailed grading rubric for this assignment.
      
IMPORTANT: The sum of the maximum points for all criteria must equal exactly ${maxScore}.
      
Assignment Description/Notes:
${assignmentText || "See attached file for assignment details."}`;

    let contents;

    if (fileData) {
      // Multimodal request with file
      contents = {
        parts: [
          {
            inlineData: {
              mimeType: fileData.mimeType,
              data: fileData.data,
            },
          },
          {
            text: promptText,
          },
        ],
      };
    } else {
      // Text-only request
      contents = promptText;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: rubricSchema,
        temperature: 0.3,
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Nepavyko sugeneruoti turinio su Gemini.");
    }

    const data = JSON.parse(text) as RubricData;
    return data;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
