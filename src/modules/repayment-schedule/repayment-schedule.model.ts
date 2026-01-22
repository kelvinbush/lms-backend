export namespace RepaymentScheduleModel {
  export interface PaymentScheduleRow {
    paymentNo: number; // Sequential payment number (1, 2, 3, ...)
    dueDate: string; // ISO 8601 date string
    paymentDue: number; // Total payment amount due
    interest: number; // Interest portion (or revenue share)
    principal: number; // Principal portion (or capital redemption)
    outstandingBalance: number; // Remaining loan balance after payment
  }

  export interface RepaymentScheduleSummary {
    totalPaymentDue: number; // Sum of all paymentDue amounts
    totalInterest: number; // Sum of all interest amounts
    totalPrincipal: number; // Sum of all principal amounts
    monthlyPayment: number; // Regular monthly payment (excluding grace period)
    facilityFee: number; // Total facility fee from customFees
  }

  export interface LoanSummary {
    loanAmount: number;
    currency: string;
    repaymentPeriod: number;
    interestRate: number;
    repaymentStructure: string;
    repaymentCycle: string;
    gracePeriod: number;
    firstPaymentDate: string | null;
    returnType: string;
  }

  export interface RepaymentScheduleResponse {
    schedule: PaymentScheduleRow[];
    summary: RepaymentScheduleSummary;
    loanSummary: LoanSummary;
  }

  export const PaymentScheduleRowSchema = {
    type: "object",
    properties: {
      paymentNo: { type: "integer", minimum: 1 },
      dueDate: { type: "string", format: "date-time" },
      paymentDue: { type: "number" },
      interest: { type: "number" },
      principal: { type: "number" },
      outstandingBalance: { type: "number" },
    },
    required: ["paymentNo", "dueDate", "paymentDue", "interest", "principal", "outstandingBalance"],
  } as const;

  export const RepaymentScheduleSummarySchema = {
    type: "object",
    properties: {
      totalPaymentDue: { type: "number" },
      totalInterest: { type: "number" },
      totalPrincipal: { type: "number" },
      monthlyPayment: { type: "number" },
      facilityFee: { type: "number" },
    },
    required: ["totalPaymentDue", "totalInterest", "totalPrincipal", "monthlyPayment", "facilityFee"],
  } as const;

  export const LoanSummarySchema = {
    type: "object",
    properties: {
      loanAmount: { type: "number" },
      currency: { type: "string" },
      repaymentPeriod: { type: "integer" },
      interestRate: { type: "number" },
      repaymentStructure: { type: "string" },
      repaymentCycle: { type: "string" },
      gracePeriod: { type: "integer" },
      firstPaymentDate: { type: "string", format: "date-time", nullable: true },
      returnType: { type: "string" },
    },
    required: [
      "loanAmount",
      "currency",
      "repaymentPeriod",
      "interestRate",
      "repaymentStructure",
      "repaymentCycle",
      "gracePeriod",
      "returnType",
    ],
  } as const;

  export const RepaymentScheduleResponseSchema = {
    type: "object",
    properties: {
      schedule: {
        type: "array",
        items: PaymentScheduleRowSchema,
      },
      summary: RepaymentScheduleSummarySchema,
      loanSummary: LoanSummarySchema,
    },
    required: ["schedule", "summary", "loanSummary"],
  } as const;
}
