import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type, type Schema } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
              required: ['title', 'points', 'description'],
              propertyOrdering: ['title', 'points', 'description']
            }
          }
        },
        required: ['title', 'levels'],
        propertyOrdering: ['title', 'description', 'levels']
      }
    }
  },
  required: ['criteria']
};

interface GenerateRubricBody {
  assignmentText?: string;
  maxScore?: number;
  fileData?: {
    mimeType: string;
    data: string;
  };
}

function getApiErrorDetails(err: unknown): { status: number; message: string } {
  let status = 500;
  let message = 'Nepavyko sugeneruoti vertinimo lentelės.';

  if (err && typeof err === 'object') {
    const maybeErr = err as { status?: unknown; code?: unknown; message?: unknown };
    if (typeof maybeErr.status === 'number' && maybeErr.status >= 400 && maybeErr.status < 600) {
      status = maybeErr.status;
    } else if (typeof maybeErr.code === 'number' && maybeErr.code >= 400 && maybeErr.code < 600) {
      status = maybeErr.code;
    }
    if (typeof maybeErr.message === 'string' && maybeErr.message) {
      message = maybeErr.message;
      try {
        const parsed = JSON.parse(maybeErr.message) as {
          error?: { code?: number; message?: string; status?: string };
        };
        if (parsed?.error) {
          if (typeof parsed.error.code === 'number' && parsed.error.code >= 400 && parsed.error.code < 600) {
            status = parsed.error.code;
          }
          if (typeof parsed.error.message === 'string') {
            message = `${status} ${parsed.error.status || ''}: ${parsed.error.message}`.trim();
          }
        }
      } catch {
        // Keep raw message if not JSON
      }
    }
  }

  return { status, message };
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const { status } = getApiErrorDetails(error);
      if (attempt < maxRetries && isRetryableStatus(status)) {
        const delayMs = 1000 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  app.post('/api/rubric/generate', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: 'Sistemoje nerastas Gemini API raktas (GEMINI_API_KEY). Patikrinkite aplinkos kintamuosius (Settings > Secrets arba Render Environment).'
      });
      return;
    }

    const body = (req.body || {}) as GenerateRubricBody;
    const assignmentText = typeof body.assignmentText === 'string' ? body.assignmentText : '';
    const maxScore = typeof body.maxScore === 'number' && body.maxScore > 0 ? body.maxScore : 100;
    const fileData = body.fileData;

    if (!assignmentText.trim() && (!fileData || !fileData.data || !fileData.mimeType)) {
      res.status(400).json({ error: 'Pateikite užduoties aprašymą arba įkelkite failą.' });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const promptText = `Create a detailed grading rubric for this assignment.
      
IMPORTANT: The sum of the maximum points for all criteria must equal exactly ${maxScore}.
      
Assignment Description/Notes:
${assignmentText || 'See attached file for assignment details.'}`;

      const contents = fileData?.data && fileData?.mimeType
        ? {
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
          }
        : promptText;

      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: rubricSchema,
          },
        })
      );

      const text = response.text;
      if (!text) {
        res.status(502).json({ error: 'Nepavyko sugeneruoti turinio su Gemini.' });
        return;
      }

      const data = JSON.parse(text);
      res.json(data);
    } catch (error) {
      console.error('Gemini API Error:', error);
      const { status, message } = getApiErrorDetails(error);
      res.status(status).json({ error: message });
    }
  });

  const distPath = path.resolve(__dirname, 'dist');
  const isDev =
    process.env.NODE_ENV === 'development' ||
    (process.env.NODE_ENV !== 'production' &&
      process.env.npm_lifecycle_event !== 'start' &&
      !fs.existsSync(path.join(distPath, 'index.html')));

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
