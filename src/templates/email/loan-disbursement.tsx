import { Button, Link, Section, Text } from "@react-email/components";
import { BaseTemplate } from "./base-template";

interface LoanDisbursementProps {
  firstName: string;
  loginUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  termsUrl?: string;
  privacyUrl?: string;
  unsubscribeUrl?: string;
}

export const LoanDisbursementEmail = ({
  firstName,
  loginUrl = "#",
  supportEmail,
  supportPhone,
  termsUrl,
  privacyUrl,
  unsubscribeUrl,
}: LoanDisbursementProps) => {
  return (
    <BaseTemplate
      previewText="Your loan has been successfully disbursed"
      title="Loan Disbursement Confirmation"
      firstName={firstName}
      supportEmail={supportEmail}
      supportPhone={supportPhone}
      termsUrl={termsUrl}
      privacyUrl={privacyUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={paragraph}>
        We are pleased to inform you that your loan has been <strong>successfully disbursed.</strong>
      </Text>

      <Text style={paragraph}>
        The funds should now be available in your designated account.
      </Text>

      <Section style={nextStepsBox}>
        <Text style={nextStepsTitle}>
          <span style={iconStyle}>💡</span> Your Next Steps:
        </Text>
        <Text style={nextStepText}>1. Check your account to confirm receipt of the funds.</Text>
        <Text style={nextStepText}>
          2. Log in to your Melanin Kapital account to view your repayment schedule and other loan
          details.
        </Text>
      </Section>

      <Section style={buttonSection}>
        <Button style={button} href={loginUrl}>
          <span style={buttonIconStyle}>✓</span> Log In Now
        </Button>
      </Section>

      <Text style={paragraph}>
        If you have any questions, notice any discrepancies, or need further assistance regarding
        your loan, please reach out to us at{" "}
        <Link href={`mailto:${supportEmail}`} style={link}>
          <strong>{supportEmail}</strong>
        </Link>{" "}
        or <strong>{supportPhone}</strong>
      </Text>

      <Text style={signature}>
        Warm regards,
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
  color: "#151F28",
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

const iconStyle = {
  marginRight: "8px",
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

const buttonIconStyle = {
  marginRight: "8px",
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
