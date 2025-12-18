import { Section, Text } from "@react-email/components";
import { BaseTemplate } from "./base-template";

interface VerificationCodeTemplateProps {
  firstName?: string;
  code: string;
}

const styles = {
  subtle: { color: "#151F28", fontSize: "14px" },
  label: { marginTop: "16px", fontSize: "14px", color: "#151F28" },
  codeBox: {
    display: "inline-block",
    marginTop: "12px",
    background: "#E8E9EA",
    borderRadius: "6px",
    padding: "12px 16px",
    fontSize: "32px",
    letterSpacing: "6px",
    fontWeight: 700,
    color: "#151F28",
  } as const,
  strong: { fontWeight: 700 },
};

export function VerificationCodeTemplate({ firstName = "", code }: VerificationCodeTemplateProps) {
  return (
    <BaseTemplate
      previewText={`Your verification code is ${code}`}
      title="Email verification"
      firstName={firstName}
    >
      <Section>
        <Text style={styles.subtle}>
          Thank you for joining Melanin Kapital! Please use the code below to verify your email and
          finish setting up your account.
        </Text>
        <Text style={styles.label}>Your verification code:</Text>
        <div style={styles.codeBox}>{code}</div>
        <Text style={styles.subtle}>
          Please note that this code is valid for{" "}
          <span style={styles.strong as any}>5 minutes</span>. If it expires, click the
          <span style={styles.strong as any}> "Resend Code" </span> button on the verification
          screen to receive a new one.
        </Text>
        <Text style={styles.subtle}>
          If you did not sign up to Melanin Kapital, please ignore this email or contact us at
          support@melaninkapital.com or
          <span style={styles.strong as any}> +254 703 680 991</span>
        </Text>
        <Text style={styles.subtle}>
          Warm regards,
          <br />
          The Melanin Kapital Team
        </Text>
      </Section>
    </BaseTemplate>
  );
}

export default VerificationCodeTemplate;
