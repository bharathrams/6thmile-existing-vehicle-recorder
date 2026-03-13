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
    You are an expert OCR system specialized in reading Indian automobile workshop job cards.

    Carefully examine the uploaded job card image and extract ALL visible fields. The job card typically has two sections:

    SECTION 1 - HEADER FIELDS (usually at the top of the card, with labeled fields):
    Look for these labels (they may be printed or handwritten, and may use slight variations):
    - "Customer Name" / "Name" / "Party Name" → customer_name
    - "Date" / "Job Card Date" → date
    - "Mobile" / "Mobile No" / "Phone" / "Contact" → mobile_number
    - "Address" → address
    - "VIN" / "VIN No" / "Chassis No" / "Chassis Number" → vin_number
    - "Delivery Date" / "Expected Delivery" → delivery_date
    - "Vehicle Make" / "Make" / "Vehicle" / "Model" → vehicle_make
    - "Reg No" / "Registration" / "Registration No" / "Reg. Number" / "Vehicle No" → registration_number
    - "Work Done By" / "Technician" / "Mechanic" → work_done_by
    - "KM Reading" / "KM" / "Kilometer" / "Odometer" / "KMS" → km_reading

    Read the VALUE next to or below each label. These values are often handwritten.

    SECTION 2 - ACCESSORIES / PARTS TABLE (usually a table with columns):
    Look for a table with columns like: Sl No, Description, Quantity/Qty, Material/Material Cost/Rate, Labour/Labour Cost
    - Each row in this table becomes one item in the items array.
    - The table may also have INR, FC (Fitting Charges), Amount columns - map INR/Rate/Amount to material_cost, and FC/Fitting/Labour to labour_cost.

    SECTION 3 - TOTALS (usually at the bottom):
    - Material Total / Parts Total → material_total
    - Labour Total → labour_total
    - Grand Total / Total Amount → grand_total

    CRITICAL INSTRUCTIONS:
    - Read EVERY field carefully, especially handwritten text. Do not skip fields.
    - If a field's value is handwritten, try your best to read it accurately.
    - For date fields (date, delivery_date), return in DD-MM-YYYY format (e.g., "01-09-2024"). If year is 2-digit like "24", expand to "2024".
    - Convert handwritten numbers correctly. Preserve currency values as numbers without commas.
    - If a field is truly not present or completely illegible, return an empty string.
    - Do NOT confuse column headers in the accessories table with the header fields above.
    - Pay special attention to the area ABOVE the accessories table for customer details.
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
