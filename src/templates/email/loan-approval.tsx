import { Button, Link, Section, Text } from "@react-email/components";
import { BaseTemplate } from "./base-template";

interface LoanApprovalProps {
  firstName: string;
  loanApplicationId: string;
  loanAmount: string;
  interestRate: string;
  termMonths: number;
  monthlyPayment: string;
  nextSteps: string[];
  loginUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  termsUrl?: string;
  privacyUrl?: string;
  unsubscribeUrl?: string;
}

export const LoanApprovalEmail = ({
  firstName,
  loanApplicationId,
  loanAmount,
  interestRate,
  termMonths,
  monthlyPayment,
  nextSteps,
  loginUrl = "#",
  supportEmail,
  supportPhone,
  termsUrl,
  privacyUrl,
  unsubscribeUrl,
}: LoanApprovalProps) => {
  return (
    <BaseTemplate
      previewText="🎉 Congratulations! Your loan has been approved"
      title="Congratulations! Your Loan is Approved"
      firstName={firstName}
      supportEmail={supportEmail}
      supportPhone={supportPhone}
      termsUrl={termsUrl}
      privacyUrl={privacyUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={paragraph}>
        We're thrilled to inform you that your loan application has been approved! You're one step
        closer to achieving your business goals.
      </Text>

      <Section style={celebrationBox}>
        <Text style={celebrationText}>🎉 Congratulations on your loan approval! 🎉</Text>
      </Section>

      <Section style={loanDetailsBox}>
        <Text style={detailsTitle}>Loan Details:</Text>

        <Text style={detailsLabel}>Application ID:</Text>
        <Text style={detailsValue}>{loanApplicationId}</Text>

        <Text style={detailsLabel}>Approved Amount:</Text>
        <Text style={detailsValue}>{loanAmount}</Text>

        <Text style={detailsLabel}>Interest Rate:</Text>
        <Text style={detailsValue}>{interestRate}</Text>

        <Text style={detailsLabel}>Term:</Text>
        <Text style={detailsValue}>{termMonths} months</Text>

        <Text style={detailsLabel}>Monthly Payment:</Text>
        <Text style={detailsValue}>{monthlyPayment}</Text>
      </Section>

      <Section style={nextStepsBox}>
        <Text style={nextStepsTitle}>Next Steps:</Text>
        {nextSteps.map((step, index) => (
          <Text key={index} style={nextStepText}>
            {index + 1}. {step}
          </Text>
        ))}
      </Section>

      <Section style={buttonSection}>
        <Button style={button} href={loginUrl}>
          View Loan Details
        </Button>
      </Section>

      <Section style={importantBox}>
        <Text style={importantTitle}>Important Information:</Text>
        <Text style={importantText}>
          • Please review your loan agreement carefully
          <br />• Keep track of your payment schedule
          <br />• Contact us immediately if you have any questions
          <br />• Your loan will be disbursed after final documentation
        </Text>
      </Section>

      <Text style={paragraph}>
        We're excited to be part of your business journey. If you have any questions about your loan
        or need assistance, please don't hesitate to contact us at{" "}
        <Link href={`mailto:${supportEmail}`} style={link}>
          {supportEmail}
        </Link>{" "}
        or {supportPhone}.
      </Text>

      <Text style={signature}>
        With ambition and impact,
        <br />
        The Melanin Kapital Team
      </Text>
    </BaseTemplate>
  );
};

// Styles
const paragraph = {
  margin: "0 0 20px 0",
  padding: "0",
  lineHeight: "1.5",
};

const celebrationBox = {
  backgroundColor: "#d4edda",
  border: "1px solid #c3e6cb",
  borderRadius: "8px",
  padding: "20px",
  margin: "20px 0",
  textAlign: "center" as const,
};

const celebrationText = {
  margin: "0",
  color: "#155724",
  fontSize: "18px",
  fontWeight: "600",
};

const loanDetailsBox = {
  backgroundColor: "#f8f9fa",
  border: "1px solid #e9ecef",
  borderRadius: "8px",
  padding: "20px",
  margin: "20px 0",
};

const detailsTitle = {
  fontWeight: "600",
  margin: "0 0 15px 0",
  color: "#151F28",
  fontSize: "16px",
};

const detailsLabel = {
  fontWeight: "600",
  margin: "0 0 5px 0",
  color: "#151F28",
  fontSize: "14px",
};

const detailsValue = {
  margin: "0 0 15px 0",
  color: "#6c757d",
  fontSize: "14px",
};

const nextStepsBox = {
  backgroundColor: "#e3f2fd",
  border: "1px solid #bbdefb",
  borderRadius: "8px",
  padding: "20px",
  margin: "20px 0",
};

const nextStepsTitle = {
  fontWeight: "600",
  margin: "0 0 15px 0",
  color: "#1565c0",
  fontSize: "16px",
};

const nextStepText = {
  margin: "0 0 8px 0",
  color: "#1565c0",
  fontSize: "14px",
  lineHeight: "1.5",
};

const buttonSection = {
  textAlign: "center" as const,
  margin: "30px 0",
};

const button = {
  backgroundColor: "#151F28",
  color: "white",
  padding: "12px 24px",
  borderRadius: "5px",
  textDecoration: "none",
  fontWeight: "bold",
  display: "inline-block",
  border: "none",
  cursor: "pointer",
};

const importantBox = {
  backgroundColor: "#fff3cd",
  border: "1px solid #ffeaa7",
  borderRadius: "8px",
  padding: "20px",
  margin: "20px 0",
};

const importantTitle = {
  fontWeight: "600",
  margin: "0 0 10px 0",
  color: "#856404",
};

const importantText = {
  margin: "0",
  color: "#856404",
  fontSize: "14px",
  lineHeight: "1.5",
};

const link = {
  color: "#01337F",
  textDecoration: "none",
};

const signature = {
  margin: "20px 0 0 0",
  fontStyle: "italic",
  color: "#6c757d",
};
