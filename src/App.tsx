/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  Copy,
  Table as TableIcon,
  LayoutGrid,
  ChevronRight,
  User,
  Calendar,
  Phone,
  MapPin,
  Hash,
  Truck,
  Gauge,
  UserCheck,
  FileSpreadsheet,
  Send,
  Plus,
  Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { extractJobCardData } from './services/geminiService';
import { submitToDatabase } from './services/dbService';
import { JobCardData, JobCardDetails, AccessoryItem } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<JobCardData | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
      setError(null);
      setData(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    multiple: false
  } as any);

  const normalizeDate = (raw: string): string => {
    if (!raw.trim()) return '';
    // Try parsing common formats: DD-MM-YY, DD/MM/YY, DD-MM-YYYY, DD/MM/YYYY
    const cleaned = raw.trim().replace(/[/]/g, '-');
    const parts = cleaned.split('-');
    if (parts.length === 3) {
      let [day, month, year] = parts;
      if (year.length === 2) year = `20${year}`;
      const d = parseInt(day, 10);
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2000 && y <= 2099) {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    return raw;
  };

  const handleProcess = async () => {
    if (!preview || !file) return;

    setLoading(true);
    setError(null);
    setShowErrors(false);
    setSubmitStatus(null);
    try {
      const result = await extractJobCardData(preview, file.type);
      const d = result.job_card_details;
      // Normalize dates to YYYY-MM-DD for date input
      d.date = normalizeDate(d.date);
      d.delivery_date = normalizeDate(d.delivery_date);
      const filledCount = [d.customer_name, d.date, d.mobile_number, d.vehicle_make, d.registration_number, d.work_done_by, d.km_reading]
        .filter(v => v.trim()).length;
      if (filledCount < 2) {
        setError("This doesn't appear to be a valid job card. Please upload a proper job card image with customer details, vehicle info, and accessories table.");
        setData(null);
        return;
      }
      setData(result);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred during extraction.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (data) {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    }
  };

  const updateDetail = (key: keyof JobCardDetails, value: string) => {
    if (!data) return;
    setData({
      ...data,
      job_card_details: { ...data.job_card_details, [key]: value }
    });
  };

  const recalcTotals = (items: AccessoryItem[]) => {
    const materialTotal = items.reduce((sum, item) => sum + (parseFloat(item.material_cost) || 0), 0);
    const labourTotal = items.reduce((sum, item) => sum + (parseFloat(item.labour_cost) || 0), 0);
    return {
      material_total: materialTotal.toString(),
      labour_total: labourTotal.toString(),
      grand_total: (materialTotal + labourTotal).toString(),
    };
  };

  const updateItem = (idx: number, key: keyof AccessoryItem, value: string) => {
    if (!data) return;
    const newItems = [...data.items];
    newItems[idx] = { ...newItems[idx], [key]: value };
    const totals = (key === 'material_cost' || key === 'labour_cost') ? recalcTotals(newItems) : data.totals;
    setData({ ...data, items: newItems, totals });
  };

  const addItem = () => {
    if (!data) return;
    const newItem: AccessoryItem = { sl_no: String(data.items.length + 1), description: '', quantity: '', material_cost: '', labour_cost: '' };
    setData({ ...data, items: [...data.items, newItem] });
  };

  const removeItem = (idx: number) => {
    if (!data) return;
    const newItems = data.items.filter((_, i) => i !== idx);
    setData({ ...data, items: newItems, totals: recalcTotals(newItems) });
  };

  const updateTotal = (key: 'material_total' | 'labour_total' | 'grand_total', value: string) => {
    if (!data) return;
    setData({ ...data, totals: { ...data.totals, [key]: value } });
  };

  const hasEmptyRequired = (data: JobCardData): boolean => {
    const d = data.job_card_details;
    return !d.customer_name.trim() || !d.date.trim() || !d.mobile_number.trim() ||
      !d.address.trim() || !d.vin_number.trim() || !d.delivery_date.trim() ||
      !d.vehicle_make.trim() || !d.registration_number.trim() ||
      !d.work_done_by.trim() || !d.km_reading.trim() || data.items.length === 0;
  };

  const handleSubmit = async () => {
    if (!data) return;

    setShowErrors(true);
    if (hasEmptyRequired(data)) {
      setSubmitStatus({ type: 'error', message: 'Please fill in all required fields' });
      return;
    }

    setSubmitting(true);
    setSubmitStatus(null);
    console.log('Submitting Job Card Data:', data);
    try {
      const result = await submitToDatabase(data);
      console.log('Submit result:', result);
      // Clear form
      setData(null);
      setFile(null);
      setPreview(null);
      setShowErrors(false);
      setSubmitStatus(null);
      setSuccessMessage('Job card saved successfully!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Submit error:', err);
      setSubmitStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to submit' });
    } finally {
      setSubmitting(false);
    }
  };

  const downloadJson = () => {
    if (data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `job-card-${data.job_card_details.registration_number || 'data'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const downloadExcel = () => {
    if (!data) return;

    // 1. Prepare Header Data
    const headerData = [
      ["JOB CARD DETAILS"],
      ["Customer Name", data.job_card_details.customer_name],
      ["Date", data.job_card_details.date],
      ["Mobile Number", data.job_card_details.mobile_number],
      ["Address", data.job_card_details.address],
      ["VIN Number", data.job_card_details.vin_number],
      ["Delivery Date", data.job_card_details.delivery_date],
      ["Vehicle Make", data.job_card_details.vehicle_make],
      ["Registration Number", data.job_card_details.registration_number],
      ["Work Done By", data.job_card_details.work_done_by],
      ["KM Reading", data.job_card_details.km_reading],
      [],
      ["DETAILS OF ACCESSORIES"],
      ["Sl No", "Description", "Quantity", "Material Cost (Rs)", "Labour Charges (Rs)"]
    ];

    // 2. Add Item Rows
    const itemRows = data.items.map(item => [
      item.sl_no,
      item.description,
      item.quantity,
      item.material_cost,
      item.labour_cost
    ]);

    // 3. Add Totals
    const totalRows = [
      [],
      ["TOTALS"],
      ["Material Total", "", "", data.totals.material_total],
      ["Labour Total", "", "", "", data.totals.labour_total],
      ["Grand Total", "", "", "", data.totals.grand_total]
    ];

    // Combine all data
    const finalData = [...headerData, ...itemRows, ...totalRows];

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(finalData);

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Job Card Data");

    // Generate Excel file and trigger download
    XLSX.writeFile(wb, `job-card-${data.job_card_details.registration_number || 'data'}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#141414] flex items-center justify-center rounded-sm">
            <FileText className="text-[#E4E3E0] w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-xl leading-none">Job Card Extractor</h1>
            <p className="text-[10px] uppercase tracking-widest text-[#141414]/60 mt-1 font-mono">Workshop Intelligence v1.0</p>
          </div>
        </div>
        {data && (
          <div className="flex gap-2">
            <button 
              onClick={copyToClipboard}
              className="p-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors rounded-sm border border-[#141414]"
              title="Copy JSON"
            >
              <Copy size={18} />
            </button>
            <button 
              onClick={downloadExcel}
              className="p-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors rounded-sm border border-[#141414] flex items-center gap-2"
              title="Download Excel"
            >
              <FileSpreadsheet size={18} />
              <span className="text-[10px] font-mono uppercase tracking-wider hidden sm:inline">Excel</span>
            </button>
            <button 
              onClick={downloadJson}
              className="p-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors rounded-sm border border-[#141414] flex items-center gap-2"
              title="Download JSON"
            >
              <Download size={18} />
              <span className="text-[10px] font-mono uppercase tracking-wider hidden sm:inline">JSON</span>
            </button>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Upload & Preview */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white border border-[#141414] p-1 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <div className="p-4 border-b border-[#141414] flex justify-between items-center">
              <h2 className="font-bold text-lg">Input Source</h2>
              <span className="font-mono text-[10px] text-[#141414]/70 uppercase tracking-wider">Step 01</span>
            </div>
            
            <div className="p-4">
              <div 
                {...getRootProps()} 
                className={cn(
                  "border-2 border-dashed border-[#141414]/20 rounded-sm p-8 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 text-center",
                  isDragActive && "border-[#141414] bg-[#141414]/5",
                  preview && "border-solid border-[#141414]/10 bg-transparent py-4"
                )}
              >
                <input {...getInputProps()} />
                {preview ? (
                  <div className="relative w-full group">
                    <img 
                      src={preview} 
                      alt="Job Card Preview" 
                      className="w-full h-auto max-h-[400px] object-contain border border-[#141414]/10"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-[#141414]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-[#E4E3E0] font-mono text-xs uppercase tracking-widest">Click or drag to replace</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-full border border-[#141414] flex items-center justify-center">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-medium">Drop job card image here</p>
                      <p className="text-xs text-[#141414]/70 mt-1">JPEG, PNG or WebP up to 10MB</p>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={handleProcess}
                disabled={!preview || loading}
                className={cn(
                  "w-full mt-4 py-4 px-6 bg-[#141414] text-[#E4E3E0] font-mono text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all active:translate-y-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] disabled:opacity-50 disabled:cursor-not-allowed",
                  loading && "cursor-wait"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    Extract Data
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </section>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-900/20 p-4 flex gap-3 text-red-900"
            >
              <AlertCircle className="shrink-0 w-5 h-5" />
              <div>
                <p className="font-bold text-sm">Extraction Failed</p>
                <p className="text-xs opacity-80 mt-1">{error}</p>
              </div>
            </motion.div>
          )}

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-green-50 border border-green-900/20 p-4 flex gap-3 text-green-900"
            >
              <CheckCircle2 className="shrink-0 w-5 h-5" />
              <div>
                <p className="font-bold text-sm">Success</p>
                <p className="text-xs opacity-80 mt-1">{successMessage}</p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white border border-[#141414] p-1 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] min-h-[600px] flex flex-col">
            <div className="p-4 border-b border-[#141414] flex justify-between items-center">
              <div className="flex items-center gap-4">
                <h2 className="font-bold text-lg">Extraction Results</h2>
                <div className="flex bg-[#E4E3E0] p-0.5 rounded-sm">
                  <button 
                    onClick={() => setViewMode('table')}
                    className={cn(
                      "p-1.5 rounded-sm transition-all",
                      viewMode === 'table' ? "bg-white shadow-sm" : "text-[#141414]/70 hover:opacity-100"
                    )}
                  >
                    <TableIcon size={14} />
                  </button>
                  <button 
                    onClick={() => setViewMode('json')}
                    className={cn(
                      "p-1.5 rounded-sm transition-all",
                      viewMode === 'json' ? "bg-white shadow-sm" : "text-[#141414]/70 hover:opacity-100"
                    )}
                  >
                    <LayoutGrid size={14} />
                  </button>
                </div>
              </div>
              <span className="font-mono text-[10px] text-[#141414]/70 uppercase tracking-wider">Step 02</span>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <AnimatePresence mode="wait">
                {!data && !loading && (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center text-center text-[#141414]/60 py-20"
                  >
                    <FileText size={48} strokeWidth={1} />
                    <p className="mt-4 font-medium">Upload and process an image to see results</p>
                  </motion.div>
                )}

                {loading && (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center text-center py-20"
                  >
                    <div className="relative">
                      <Loader2 size={48} className="animate-spin text-[#141414]" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-[#141414] rounded-full" />
                      </div>
                    </div>
                    <p className="mt-6 font-mono text-xs uppercase tracking-[0.2em]">Processing Image...</p>
                    <p className="mt-2 text-[10px] text-[#141414]/70 max-w-[200px]">Gemini is reading the handwritten details and table data</p>
                  </motion.div>
                )}

                {data && viewMode === 'table' && (
                  <motion.div 
                    key="table"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-8"
                  >
                    {/* Header Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                      <DetailRow icon={<User size={14}/>} label="Customer Name" value={data.job_card_details.customer_name} onChange={(v) => updateDetail('customer_name', v)} required showError={showErrors} />
                      <DetailRow icon={<Calendar size={14}/>} label="Date" value={data.job_card_details.date} onChange={(v) => updateDetail('date', v)} required showError={showErrors} inputType="date" />
                      <DetailRow icon={<Phone size={14}/>} label="Mobile" value={data.job_card_details.mobile_number} onChange={(v) => updateDetail('mobile_number', v)} required showError={showErrors} />
                      <DetailRow icon={<MapPin size={14}/>} label="Address" value={data.job_card_details.address} onChange={(v) => updateDetail('address', v)} required showError={showErrors} />
                      <DetailRow icon={<Hash size={14}/>} label="VIN Number" value={data.job_card_details.vin_number} onChange={(v) => updateDetail('vin_number', v)} required showError={showErrors} />
                      <DetailRow icon={<Calendar size={14}/>} label="Delivery Date" value={data.job_card_details.delivery_date} onChange={(v) => updateDetail('delivery_date', v)} required showError={showErrors} inputType="date" />
                      <DetailRow icon={<Truck size={14}/>} label="Vehicle Make" value={data.job_card_details.vehicle_make} onChange={(v) => updateDetail('vehicle_make', v)} required showError={showErrors} />
                      <DetailRow icon={<Hash size={14}/>} label="Registration" value={data.job_card_details.registration_number} onChange={(v) => updateDetail('registration_number', v)} required showError={showErrors} />
                      <DetailRow icon={<UserCheck size={14}/>} label="Work Done By" value={data.job_card_details.work_done_by} onChange={(v) => updateDetail('work_done_by', v)} required showError={showErrors} />
                      <DetailRow icon={<Gauge size={14}/>} label="KM Reading" value={data.job_card_details.km_reading} onChange={(v) => updateDetail('km_reading', v)} required showError={showErrors} />
                    </div>

                    {/* Accessories Table */}
                    <div className="border border-[#141414]">
                      <div className="bg-[#141414] text-[#E4E3E0] p-2 font-mono text-[10px] uppercase tracking-widest flex justify-between items-center">
                        <span>Details of Accessories</span>
                        <button onClick={addItem} className="flex items-center gap-1 hover:opacity-70 transition-opacity" title="Add row">
                          <Plus size={12} />
                          <span className="text-[9px]">Add Row</span>
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-[#141414] bg-[#141414]/5">
                              <th className="p-2 font-mono text-[10px] uppercase tracking-wider border-r border-[#141414]">Sl</th>
                              <th className="p-2 font-mono text-[10px] uppercase tracking-wider border-r border-[#141414]">Description</th>
                              <th className="p-2 font-mono text-[10px] uppercase tracking-wider border-r border-[#141414]">Qty</th>
                              <th className="p-2 font-mono text-[10px] uppercase tracking-wider border-r border-[#141414]">Material</th>
                              <th className="p-2 font-mono text-[10px] uppercase tracking-wider border-r border-[#141414]">Labour</th>
                              <th className="p-2 w-8"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.items.map((item, idx) => (
                              <tr key={idx} className="border-b border-[#141414] last:border-0 hover:bg-[#141414]/5 transition-colors group">
                                <td className="p-1 font-mono text-xs border-r border-[#141414]">
                                  <input type="text" value={item.sl_no} onChange={(e) => updateItem(idx, 'sl_no', e.target.value)} className="w-full bg-transparent focus:outline-none px-1" />
                                </td>
                                <td className="p-1 text-xs border-r border-[#141414]">
                                  <input type="text" value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} className="w-full bg-transparent focus:outline-none px-1" />
                                </td>
                                <td className="p-1 font-mono text-xs border-r border-[#141414]">
                                  <input type="text" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} className="w-full bg-transparent focus:outline-none px-1" />
                                </td>
                                <td className="p-1 font-mono text-xs border-r border-[#141414]">
                                  <input type="text" value={item.material_cost} onChange={(e) => updateItem(idx, 'material_cost', e.target.value)} className="w-full bg-transparent focus:outline-none px-1" />
                                </td>
                                <td className="p-1 font-mono text-xs border-r border-[#141414]">
                                  <input type="text" value={item.labour_cost} onChange={(e) => updateItem(idx, 'labour_cost', e.target.value)} className="w-full bg-transparent focus:outline-none px-1" />
                                </td>
                                <td className="p-1 text-center">
                                  <button onClick={() => removeItem(idx)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-all" title="Remove row">
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end">
                      <div className="w-full md:w-64 border border-[#141414]">
                        <TotalRow label="Material Total" value={data.totals.material_total} onChange={(v) => updateTotal('material_total', v)} />
                        <TotalRow label="Labour Total" value={data.totals.labour_total} onChange={(v) => updateTotal('labour_total', v)} />
                        <TotalRow label="Grand Total" value={data.totals.grand_total} highlight onChange={(v) => updateTotal('grand_total', v)} />
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex items-center justify-end gap-4 pt-2">
                      {submitStatus && (
                        <span className={cn(
                          "font-mono text-xs",
                          submitStatus.type === 'success' ? "text-green-700" : "text-red-700"
                        )}>
                          {submitStatus.message}
                        </span>
                      )}
                      <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className={cn(
                          "py-3 px-8 bg-[#141414] text-[#E4E3E0] font-mono text-sm uppercase tracking-[0.2em] flex items-center gap-3 transition-all active:translate-y-1 active:shadow-none shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed",
                          submitting && "cursor-wait"
                        )}
                      >
                        {submitting ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send size={16} />
                            Submit
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}

                {data && viewMode === 'json' && (
                  <motion.div 
                    key="json"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full"
                  >
                    <pre className="bg-[#141414] text-[#E4E3E0] p-4 rounded-sm font-mono text-xs overflow-auto h-full max-h-[500px] selection:bg-white selection:text-[#141414]">
                      {JSON.stringify(data, null, 2)}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto p-6 mt-12 border-t border-[#141414]/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-[10px] font-mono text-[#141414]/70 uppercase tracking-widest">
          &copy; 2024 Workshop Intelligence Systems. All rights reserved.
        </p>
        <div className="flex gap-6">
          <FooterLink label="Privacy" />
          <FooterLink label="Terms" />
          <FooterLink label="Support" />
        </div>
      </footer>
    </div>
  );
}

function DetailRow({ icon, label, value, onChange, required, showError, inputType = 'text' }: { icon: React.ReactNode, label: string, value: string, onChange?: (value: string) => void, required?: boolean, showError?: boolean, inputType?: 'text' | 'date' }) {
  const hasError = required && showError && !value?.trim();
  return (
    <div className="flex flex-col gap-1 border-b border-[#141414]/10 pb-2">
      <div className="flex items-center gap-2 text-[#141414]/70">
        {icon}
        <span className="font-mono text-[9px] uppercase tracking-wider">{label}</span>
      </div>
      {onChange ? (
        <input
          type={inputType}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Not specified"
          className={cn(
            "font-medium text-sm min-h-[1.25rem] bg-transparent border-b hover:border-[#141414]/20 focus:border-[#141414] focus:outline-none transition-colors placeholder:text-[#141414]/40",
            hasError ? "border-red-500" : "border-transparent"
          )}
        />
      ) : (
        <div className="font-medium text-sm min-h-[1.25rem]">
          {value || <span className="text-[#141414]/40">Not specified</span>}
        </div>
      )}
      {hasError && (
        <span className="font-mono text-[9px] text-red-600">{label} is required</span>
      )}
    </div>
  );
}

function TotalRow({ label, value, highlight, onChange }: { label: string, value: string, highlight?: boolean, onChange?: (value: string) => void }) {
  return (
    <div className={cn(
      "flex justify-between items-center p-3 border-b border-[#141414] last:border-0",
      highlight && "bg-[#141414] text-[#E4E3E0]"
    )}>
      <span className="font-mono text-[10px] uppercase tracking-widest">{label}</span>
      {onChange ? (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className={cn(
            "font-mono text-sm font-bold text-right bg-transparent focus:outline-none w-24",
            highlight ? "placeholder:text-[#E4E3E0]/40" : "placeholder:text-[#141414]/20"
          )}
        />
      ) : (
        <span className="font-mono text-sm font-bold">{value || '0.00'}</span>
      )}
    </div>
  );
}

function FooterLink({ label }: { label: string }) {
  return (
    <a href="#" className="text-[10px] font-mono text-[#141414]/60 hover:text-[#141414] transition-colors uppercase tracking-widest">
      {label}
    </a>
  );
}
