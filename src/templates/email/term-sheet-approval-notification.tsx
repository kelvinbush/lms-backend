import { Button, Link, Section, Text } from "@react-email/components";
import { BaseTemplate } from "./base-template";

interface TermSheetApprovalNotificationProps {
  firstName?: string;
  loginUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
}

export const TermSheetApprovalNotificationEmail = ({
  firstName,
  loginUrl = "#",
  supportEmail = "credit@melaninkapital.com",
  supportPhone = "+254 703 680 991",
}: TermSheetApprovalNotificationProps) => {
  const greetingName = firstName?.trim() || "Loan Applicant";

  return (
    <BaseTemplate
      previewText="Loan Request Approved - Term Sheet Ready for Review"
      title="Loan Request Approved"
    >
      <Text style={greeting}>{`Dear ${greetingName},`}</Text>
      <Text style={paragraph}>
        We are pleased to inform you that your loan request has been <strong>approved</strong>. As
        part of the next step in the process, we have attached a <strong>Term Sheet</strong> for
        your review and confirmation.
      </Text>

      <Text style={paragraph}>
        This document outlines the <strong>preliminary terms and conditions</strong> of your loan
        facility, including:
      </Text>

      <Section style={listSection}>
        <Text style={listItem}>• Approved credit limit</Text>
        <Text style={listItem}>• Interest rate</Text>
        <Text style={listItem}>• Loan tenure</Text>
        <Text style={listItem}>• Applicable loan fees</Text>
        <Text style={listItem}>• Repayment structure</Text>
        <Text style={listItem}>• Additional conditions or requirements</Text>
      </Section>

      <Text style={paragraph}>
        Kindly note that the term sheet is intended for <strong>discussion purposes only</strong>{" "}
        and does not constitute a binding commitment from Melanin Kapital.
      </Text>

      <Section style={nextStepsSection}>
        <Text style={nextStepsTitle}>
          💡 <strong>Your Next Step:</strong>
        </Text>
        <Text style={nextStepsText}>
          Log in to your Melanin Kapital account to <strong>approve</strong> the proposed terms.
          Once approved, your Loan Offer Letter will be generated and sent to you for signing.
        </Text>
        <Section style={buttonWrapper}>
          <Button style={button} href={loginUrl}>
            ✅ <strong>Log In Now</strong>
          </Button>
        </Section>
      </Section>

      <Text style={paragraph}>
        If you have any questions or would like amendments made to the Term Sheet before approval,
        please reach out to us at{" "}
        <Link href={`mailto:${supportEmail}`} style={link}>
          <strong>{supportEmail}</strong>
        </Link>{" "}
        or <strong>{supportPhone}</strong>.
      </Text>

      <Text style={paragraph}>
        Warm regards,
        <br />
        The Melanin Kapital Team
      </Text>
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

const listSection = {
  margin: "0 0 20px 0",
  paddingLeft: "20px",
};

const listItem = {
  margin: "0 0 8px 0",
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

export default TermSheetApprovalNotificationEmail;
