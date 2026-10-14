/** Client-side mirrors of the API DTOs. */

export interface SchemeDto {
  id: string;
  name: string;
  annualInterestRatePercent: number;
  tenureMonths: number;
  maxLtvPercent: number;
}

export interface QuotePlan {
  planId: string;
  planName: string;
  annualInterestRatePercent: number;
  tenureMonths: number;
  maxLtvPercent: number;
  appliedLtvPercent: number;
  eligibleLoanPaise: number;
  eligibleLoanRupees: number;
  eligibleLoanFormatted: string;
}

export interface QuoteResponse {
  rate24kPerGramRupees: number;
  grossWeightGrams: number;
  netWeightGrams: number;
  karat: number;
  pureGoldGrams: number;
  goldValuePaise: number;
  goldValueRupees: number;
  goldValueFormatted: string;
  plans: QuotePlan[];
}

export interface LeadCreatedResponse {
  applicationId: string;
  status: string;
  applicantName: string;
  maskedMobile: string;
  karat: number;
  grossWeightGrams: number;
  netWeightGrams: number;
  planId: string;
  pureGoldGrams: number;
  goldValueFormatted: string;
  eligibleLoanFormatted: string;
  createdAt: string;
}

export interface LeadListItem {
  applicationId: string;
  applicantName: string;
  maskedMobile: string;
  grossWeightGrams: number;
  netWeightGrams: number;
  karat: number;
  planId: string;
  planName: string;
  pureGoldGrams: number;
  eligibleLoanPaise: number;
  eligibleLoanRupees: number;
  status: string;
  createdAt: string;
}

export interface ToolActivityItem {
  tool: string;
  label: string;
  status: "ok" | "error";
  detail?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** tool activity attached to an assistant reply (not resent to the API) */
  activity?: ToolActivityItem[];
}
