"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import Header from "@/components/Header";
import SoapInput from "@/components/SoapInput";
import SummaryPanel, { SummaryPanelSkeleton } from "@/components/SummaryPanel";
import CodesTable, { CodesTableSkeleton } from "@/components/CodesTable";
import AccuracyBar from "@/components/AccuracyBar";
import { analyzeNote, generateCodes, getErrorMessage } from "@/lib/api";
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
      status: "pending",
    }));

  const procedureCodes: SuggestedCode[] = summary.procedures
    .filter((procedure) => procedure.cptHint)
    .map((procedure) => ({
      id: `ai-${procedure.id}`,
      code: procedure.cptHint as string,
      description: procedure.description,
      type: "CPT",
      source: "AI",
      status: "pending",
    }));

  return [...diagnosisCodes, ...procedureCodes];
}

export default function Home() {
  const [soapNote, setSoapNote] = useState("");
  const [summary, setSummary] = useState<ClinicalSummary | null>(null);
  const [codes, setCodes] = useState<SuggestedCode[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);

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

  async function handleGenerateCodes() {
    if (!summary) return;
    setIsGeneratingCodes(true);
    try {
      const result = await generateCodes(summary);
      setCodes((prev) => [
        ...prev,
        ...result.map((code) => {
          optumCodeCounter += 1;
          return { ...code, id: `optum-${optumCodeCounter}`, source: "Optum" as const };
        }),
      ]);
    } catch (err) {
      toast.error(
        getErrorMessage(
          err,
          "Optum is not available yet. Please try again later."
        )
      );
    } finally {
      setIsGeneratingCodes(false);
    }
  }

  function handleAccept(id: string) {
    setCodes((prev) =>
      prev.map((code) =>
        code.id === id ? { ...code, status: "accepted" } : code
      )
    );
  }

  function handleReject(id: string) {
    setCodes((prev) =>
      prev.map((code) =>
        code.id === id ? { ...code, status: "rejected" } : code
      )
    );
  }

  function handleModify(id: string, nextCode: string, nextDescription: string) {
    setCodes((prev) =>
      prev.map((code) =>
        code.id === id
          ? {
              ...code,
              code: nextCode,
              description: nextDescription,
              status: "modified",
            }
          : code
      )
    );
  }

  function handleAddManual(code: string, description: string, type: CodeType) {
    manualCodeCounter += 1;
    setCodes((prev) => [
      ...prev,
      {
        id: `manual-${manualCodeCounter}`,
        code,
        description,
        type,
        source: "Manual",
        status: "accepted",
      },
    ]);
  }

  async function handleExport() {
    const payload = { summary, codes };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast.success("Summary copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
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
                onGenerateCodes={handleGenerateCodes}
                isGeneratingCodes={isGeneratingCodes}
              />
            )}
          </div>
        </div>

        {isGeneratingCodes && <CodesTableSkeleton />}
        {summary && !isGeneratingCodes && (
          <CodesTable
            codes={codes}
            isLoading={false}
            onAccept={handleAccept}
            onReject={handleReject}
            onModify={handleModify}
            onAddManual={handleAddManual}
          />
        )}
      </main>

      {codes.length > 0 && !isGeneratingCodes && (
        <AccuracyBar codes={codes} onExport={handleExport} />
      )}
    </div>
  );
}
