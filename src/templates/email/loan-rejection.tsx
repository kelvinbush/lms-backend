import { Button, Link, Section, Text } from "@react-email/components";
import { BaseTemplate } from "./base-template";

interface LoanRejectionProps {
  firstName?: string;
  rejectionReason: string;
  loginUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
}

export const LoanRejectionEmail = ({
  firstName,
  rejectionReason,
  loginUrl = "#",
  supportEmail = "credit@melaninkapital.com",
  supportPhone = "+254 703 680 991",
}: LoanRejectionProps) => {
  const greetingName = firstName?.trim() || "Loan Applicant";

  return (
    <BaseTemplate
      previewText="Loan Application Decision - Melanin Kapital"
      title="Loan Application Decision"
    >
      <Text style={greeting}>{`Dear ${greetingName},`}</Text>
      <Text style={paragraph}>
        We appreciate your interest in securing funding through <strong>Melanin Kapital</strong>.
        After careful review, we regret to inform you that your loan application cannot be approved
        at this time.
      </Text>

      <Section style={rejectionReasonBox}>
        <Text style={rejectionReasonTitle}>🚀 Reason for Rejection:</Text>
        <Text style={rejectionReasonText}>{rejectionReason}</Text>
      </Section>

      <Text style={paragraph}>
        While this decision was based on the current assessment, you are welcome to re-apply in the
        future once you're ready to submit a new application.
      </Text>

      <Section style={nextStepsSection}>
        <Text style={nextStepsTitle}>Next Steps:</Text>
        <Text style={nextStepsText}>
          Log in to your account to review your application and re-apply when you are ready.
        </Text>
        <Section style={buttonWrapper}>
          <Button style={button} href={loginUrl}>
            👋 Log In Now
          </Button>
        </Section>
      </Section>

      <Text style={paragraph}>
        If you require clarification or support regarding this decision, feel free to contact us at{" "}
        <Link href={`mailto:${supportEmail}`} style={link}>
          <strong>{supportEmail}</strong>
        </Link>{" "}
        or <strong>{supportPhone}</strong>.
      </Text>

      <Text style={paragraph}>
        We appreciate your understanding and remain committed to supporting you on your funding
        journey.
      </Text>

      <Text style={signature}>Warm regards,</Text>
      <Text style={signature}>The Melanin Kapital Team</Text>
    </BaseTemplate>
  );
};

const greeting = {
  margin: "0 0 16px 0",
  fontSize: "16px",
  color: "#151F28",
  fontWeight: 600,
};

const paragraph = {
  margin: "0 0 16px 0",
  lineHeight: "1.5",
  color: "#151F28",
  fontSize: "14px",
};

const rejectionReasonBox = {
  margin: "0 0 20px 0",
  padding: "16px",
  backgroundColor: "#F8F9FA",
  borderRadius: "8px",
  border: "1px solid #E9ECEF",
};

const rejectionReasonTitle = {
  fontSize: "14px",
  fontWeight: 700,
  margin: "0 0 8px 0",
  color: "#151F28",
};

const rejectionReasonText = {
  margin: "0",
  fontSize: "14px",
  color: "#151F28",
  lineHeight: "1.5",
};

const nextStepsSection = {
  margin: "0 0 20px 0",
};

const nextStepsTitle = {
  fontSize: "14px",
  fontWeight: 700,
  margin: "0 0 8px 0",
  color: "#151F28",
};

const nextStepsText = {
  margin: "0 0 12px 0",
  fontSize: "14px",
  color: "#151F28",
  lineHeight: "1.5",
};

const buttonWrapper = {
  textAlign: "left" as const,
  marginTop: "12px",
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

const link = {
  color: "#151F28",
  textDecoration: "underline",
};

const signature = {
  margin: "0 0 4px 0",
  fontSize: "14px",
  color: "#151F28",
};

export default LoanRejectionEmail;
