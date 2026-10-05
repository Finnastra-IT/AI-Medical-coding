"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import Header from "@/components/Header";
import SoapInput from "@/components/SoapInput";
import SummaryPanel, { SummaryPanelSkeleton } from "@/components/SummaryPanel";
import CodesTable from "@/components/CodesTable";
import { analyzeNote, getErrorMessage } from "@/lib/api";
import { appendCodesToExcelFile, isExcelExportSupported } from "@/lib/excelExport";
import type { ClinicalSummary, CodeType, SuggestedCode } from "@/lib/types";

let manualCodeCounter = 0;
let optumCodeCounter = 0;

function codesFromSummary(summary: ClinicalSummary): SuggestedCode[] {
  const diagnosisCodes: SuggestedCode[] = summary.diagnoses
    .filter((diagnosis) => diagnosis.icd10Hint)
    .map((diagnosis) => ({
      id: `ai-${diagnosis.id}`,
      code: diagnosis.icd10Hint as string,
      description: diagnosis.condition,
      type: "ICD-10",
      source: "AI",
    }));

  const procedureCodes: SuggestedCode[] = summary.procedures
    .filter((procedure) => procedure.cptHint)
    .map((procedure) => ({
      id: `ai-${procedure.id}`,
      code: procedure.cptHint as string,
      description: procedure.description,
      type: procedure.codeType ?? "CPT",
      source: "AI",
      modifier: procedure.modifier,
      units: procedure.units,
    }));

  return [...diagnosisCodes, ...procedureCodes];
}

export default function Home() {
  const [soapNote, setSoapNote] = useState("");
  const [summary, setSummary] = useState<ClinicalSummary | null>(null);
  const [codes, setCodes] = useState<SuggestedCode[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [caseId, setCaseId] = useState("");

  const currentStep = useMemo<1 | 2 | 3>(() => {
    if (codes.length > 0) return 3;
    if (summary) return 2;
    return 1;
  }, [summary, codes]);

  async function handleAnalyze() {
    setIsAnalyzing(true);
    try {
      const result = await analyzeNote(soapNote);
      setSummary(result);
      setCodes(codesFromSummary(result));
    } catch (err) {
      toast.error(
        getErrorMessage(err, "Failed to analyze note. Please try again.")
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleOptumCodeSelected(selection: {
    id: string;
    code: string;
    description: string;
    type: CodeType;
  }) {
    setCodes((prev) => {
      const existingIndex = prev.findIndex((code) => code.id === selection.id);
      const nextCode: SuggestedCode = { ...selection, source: "Optum" };
      if (existingIndex === -1) {
        return [...prev, nextCode];
      }
      const next = [...prev];
      next[existingIndex] = nextCode;
      return next;
    });
  }

  function handleAddFromOptum(code: string, description: string, type: CodeType) {
    optumCodeCounter += 1;
    setCodes((prev) => [
      ...prev,
      {
        id: `optum-${optumCodeCounter}`,
        code,
        description,
        type,
        source: "Optum",
      },
    ]);
  }

  function handleAddManual(
    code: string,
    description: string,
    type: CodeType,
    modifier?: string,
    units?: number
  ) {
    manualCodeCounter += 1;
    setCodes((prev) => [
      ...prev,
      {
        id: `manual-${manualCodeCounter}`,
        code,
        description,
        type,
        source: "Manual",
        modifier,
        units,
      },
    ]);
  }

  function handleReset() {
    setSoapNote("");
    setSummary(null);
    setCodes([]);
    setCaseId("");
  }

  async function handleExportExcel() {
    if (!isExcelExportSupported()) {
      toast.error(
        "Excel export needs Chrome or Edge — this browser doesn't support direct file access."
      );
      return;
    }
    try {
      await appendCodesToExcelFile(caseId.trim(), codes);
      toast.success(
        `Added ${codes.length} code${codes.length === 1 ? "" : "s"} to the Excel file`
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(getErrorMessage(err, "Could not export to Excel."));
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header currentStep={currentStep} />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex flex-1 lg:w-1/2">
            <SoapInput
              value={soapNote}
              onChange={setSoapNote}
              onAnalyze={handleAnalyze}
              onReset={handleReset}
              canReset={
                soapNote.trim().length > 0 ||
                summary !== null ||
                codes.length > 0 ||
                caseId.trim().length > 0
              }
              isAnalyzing={isAnalyzing}
            />
          </div>

          <div className="flex flex-1 lg:w-1/2">
            {isAnalyzing ? (
              <SummaryPanelSkeleton />
            ) : (
              <SummaryPanel
                summary={summary}
                onChange={setSummary}
                onOptumCodeSelected={handleOptumCodeSelected}
              />
            )}
          </div>
        </div>

        {summary && (
          <CodesTable
            codes={codes}
            isLoading={false}
            caseId={caseId}
            onCaseIdChange={setCaseId}
            onAddManual={handleAddManual}
            onAddFromOptum={handleAddFromOptum}
            onExportExcel={handleExportExcel}
          />
        )}
      </main>
    </div>
  );
}
