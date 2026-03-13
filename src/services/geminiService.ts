import { GoogleGenAI } from "@google/genai";
import { JobCardData, jobCardSchema } from "../types";

export async function extractJobCardData(base64Image: string, mimeType: string): Promise<JobCardData> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";

  const prompt = `
    You are an AI system that extracts structured data from workshop job card images and converts it into an Excel-friendly format.
    Read the uploaded job card image carefully and extract all visible fields.
    
    Important instructions:
    - If quantity is missing leave it blank.
    - Convert handwritten numbers correctly.
    - Preserve currency values as numbers without commas if possible.
    - Ensure every accessory row becomes one row in the items array.
    - If a field is not present in the image, return an empty string.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Image.split(",")[1] || base64Image,
              mimeType,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: jobCardSchema,
    },
  });

  if (!response.text) {
    throw new Error("No response from Gemini");
  }

  return JSON.parse(response.text) as JobCardData;
}
