import * as React from 'react';
import { BaseTemplate } from './base-template';
import { Text, Button, Section } from '@react-email/components';

interface AccountReactivationTemplateProps {
  firstName: string;
  loginUrl: string;
}

export default function AccountReactivationTemplate({ firstName, loginUrl }: AccountReactivationTemplateProps) {
  return (
    <BaseTemplate
      previewText={`Your account has been reactivated`}
      title={`Account Reactivation Notice`}
      firstName={firstName}
    >
      <Text style={paragraph}>
        We're pleased to inform you that your Melanin Kapital account has been successfully <span style={boldText}>reactivated</span>. 
        You can now log in and resume using the platform without any restrictions.
      </Text>

      <Text style={paragraph}>
        Click the button below to log in to your account.
      </Text>

      <Section style={buttonSection}>
        <Button style={button} href={loginUrl}>
          <span style={buttonIcon}>🔑</span> Log In
        </Button>
      </Section>

      <Text style={supportText}>
        If you have any questions or need assistance, feel free to reach out to us at{' '}
        <a href="mailto:support@melaninkapital.com" style={link}>support@melaninkapital.com</a>
        {' '}or{' '}
        <a href="tel:+254703680991" style={link}>+254 703 680 991</a>
      </Text>

      <Text style={paragraph}>
        We're glad to have you back!
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

const buttonSection = {
  textAlign: 'center' as const,
  margin: '30px 0',
};

const button = {
  backgroundColor: '#151F28',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  display: 'inline-block',
  fontWeight: '500',
  fontSize: '16px',
  border: '0',
  fontFamily: 'Arial, sans-serif',
};

const buttonIcon = {
  marginRight: '8px',
  fontSize: '16px',
};

const supportText = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#151F28',
  margin: '20px 0',
  fontWeight: '400',
};

const link = {
  color: '#01337F',
  textDecoration: 'none',
};

const closing = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#151F28',
  margin: '30px 0 0 0',
  fontWeight: '400',
};

