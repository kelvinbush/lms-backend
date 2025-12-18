import { Button, Link, Section, Text } from "@react-email/components";
import { BaseTemplate } from "./base-template";

interface LoanStatusUpdateProps {
  firstName: string;
  loanApplicationId: string;
  previousStatus: string;
  newStatus: string;
  reason?: string;
  rejectionReason?: string;
  loginUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  termsUrl?: string;
  privacyUrl?: string;
  unsubscribeUrl?: string;
}

export const LoanStatusUpdateEmail = ({
  firstName,
  loanApplicationId,
  previousStatus,
  newStatus,
  reason,
  rejectionReason,
  loginUrl = "#",
  supportEmail,
  supportPhone,
  termsUrl,
  privacyUrl,
  unsubscribeUrl,
}: LoanStatusUpdateProps) => {
  const getStatusMessage = () => {
    switch (newStatus) {
      case "submitted":
        return {
          title: "Application Submitted Successfully",
          message: "Your loan application has been submitted and is now under review.",
          actionText: "View Application",
        };
      case "under_review":
        return {
          title: "Application Under Review",
          message: "Our team is now reviewing your loan application. We'll get back to you soon.",
          actionText: "Check Status",
        };
      case "approved":
        return {
          title: "Congratulations! Your Loan is Approved",
          message:
            "Great news! Your loan application has been approved. You'll receive further instructions shortly.",
          actionText: "View Details",
        };
      case "rejected":
        return {
          title: "Application Update",
          message:
            "We've reviewed your application and unfortunately cannot approve it at this time.",
          actionText: "View Details",
        };
      case "disbursed":
        return {
          title: "Funds Disbursed Successfully",
          message: "Your approved loan has been disbursed to your account.",
          actionText: "View Transaction",
        };
      default:
        return {
          title: "Application Status Updated",
          message: `Your loan application status has been updated to ${newStatus}.`,
          actionText: "View Application",
        };
    }
  };

  const statusInfo = getStatusMessage();

  return (
    <BaseTemplate
      previewText={`Your loan application status has been updated to ${newStatus}`}
      title={statusInfo.title}
      firstName={firstName}
      supportEmail={supportEmail}
      supportPhone={supportPhone}
      termsUrl={termsUrl}
      privacyUrl={privacyUrl}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text style={paragraph}>{statusInfo.message}</Text>

      <Section style={statusBox}>
        <Text style={statusLabel}>Application ID:</Text>
        <Text style={statusValue}>{loanApplicationId}</Text>

        <Text style={statusLabel}>Previous Status:</Text>
        <Text style={statusValue}>{previousStatus}</Text>

        <Text style={statusLabel}>Current Status:</Text>
        <Text style={statusValue}>{newStatus}</Text>

        {reason && (
          <>
            <Text style={statusLabel}>Reason:</Text>
            <Text style={statusValue}>{reason}</Text>
          </>
        )}

        {rejectionReason && (
          <>
            <Text style={statusLabel}>Rejection Reason:</Text>
            <Text style={statusValue}>{rejectionReason}</Text>
          </>
        )}
      </Section>

      {newStatus === "rejected" && (
        <Section style={helpSection}>
          <Text style={helpTitle}>Need Help?</Text>
          <Text style={helpText}>
            If you have questions about this decision or need assistance with your application, our
            team is here to help. You can also resubmit your application with additional information
            or corrections.
          </Text>
        </Section>
      )}

      <Section style={buttonSection}>
        <Button style={button} href={loginUrl}>
          {statusInfo.actionText}
        </Button>
      </Section>

      <Text style={paragraph}>
        If you have any questions, feel free to reach out to us at{" "}
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

const statusBox = {
  backgroundColor: "#f8f9fa",
  border: "1px solid #e9ecef",
  borderRadius: "8px",
  padding: "20px",
  margin: "20px 0",
};

const statusLabel = {
  fontWeight: "600",
  margin: "0 0 5px 0",
  color: "#151F28",
  fontSize: "14px",
};

const statusValue = {
  margin: "0 0 15px 0",
  color: "#6c757d",
  fontSize: "14px",
};

const helpSection = {
  backgroundColor: "#fff3cd",
  border: "1px solid #ffeaa7",
  borderRadius: "8px",
  padding: "20px",
  margin: "20px 0",
};

const helpTitle = {
  fontWeight: "600",
  margin: "0 0 10px 0",
  color: "#856404",
};

const helpText = {
  margin: "0",
  color: "#856404",
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

const link = {
  color: "#01337F",
  textDecoration: "none",
};

const signature = {
  margin: "20px 0 0 0",
  fontStyle: "italic",
  color: "#6c757d",
};
