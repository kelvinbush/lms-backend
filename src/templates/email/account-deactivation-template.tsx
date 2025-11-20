import * as React from 'react';
import { BaseTemplate } from './base-template';
import { Text, Section } from '@react-email/components';

interface AccountDeactivationTemplateProps {
  firstName: string;
}

export default function AccountDeactivationTemplate({ firstName }: AccountDeactivationTemplateProps) {
  return (
    <BaseTemplate
      previewText={`Your account has been deactivated`}
      title={`Account Deactivation Notice`}
      firstName={firstName}
    >
      <Text style={paragraph}>
        We hope you're doing well.
      </Text>

      <Text style={paragraph}>
        We regret to inform you that your Melanin Kapital account has been <span style={boldText}>deactivated</span>. 
        This may be due to security reasons, policy compliance, or other administrative actions.
      </Text>

      <Text style={paragraph}>
        If you believe this was in error or need further assistance, please contact our support team for clarification.
      </Text>

      <Section style={contactSection}>
        <Text style={contactItem}>
          <span style={icon}>✉️</span>{' '}
          <a href="mailto:support@melaninkapital.com" style={link}>support@melaninkapital.com</a>
        </Text>
        <Text style={contactItem}>
          <span style={icon}>📞</span>{' '}
          <a href="tel:+254703680991" style={link}>+254 703 680 991</a>
        </Text>
      </Section>

      <Text style={paragraph}>
        We appreciate your cooperation and look forward to assisting you.
      </Text>

      <Text style={closing}>
        Warm regards,<br />
        The Melanin Kapital Team
      </Text>
    </BaseTemplate>
  );
}

// Styles
const paragraph = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#151F28',
  margin: '0 0 20px 0',
  fontWeight: '400',
};

const boldText = {
  fontWeight: '600',
};

const contactSection = {
  margin: '20px 0',
};

const contactItem = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#151F28',
  margin: '0 0 12px 0',
  fontWeight: '400',
};

const icon = {
  marginRight: '8px',
  fontSize: '16px',
  verticalAlign: 'middle',
};

const link = {
  color: '#151F28',
  textDecoration: 'none',
};

const closing = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#151F28',
  margin: '30px 0 0 0',
  fontWeight: '400',
};

