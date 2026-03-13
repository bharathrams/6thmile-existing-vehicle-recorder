import { Type } from "@google/genai";

export interface JobCardDetails {
  customer_name: string;
  date: string;
  mobile_number: string;
  address: string;
  vin_number: string;
  delivery_date: string;
  vehicle_make: string;
  registration_number: string;
  work_done_by: string;
  km_reading: string;
}

export interface AccessoryItem {
  sl_no: string;
  description: string;
  quantity: string;
  material_cost: string;
  labour_cost: string;
}

export interface Totals {
  material_total: string;
  labour_total: string;
  grand_total: string;
}

export interface JobCardData {
  job_card_details: JobCardDetails;
  items: AccessoryItem[];
  totals: Totals;
}

export const jobCardSchema = {
  type: Type.OBJECT,
  properties: {
    job_card_details: {
      type: Type.OBJECT,
      properties: {
        customer_name: { type: Type.STRING },
        date: { type: Type.STRING },
        mobile_number: { type: Type.STRING },
        address: { type: Type.STRING },
        vin_number: { type: Type.STRING },
        delivery_date: { type: Type.STRING },
        vehicle_make: { type: Type.STRING },
        registration_number: { type: Type.STRING },
        work_done_by: { type: Type.STRING },
        km_reading: { type: Type.STRING },
      },
      required: ["customer_name", "date", "mobile_number", "address", "vin_number", "delivery_date", "vehicle_make", "registration_number", "work_done_by", "km_reading"],
    },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sl_no: { type: Type.STRING },
          description: { type: Type.STRING },
          quantity: { type: Type.STRING },
          material_cost: { type: Type.STRING },
          labour_cost: { type: Type.STRING },
        },
        required: ["sl_no", "description", "quantity", "material_cost", "labour_cost"],
      },
    },
    totals: {
      type: Type.OBJECT,
      properties: {
        material_total: { type: Type.STRING },
        labour_total: { type: Type.STRING },
        grand_total: { type: Type.STRING },
      },
      required: ["material_total", "labour_total", "grand_total"],
    },
  },
  required: ["job_card_details", "items", "totals"],
};
