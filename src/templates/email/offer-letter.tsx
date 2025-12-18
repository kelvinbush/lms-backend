import { Button, Heading, Hr, Section, Text } from "@react-email/components";
import { BaseTemplate } from "./base-template";

interface OfferLetterEmailProps {
  firstName: string;
  recipientName: string;
  loanAmount: string;
  currency: string;
  loanTerm: number;
  interestRate: string;
  offerLetterUrl: string;
  expiresAt: string;
  specialConditions?: string;
  requiresGuarantor?: boolean;
  requiresCollateral?: boolean;
  supportEmail?: string;
  supportPhone?: string;
  termsUrl?: string;
  privacyUrl?: string;
  unsubscribeUrl?: string;
}

export const OfferLetterEmail = ({
  firstName,
  recipientName,
  loanAmount,
  currency,
  loanTerm,
  interestRate,
  offerLetterUrl,
  expiresAt,
  specialConditions,
  requiresGuarantor = false,
  requiresCollateral = false,
  supportEmail = "support@melaninkapital.com",
  supportPhone = "+254703680991",
  termsUrl = "https://pjccitj0ny.ufs.sh/f/ewYz0SdNs1jLsw0JXtTaSljhRqXr6mBuJN1opUPFeKbcZg3k",
  privacyUrl = "https://pjccitj0ny.ufs.sh/f/ewYz0SdNs1jLvFVCntHCgvpe94FiSQ72Z3oc8WVDqNGKtasB",
  unsubscribeUrl = "#",
}: OfferLetterEmailProps) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <BaseTemplate
      previewText={`Your loan offer letter is ready for review - ${currency} ${loanAmount} at ${interestRate}% interest`}
      title="Loan Offer Letter Ready for Review"
      firstName={firstName}
      supportEmail={supportEmail}
      supportPhone={supportPhone}
      termsUrl={termsUrl}
      privacyUrl={privacyUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Heading style={heading}>🎉 Congratulations! Your Loan Offer is Ready</Heading>

      <Text style={paragraph}>
        Great news! We're excited to present you with a loan offer for your business. After
        reviewing your application, we're pleased to offer you the following terms:
      </Text>

      {/* Loan Terms Section */}
      <Section style={termsSection}>
        <Heading style={sectionHeading}>Loan Offer Details</Heading>

        <Section style={termRow}>
          <Text style={termLabel}>Loan Amount:</Text>
          <Text style={termValue}>
            {currency} {loanAmount}
          </Text>
        </Section>

        <Section style={termRow}>
          <Text style={termLabel}>Interest Rate:</Text>
          <Text style={termValue}>{interestRate}% per annum</Text>
        </Section>

        <Section style={termRow}>
          <Text style={termLabel}>Loan Term:</Text>
          <Text style={termValue}>{loanTerm} months</Text>
        </Section>

        <Section style={termRow}>
          <Text style={termLabel}>Expires On:</Text>
          <Text style={termValue}>{formatDate(expiresAt)}</Text>
        </Section>

        {(requiresGuarantor || requiresCollateral) && (
          <>
            <Hr style={divider} />
            <Heading style={sectionHeading}>Additional Requirements</Heading>

            {requiresGuarantor && (
              <Text style={requirementText}>• A guarantor is required for this loan</Text>
            )}

            {requiresCollateral && (
              <Text style={requirementText}>• Collateral is required for this loan</Text>
            )}
          </>
        )}

        {specialConditions && (
          <>
            <Hr style={divider} />
            <Heading style={sectionHeading}>Special Conditions</Heading>
            <Text style={paragraph}>{specialConditions}</Text>
          </>
        )}
      </Section>

      <Text style={paragraph}>
        To proceed with this offer, please review and sign the complete loan agreement using the
        secure DocuSign link below. The document contains all terms, conditions, and legal
        requirements.
      </Text>

      <Section style={buttonSection}>
        <Button style={button} href={offerLetterUrl}>
          Review & Sign Loan Agreement
        </Button>
      </Section>

      <Text style={paragraph}>
        <strong>Important:</strong> This offer expires on {formatDate(expiresAt)}. Please ensure you
        review and sign the agreement before this date to secure your loan.
      </Text>

      <Text style={paragraph}>
        If you have any questions about the terms or need assistance with the signing process, don't
        hesitate to reach out to our team. We're here to help you every step of the way.
      </Text>

      <Text style={paragraph}>
        Thank you for choosing Melanin Kapital for your business financing needs. We're excited to
        be part of your growth journey!
      </Text>

      <Text style={signature}>
        With ambition and impact,
        <br />
        The Melanin Kapital Team
      </Text>

      <Hr style={divider} />

      <Text style={disclaimer}>
        <strong>Disclaimer:</strong> This email contains sensitive financial information. Please
        keep it secure and do not share it with unauthorized parties. If you did not request this
        loan offer, please contact us immediately.
      </Text>
    </BaseTemplate>
  );
};

// Additional styles for offer letter specific elements
const heading = {
  fontSize: "24px",
  fontWeight: "600",
  color: "#151F28",
  margin: "0 0 20px 0",
  textAlign: "center" as const,
};

const paragraph = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#151F28",
  margin: "0 0 20px 0",
};

const termsSection = {
  backgroundColor: "#f8f9fa",
  padding: "20px",
  borderRadius: "8px",
  margin: "20px 0",
  border: "1px solid #e9ecef",
};

const sectionHeading = {
  fontSize: "18px",
  fontWeight: "600",
  color: "#151F28",
  margin: "0 0 15px 0",
};

const termRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  margin: "10px 0",
  padding: "8px 0",
  borderBottom: "1px solid #e9ecef",
};

const termLabel = {
  fontSize: "14px",
  fontWeight: "500",
  color: "#6c757d",
  margin: "0",
  flex: "1",
};

const termValue = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#151F28",
  margin: "0",
  textAlign: "right" as const,
  flex: "1",
};

const requirementText = {
  fontSize: "14px",
  color: "#151F28",
  margin: "5px 0",
  paddingLeft: "10px",
};

const buttonSection = {
  textAlign: "center" as const,
  margin: "30px 0",
};

const button = {
  backgroundColor: "#151F28",
  color: "#ffffff",
  padding: "12px 30px",
  borderRadius: "6px",
  textDecoration: "none",
  fontSize: "16px",
  fontWeight: "600",
  display: "inline-block",
  border: "none",
  cursor: "pointer",
};

const signature = {
  fontSize: "16px",
  color: "#151F28",
  margin: "30px 0 20px 0",
  fontStyle: "italic",
};

const divider = {
  border: "none",
  borderTop: "1px solid #e9ecef",
  margin: "20px 0",
};

const disclaimer = {
  fontSize: "12px",
  color: "#6c757d",
  margin: "20px 0 0 0",
  fontStyle: "italic",
  lineHeight: "1.4",
};

export default OfferLetterEmail;
