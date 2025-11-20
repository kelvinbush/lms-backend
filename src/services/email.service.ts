import { Resend } from 'resend';
import { logger } from '../utils/logger';
import { config } from "dotenv";
import { render } from '@react-email/render';
import VerificationCodeTemplate from '../templates/email/verification-code-template';
import ResetPasswordTemplate from '../templates/email/reset-password-template';
import InternalInviteTemplate from '../templates/email/internal-invite-template';
import AccountDeactivationTemplate from '../templates/email/account-deactivation-template';
import AccountReactivationTemplate from '../templates/email/account-reactivation-template';
import WelcomeEmailTemplate from '../templates/email/welcome-email-template';

config({
  path: ".env.local"
})

export interface WelcomeEmailData {
  firstName: string;
  email: string;
  loginUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  termsUrl?: string;
  privacyUrl?: string;
  unsubscribeUrl?: string;
}

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface VerificationEmailData {
  firstName?: string;
  email: string;
  code: string;
}

export class EmailService {
  private resend: Resend;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not set in environment variables');
    }
    
    this.resend = new Resend(apiKey);
  }

  async sendWelcomeEmail(data: WelcomeEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const html = await render(
        WelcomeEmailTemplate({
          firstName: data.firstName,
          loginUrl: data.loginUrl || process.env.APP_URL || '#',
          supportEmail: data.supportEmail || process.env.SUPPORT_EMAIL || 'support@melaninkapital.com',
          supportPhone: data.supportPhone || process.env.SUPPORT_PHONE || '+254703680991',
        })
      );
      
      const result = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'Melanin Kapital <nore@melaninkapital.com>',
        to: [data.email],
        subject: 'Welcome to Melanin Kapital - Your Journey Begins Now! 🚀',
        html,
      });

      if (result.error) {
        logger.error('Failed to send welcome email:', result.error);
        return { success: false, error: result.error.message };
      }

      logger.info(`Welcome email sent successfully to ${data.email}`, { messageId: result.data?.id });
      return { success: true, messageId: result.data?.id };
    } catch (error) {
      logger.error('Error sending welcome email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendEmail(data: EmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const result = await this.resend.emails.send({
        from: data.from || process.env.FROM_EMAIL || 'Melanin Kapital <nore@melaninkapital.com>',
        to: [data.to],
        subject: data.subject,
        html: data.html,
      });

      if (result.error) {
        logger.error('Failed to send email:', result.error);
        return { success: false, error: result.error.message };
      }

      logger.info(`Email sent successfully to ${data.to}`, { messageId: result.data?.id });
      return { success: true, messageId: result.data?.id };
    } catch (error) {
      logger.error('Error sending email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendVerificationCodeEmail(data: VerificationEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const html = await render(
        VerificationCodeTemplate({ firstName: data.firstName || '', code: data.code })
      );

      const result = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'Melanin Kapital <nore@melaninkapital.com>',
        to: [data.email],
        subject: `Your verification code is ${data.code}`,
        html,
      });

      if (result.error) {
        logger.error('Failed to send verification code email:', result.error);
        return { success: false, error: result.error.message };
      }

      logger.info(`Verification email sent successfully to ${data.email}`, { messageId: result.data?.id });
      return { success: true, messageId: result.data?.id };
    } catch (error) {
      logger.error('Error sending verification code email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendResetPasswordEmail(data: VerificationEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const html = await render(
        ResetPasswordTemplate({ firstName: data.firstName || '', code: data.code })
      );

      const result = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'Melanin Kapital <nore@melaninkapital.com>',
        to: [data.email],
        subject: `Your password reset code is ${data.code}`,
        html,
      });

      if (result.error) {
        logger.error('Failed to send reset password email:', result.error);
        return { success: false, error: result.error.message };
      }

      logger.info(`Reset password email sent successfully to ${data.email}`, { messageId: result.data?.id });
      return { success: true, messageId: result.data?.id };
    } catch (error) {
      logger.error('Error sending reset password email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendInternalInviteEmail(params: { email: string; inviteUrl: string; role: 'super-admin' | 'admin' | 'member' }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const html = await render(
        InternalInviteTemplate({ role: params.role, inviteUrl: params.inviteUrl, firstName: "" })
      );

      const result = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'Melanin Kapital <nore@melaninkapital.com>',
        to: [params.email],
        subject: `You're invited to Melanin Kapital as ${params.role}`,
        html,
      });

      if (result.error) {
        logger.error('Failed to send internal invitation email:', result.error);
        return { success: false, error: result.error.message };
      }

      logger.info(`Internal invitation email sent to ${params.email}`, { messageId: result.data?.id });
      return { success: true, messageId: result.data?.id };
    } catch (error) {
      logger.error('Error sending internal invitation email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendAccountDeactivationEmail(params: { email: string; firstName?: string }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const html = await render(
        AccountDeactivationTemplate({ firstName: params.firstName || '' })
      );

      const result = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'Melanin Kapital <nore@melaninkapital.com>',
        to: [params.email],
        subject: 'Your Melanin Kapital Account Has Been Deactivated',
        html,
      });

      if (result.error) {
        logger.error('Failed to send account deactivation email:', result.error);
        return { success: false, error: result.error.message };
      }

      logger.info(`Account deactivation email sent to ${params.email}`, { messageId: result.data?.id });
      return { success: true, messageId: result.data?.id };
    } catch (error) {
      logger.error('Error sending account deactivation email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async sendAccountReactivationEmail(params: { email: string; firstName?: string; loginUrl?: string }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const html = await render(
        AccountReactivationTemplate({ 
          firstName: params.firstName || '',
          loginUrl: params.loginUrl || `${process.env.APP_URL?.replace(/\/$/, '') || ''}/login`
        })
      );

      const result = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'Melanin Kapital <nore@melaninkapital.com>',
        to: [params.email],
        subject: 'Your Melanin Kapital Account Has Been Reactivated',
        html,
      });

      if (result.error) {
        logger.error('Failed to send account reactivation email:', result.error);
        return { success: false, error: result.error.message };
      }

      logger.info(`Account reactivation email sent to ${params.email}`, { messageId: result.data?.id });
      return { success: true, messageId: result.data?.id };
    } catch (error) {
      logger.error('Error sending account reactivation email:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
