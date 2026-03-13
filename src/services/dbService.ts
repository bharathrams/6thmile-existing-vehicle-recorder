import { JobCardData } from '../types';

export async function submitToDatabase(data: JobCardData): Promise<{ success: boolean; message: string }> {
  const payload = {
    job_card_details: data.job_card_details,
    items: data.items,
    totals: data.totals,
    submitted_at: new Date().toISOString(),
  };

  const response = await fetch('/api/job-cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to submit (${response.status}): ${text.substring(0, 200)}`);
  }

  const result = await response.json();
  return { success: true, message: result.message || 'Data saved to database' };
}

export async function fetchAllJobCards(): Promise<any[]> {
  const response = await fetch('/api/job-cards');
  if (!response.ok) throw new Error('Failed to fetch job cards');
  return response.json();
}
