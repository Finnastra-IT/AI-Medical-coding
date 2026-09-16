import type { ClinicalSummary, SuggestedCode } from "./types";

export const MOCK_SOAP_PLACEHOLDER = `S: Pt reports numbness and tingling in both feet for 3 months, worse at night. Denies chest pain or shortness of breath.
O: BP 148/92. A1c 8.2%. Decreased sensation to monofilament testing bilateral feet.
A: Type 2 diabetes mellitus with diabetic peripheral neuropathy. Essential hypertension, uncontrolled.
P: Increase metformin to 1000mg BID. Start lisinopril 10mg daily. Refer to podiatry. F/u 4 weeks.`;

export const mockClinicalSummary: ClinicalSummary = {
  encounter: {
    type: "Office Visit - Established Patient",
    date: new Date().toISOString().slice(0, 10),
    provider: "Attending Physician",
  },
  briefSummary: "Type 2 diabetes with peripheral neuropathy; hypertension",
  diagnoses: [
    {
      id: "dx-1",
      condition: "Type 2 diabetes mellitus with diabetic polyneuropathy",
      attributes: [
        { label: "Status", value: "Uncontrolled" },
        { label: "A1c", value: "8.2%" },
        { label: "Laterality", value: "Bilateral" },
      ],
    },
    {
      id: "dx-2",
      condition: "Essential hypertension",
      attributes: [
        { label: "Status", value: "Uncontrolled" },
        { label: "BP Reading", value: "148/92" },
      ],
    },
  ],
  procedures: [
    {
      id: "px-1",
      description: "Office/outpatient visit, established patient, low complexity",
    },
  ],
  negations: [
    { id: "neg-1", text: "No chest pain" },
    { id: "neg-2", text: "No shortness of breath" },
  ],
  clarificationsNeeded: [
    "Confirm whether the peripheral neuropathy affects both feet equally or is worse on one side, for accurate laterality coding.",
    "Confirm whether hypertension is a new diagnosis this visit or a known condition being managed, to select the correct code.",
  ],
};

export const mockSuggestedCodes: SuggestedCode[] = [
  {
    id: "code-1",
    code: "E11.42",
    description:
      "Type 2 diabetes mellitus with diabetic polyneuropathy",
    type: "ICD-10",
    source: "AI",
    status: "pending",
  },
  {
    id: "code-2",
    code: "I10",
    description: "Essential (primary) hypertension",
    type: "ICD-10",
    source: "AI",
    status: "pending",
  },
  {
    id: "code-3",
    code: "99213",
    description:
      "Office or other outpatient visit, established patient, low complexity",
    type: "CPT",
    source: "AI",
    status: "pending",
  },
];
