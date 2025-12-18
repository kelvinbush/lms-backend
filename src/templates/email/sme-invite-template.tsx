import { Button, Section, Text } from "@react-email/components";
import { BaseTemplate } from "./base-template";

interface SMEInviteTemplateProps {
  firstName: string;
  inviteUrl: string;
  supportEmail?: string;
  supportPhone?: string;
}

export default function SMEInviteTemplate({
  firstName,
  inviteUrl,
  supportEmail = "support@melaninkapital.com",
  supportPhone = "+254 703 680 991",
}: SMEInviteTemplateProps) {
  return (
    <BaseTemplate
      previewText="Welcome to Melanin Kapital - Your Journey Begins Now!"
      title="Welcome to Melanin Kapital"
      firstName={firstName}
      supportEmail={supportEmail}
      supportPhone={supportPhone}
    >
      <Text style={paragraph}>
        Welcome to <span style={boldText}>Melanin Kapital</span>, where every entrepreneur,
        visionary, and go-getter like you drives Africa's growth story! ✨
      </Text>

      <Text style={paragraph}>
        By joining us, you're not just banking—you're stepping into a movement of African champions
        transforming businesses, communities, and the planet.
      </Text>

      <Text style={paragraph}>Here's what you can expect as part of the Melanin family:</Text>

      <Text style={sectionHeading}>
        ☑ <span style={boldText}>Everything You Need to Know About Your Finances</span>
      </Text>
      <Text style={paragraph}>
        From insights on cash flows to funding opportunities, savings products, and loans, we've got
        you covered.
      </Text>

      <Text style={sectionHeading}>
        ☑ <span style={boldText}>Turning Good Deeds into Great Rewards</span>
      </Text>
      <Text style={paragraph}>
        The greener your actions, the more benefits you unlock. Climate action has never been more
        rewarding!
      </Text>

      <Text style={sectionHeading}>
        ☑ <span style={boldText}>We Leave Nobody Behind</span>
      </Text>
      <Text style={paragraph}>
        Not financing-ready yet? No worries—we're here to support you with expert guidance, program
        connections, and the right tools to help you thrive.
      </Text>

      <Text style={firstStepLabel}>
        💡 <span style={boldText}>Your First Step:</span>
      </Text>
      <Text style={paragraph}>
        Log in to your account and complete the onboarding checklist to boost your capital readiness
        and unlock the platform's full potential.
      </Text>

      <Section style={buttonSection}>
        <Button style={button} href={inviteUrl}>
          Log In Now
        </Button>
      </Section>

      <Text style={paragraph}>
        Let's lead the way to a brighter, greener, and more empowered Africa together—building the
        Africa we want tomorrow, one entrepreneur at a time.
      </Text>

      <Text style={closing}>
        With ambition and impact,
        <br />
        The Melanin Kapital Team.
      </Text>

      <Text style={paragraph}>
        PS: Got questions or need help? Feel free to reach out to us at{" "}
        <a href={`mailto:${supportEmail}`} style={link}>
          <span style={boldText}>{supportEmail}</span>
        </a>{" "}
        or call us at{" "}
        <a href={`tel:${supportPhone.replace(/\s/g, "")}`} style={link}>
          <span style={boldText}>{supportPhone}</span>
        </a>
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

const boldText = {
  fontWeight: "500",
};

const sectionHeading = {
  fontSize: "16px",
  fontWeight: "500",
  color: "#151F28",
  margin: "0 0 10px 0",
  padding: "0",
};

const firstStepLabel = {
  fontSize: "16px",
  fontWeight: "500",
  color: "#151F28",
  margin: "20px 0 10px 0",
  padding: "0",
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

const closing = {
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
