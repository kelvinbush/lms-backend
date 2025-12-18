import { Button, Section, Text } from "@react-email/components";
import { BaseTemplate } from "./base-template";

interface InternalInviteTemplateProps {
  role: "super-admin" | "admin" | "member";
  inviteUrl: string;
  firstName: string;
}

export default function InternalInviteTemplate({
  role,
  inviteUrl,
  firstName,
}: InternalInviteTemplateProps) {
  return (
    <BaseTemplate
      previewText={"Welcome to Melanin Kapital"}
      title={`You're invited as ${role}`}
      firstName={firstName}
    >
      <Text style={paragraph}>
        Welcome to Melanin Kapital! An account has been created for you on our platform. We're
        excited to have you on board.
      </Text>

      <Text style={nextStepLabel}>
        <span style={lightbulbIcon}>💡</span> Your Next Step:
      </Text>

      <Text style={paragraph}>
        To activate your account and access the platform, click the button below to set your
        password.
      </Text>

      <Section style={buttonSection}>
        <Button style={button} href={inviteUrl}>
          <span style={buttonIcon}>👆</span> Complete Account Setup
        </Button>
      </Section>

      <Text style={securityNotice}>
        For security reasons, this link will expire in <span style={boldText}>72 hours</span>.
      </Text>

      <Text style={supportText}>
        If you have any questions or need assistance, feel free to reach out to us at{" "}
        <a href="mailto:support@melaninkapital.com" style={link}>
          support@melaninkapital.com
        </a>{" "}
        or{" "}
        <a href="tel:+254703680991" style={link}>
          +254 703 680 991
        </a>
      </Text>

      <Text style={closing}>
        Warm regards,
        <br />
        The Melanin Kapital Team
      </Text>
    </BaseTemplate>
  );
}

// Styles
const paragraph = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#151F28",
  margin: "0 0 20px 0",
  fontWeight: "400",
};

const nextStepLabel = {
  fontSize: "16px",
  fontWeight: "500",
  color: "#151F28",
  margin: "0 0 10px 0",
  padding: "0",
};

const lightbulbIcon = {
  marginRight: "8px",
  fontSize: "16px",
};

const buttonSection = {
  textAlign: "center" as const,
  margin: "30px 0",
};

const button = {
  backgroundColor: "#151F28",
  color: "#ffffff",
  padding: "12px 24px",
  borderRadius: "8px",
  textDecoration: "none",
  display: "inline-block",
  fontWeight: "500",
  fontSize: "16px",
  border: "0",
};

const buttonIcon = {
  marginRight: "8px",
  fontSize: "16px",
};

const securityNotice = {
  fontSize: "14px",
  lineHeight: "1.6",
  color: "#444C53",
  margin: "20px 0",
  fontWeight: "400",
};

const boldText = {
  fontWeight: "500",
};

const supportText = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#151F28",
  margin: "20px 0",
  fontWeight: "400",
};

const link = {
  color: "#01337F",
  textDecoration: "none",
};

const closing = {
  fontSize: "16px",
  lineHeight: "1.6",
  color: "#151F28",
  margin: "30px 0 0 0",
  fontWeight: "400",
};
