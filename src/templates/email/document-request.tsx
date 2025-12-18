import { Button, Link, Section, Text } from "@react-email/components";
import { BaseTemplate } from "./base-template";

interface DocumentRequestProps {
  firstName: string;
  loanApplicationId: string;
  documentType: string;
  description: string;
  dueDate?: string;
  loginUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  termsUrl?: string;
  privacyUrl?: string;
  unsubscribeUrl?: string;
}

export const DocumentRequestEmail = ({
  firstName,
  loanApplicationId,
  documentType,
  description,
  dueDate,
  loginUrl = "#",
  supportEmail,
  supportPhone,
  termsUrl,
  privacyUrl,
  unsubscribeUrl,
}: DocumentRequestProps) => {
  return (
    <BaseTemplate
      previewText={`Document request for your loan application: ${documentType}`}
      title="Additional Documents Required"
      firstName={firstName}
      supportEmail={supportEmail}
      supportPhone={supportPhone}
      termsUrl={termsUrl}
      privacyUrl={privacyUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={paragraph}>
        We need some additional documents to continue processing your loan application. Please
        upload the requested documents as soon as possible to avoid delays.
      </Text>

      <Section style={requestBox}>
        <Text style={requestLabel}>Application ID:</Text>
        <Text style={requestValue}>{loanApplicationId}</Text>

        <Text style={requestLabel}>Document Type:</Text>
        <Text style={requestValue}>{documentType}</Text>

        <Text style={requestLabel}>Description:</Text>
        <Text style={requestValue}>{description}</Text>

        {dueDate && (
          <>
            <Text style={requestLabel}>Due Date:</Text>
            <Text style={requestValue}>{dueDate}</Text>
          </>
        )}
      </Section>

      <Section style={instructionsBox}>
        <Text style={instructionsTitle}>How to Upload Documents:</Text>
        <Text style={instructionsText}>
          1. Log in to your account
          <br />
          2. Navigate to your loan application
          <br />
          3. Click on "Upload Documents"
          <br />
          4. Select the requested document type
          <br />
          5. Upload your file and submit
        </Text>
      </Section>

      <Section style={buttonSection}>
        <Button style={button} href={loginUrl}>
          Upload Documents
        </Button>
      </Section>

      <Section style={tipsBox}>
        <Text style={tipsTitle}>Document Tips:</Text>
        <Text style={tipsText}>
          • Ensure documents are clear and readable
          <br />• Use PDF format when possible
          <br />• Include all pages of multi-page documents
          <br />• Make sure file size is under 10MB
        </Text>
      </Section>

      <Text style={paragraph}>
        If you have any questions about the required documents or need assistance with the upload
        process, please contact us at{" "}
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

const requestBox = {
  backgroundColor: "#f8f9fa",
  border: "1px solid #e9ecef",
  borderRadius: "8px",
  padding: "20px",
  margin: "20px 0",
};

const requestLabel = {
  fontWeight: "600",
  margin: "0 0 5px 0",
  color: "#151F28",
  fontSize: "14px",
};

const requestValue = {
  margin: "0 0 15px 0",
  color: "#6c757d",
  fontSize: "14px",
};

const instructionsBox = {
  backgroundColor: "#e3f2fd",
  border: "1px solid #bbdefb",
  borderRadius: "8px",
  padding: "20px",
  margin: "20px 0",
};

const instructionsTitle = {
  fontWeight: "600",
  margin: "0 0 10px 0",
  color: "#1565c0",
};

const instructionsText = {
  margin: "0",
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

const tipsBox = {
  backgroundColor: "#f3e5f5",
  border: "1px solid #e1bee7",
  borderRadius: "8px",
  padding: "20px",
  margin: "20px 0",
};

const tipsTitle = {
  fontWeight: "600",
  margin: "0 0 10px 0",
  color: "#7b1fa2",
};

const tipsText = {
  margin: "0",
  color: "#7b1fa2",
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
