import { Section, Text } from "@react-email/components";
import { BaseTemplate } from "./base-template";

interface ResetPasswordTemplateProps {
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

export function ResetPasswordTemplate({ firstName = "", code }: ResetPasswordTemplateProps) {
  return (
    <BaseTemplate
      previewText={`Your password reset code is ${code}`}
      title="Password Reset"
      firstName={firstName}
    >
      <Section>
        <Text style={styles.subtle}>
          You requested to reset your password for your Melanin Kapital account. Please use the code
          below to complete the password reset process.
        </Text>
        <Text style={styles.label}>Your password reset code:</Text>
        <div style={styles.codeBox}>{code}</div>
        <Text style={styles.subtle}>
          Please note that this code is valid for{" "}
          <span style={styles.strong as any}>5 minutes</span>. If it expires, you can request a new
          password reset code.
        </Text>
        <Text style={styles.subtle}>
          If you did not request a password reset, please ignore this email or contact us at
          support@melaninkapital.com or
          <span style={styles.strong as any}> +254 703 680 991</span> if you have concerns about
          your account security.
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

export default ResetPasswordTemplate;
