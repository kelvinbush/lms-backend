import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components';
import type * as React from 'react';

interface BaseTemplateProps {
  previewText: string;
  title: string;
  children: React.ReactNode;
  firstName?: string;
  supportEmail?: string;
  supportPhone?: string;
  termsUrl?: string;
  privacyUrl?: string;
  unsubscribeUrl?: string;
}

export const BaseTemplate = ({
  previewText,
  title,
  children,
  firstName = '',
  supportEmail = 'support@melaninkapital.com',
  supportPhone = '+254703680991',
  termsUrl = 'https://pjccitj0ny.ufs.sh/f/ewYz0SdNs1jLsw0JXtTaSljhRqXr6mBuJN1opUPFeKbcZg3k',
  privacyUrl = 'https://pjccitj0ny.ufs.sh/f/ewYz0SdNs1jLvFVCntHCgvpe94FiSQ72Z3oc8WVDqNGKtasB',
  unsubscribeUrl = '#',
}: BaseTemplateProps) => {
  return (
    <Html>
      <Head>
        <style>{`
          @media (prefers-color-scheme: dark) {
            .social-icon img {
              filter: brightness(0) invert(1);
            }
          }
        `}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Gradient header */}
          <Section style={headerGradient} />
          
          {/* Logo section */}
          <Section style={logoSection}>
            <Img
              src="https://pjccitj0ny.ufs.sh/f/ewYz0SdNs1jL8M1zErNi2bPEYGUlmSd57jZoNFuAsaIe0X6M"
              alt="Melanin Kapital"
              style={logo}
            />
          </Section>

          {/* Main content */}
          <Section style={content}>
            {firstName && (
              <Text style={greeting}>Hey {firstName},</Text>
            )}
            {children}
          </Section>

          {/* Footer */}
          <Section style={footer}>
            {/* Social media icons */}
            <Section style={socialSection}>
              <Link href="https://www.facebook.com/MelaninKapital/" style={socialLink}>
                <Img
                  src="https://img.icons8.com/ios-filled/50/444C53/facebook.png"
                  alt="Facebook"
                  style={socialIcon}
                />
              </Link>
              <Link href="https://www.instagram.com/melaninkapital/?__d=1" style={socialLink}>
                <Img
                  src="https://img.icons8.com/ios-filled/50/444C53/instagram.png"
                  alt="Instagram"
                  style={socialIcon}
                />
              </Link>
              <Link href="https://www.linkedin.com/company/melaninkapital/mycompany/?viewAsMember=true" style={socialLink}>
                <Img
                  src="https://img.icons8.com/ios-filled/50/444C53/linkedin.png"
                  alt="LinkedIn"
                  style={socialIcon}
                />
              </Link>
              <Link href="https://twitter.com/MelaninKapital" style={socialLink}>
                <Img
                  src="https://img.icons8.com/ios-filled/50/444C53/twitterx.png"
                  alt="X (Twitter)"
                  style={socialIcon}
                />
              </Link>
            </Section>

            <Text style={address}>
              Marcus Garvey Road, Highway Heights, 8th Floor, Nairobi, Kenya
            </Text>

            <Text style={footerLinks}>
              <Link href={termsUrl} style={footerLink}>Terms of Service</Link>
              {' | '}
              <Link href={privacyUrl} style={footerLink}>Privacy Policy</Link>
              {' | '}
              <Link href={unsubscribeUrl} style={footerLink}>Unsubscribe</Link>
            </Text>

            <Img
              src="https://utfs.io/f/Pwd0a72vgKCqYumOz4pSpkR9nTA8rh7qQwIKuVYsZBimy40d"
              alt="Logo"
              style={footerLogo}
            />
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Styles
const main = {
  backgroundColor: '#f8f9fa',
  fontFamily: 'Arial, sans-serif',
  margin: '0',
  padding: '0',
};

const container = {
  margin: '0 auto',
  backgroundColor: '#ffffff',
  maxWidth: '600px',
};

const headerGradient = {
  background: 'linear-gradient(90deg, #51EBEB 0%, #00CC99 100%)',
  height: '4px',
  width: '100%',
};

const logoSection = {
  backgroundColor: '#151F28',
  padding: '20px',
  textAlign: 'center' as const,
};

const logo = {
  width: '200px',
  height: 'auto',
  border: '0',
  display: 'block',
  margin: '0 auto',
};

const content = {
  padding: '30px',
  backgroundColor: 'white',
  color: '#151F28',
};

const greeting = {
  margin: '0 0 20px 0',
  padding: '0',
  fontWeight: '600',
  marginBlockEnd: '4px',
};

const footer = {
  padding: '20px',
  textAlign: 'center' as const,
};

const socialSection = {
  margin: '0 auto 20px auto',
  textAlign: 'center' as const,
};

const socialLink = {
  textDecoration: 'none',
  display: 'inline-block',
  margin: '0 8px',
  verticalAlign: 'middle',
};

const socialIcon = {
  width: '24px',
  height: '24px',
  display: 'block',
  border: '0',
  opacity: '0.7',
};

const address = {
  color: '#444C53',
  fontSize: '12px',
  margin: '0 0 10px 0',
  fontWeight: '600',
};

const footerLinks = {
  color: '#444C53',
  fontSize: '12px',
  margin: '0 0 10px 0',
};

const footerLink = {
  color: '#444C53',
  textDecoration: 'underline',
  margin: '0 5px',
};

const footerLogo = {
  width: '32px',
  height: '32px',
  border: '0',
  display: 'block',
  margin: '0 auto',
};
