import { Button, Section, Text } from "@react-email/components";
import { BaseTemplate } from "./base-template";

interface DocumentGenerationNotificationProps {
  approverName?: string;
  companyName: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string | null;
  loanType: string;
  loanRequested: string;
  preferredTenure: string;
  approvedCreditLimit?: string;
  approvedLoanTenure?: string;
  useOfFunds: string;
  loginUrl: string;
}

export const DocumentGenerationNotificationEmail = ({
  approverName,
  companyName,
  applicantName,
  applicantEmail,
  applicantPhone,
  loanType,
  loanRequested,
  preferredTenure,
  approvedCreditLimit,
  approvedLoanTenure,
  useOfFunds,
  loginUrl,
}: DocumentGenerationNotificationProps) => {
  const greetingName = approverName?.trim() || "Head of Credit";

  return (
    <BaseTemplate
      previewText={"Loan request has moved to Document Generation stage"}
      title={"Loan Request Ready for Document Generation"}
    >
      <Text style={greeting}>{`Dear ${greetingName},`}</Text>
      <Text style={paragraph}>
        A loan request has moved to the <strong>Document Generation</strong> stage and requires your
        attention. Below are the applicant's details and a summary of their loan request:
      </Text>

      <Section style={section}>
        <Text style={sectionTitle}>Entrepreneur Details:</Text>
        <Text style={detailLine}>
          🏢 <strong>Company Name:</strong> {companyName}
        </Text>
        <Text style={detailLine}>
          👤 <strong>Loan Applicant:</strong> {applicantName}
        </Text>
        <Text style={detailLine}>
          📧 <strong>Email Address:</strong> {applicantEmail}
        </Text>
        {applicantPhone ? (
          <Text style={detailLine}>
            📞 <strong>Phone Number:</strong> {applicantPhone}
          </Text>
        ) : null}
      </Section>

      <Section style={section}>
        <Text style={sectionTitle}>Loan Application Summary:</Text>
        <Text style={detailLine}>
          💰 <strong>Loan Type:</strong> {loanType}
        </Text>
        <Text style={detailLine}>
          💶 <strong>Loan Requested:</strong> {loanRequested}
        </Text>
        <Text style={detailLine}>
          ⏳ <strong>Preferred Loan Tenure:</strong> {preferredTenure}
        </Text>
        {approvedCreditLimit && (
          <Text style={detailLine}>
            ✅ <strong>Approved Credit Limit:</strong> {approvedCreditLimit}
          </Text>
        )}
        {approvedLoanTenure && (
          <Text style={detailLine}>
            ✅ <strong>Approved Loan Tenure:</strong> {approvedLoanTenure}
          </Text>
        )}
        <Text style={detailLine}>
          💡 <strong>Use of Funds:</strong> {useOfFunds}
        </Text>
      </Section>

      <Section style={section}>
        <Text style={sectionTitle}>Next Steps:</Text>
        <Text style={paragraph}>
          To view the full details and take the required action, please log in to the Admin Platform
          below:
        </Text>
        <Section style={buttonWrapper}>
          <Button style={button} href={loginUrl}>
            🔥 Log In
          </Button>
        </Section>
      </Section>

      <Text style={paragraph}>
        Warm regards,
        <br />
        The Melanin Kapital Team
      </Text>
    </BaseTemplate>
  );
};

const paragraph = {
  margin: "0 0 16px 0",
  lineHeight: "1.5",
  color: "#151F28",
  fontSize: "14px",
};

const section = {
  margin: "0 0 20px 0",
  padding: "16px",
  backgroundColor: "#F8F9FA",
  borderRadius: "8px",
  border: "1px solid #E9ECEF",
};

const greeting = {
  margin: "0 0 16px 0",
  fontSize: "14px",
  color: "#151F28",
  fontWeight: 600,
};

const sectionTitle = {
  fontSize: "14px",
  fontWeight: 700,
  margin: "0 0 12px 0",
  color: "#151F28",
};

const detailLine = {
  margin: "0 0 8px 0",
  fontSize: "14px",
  color: "#151F28",
};

const buttonWrapper = {
  textAlign: "left" as const,
  marginTop: "16px",
};

const button = {
  backgroundColor: "#151F28",
  color: "#ffffff",
  padding: "12px 24px",
  borderRadius: "6px",
  textDecoration: "none",
  fontWeight: 600,
  display: "inline-block",
};

export default DocumentGenerationNotificationEmail;
