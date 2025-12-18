import AfricasTalking from "africastalking";
import { logger } from "../utils/logger";

/**
 * SMS Service for handling all SMS operations using Africa's Talking API
 */
export class SmsService {
  private static instance: SmsService;
  private sms: any;

  private constructor() {
    const username = process.env.AT_USERNAME || "";
    const apiKey = process.env.AT_API_KEY || "";

    if (!username || !apiKey) {
      logger.warn("Africa's Talking credentials not found. SMS service will not work properly.");
    }

    // Initialize the SDK
    const africastalking = AfricasTalking({
      apiKey,
      username,
    });

    // Get the SMS service
    this.sms = africastalking.SMS;
  }

  /**
   * Get the singleton instance of SmsService
   */
  public static getInstance(): SmsService {
    if (!SmsService.instance) {
      SmsService.instance = new SmsService();
    }
    return SmsService.instance;
  }

  /**
   * Send an OTP message to a phone number
   * @param phoneNumber The recipient's phone number (should include country code)
   * @param otp The OTP code to send
   * @param firstName The recipient's first name
   * @returns Promise with the result of the SMS sending operation
   */
  public async sendOtp(phoneNumber: string, otp: string, firstName: string): Promise<any> {
    try {
      const options = {
        to: [phoneNumber],
        message: `Dear ${firstName}, your verification code is: ${otp} valid for 10 minutes. Please do not share this code with anyone.`,
        from: process.env.AT_SENDER_ID,
      };

      const response = await this.sms.send(options);
      logger.info(`SMS sent to ${phoneNumber}`, { response });
      return response;
    } catch (error) {
      logger.error(`Failed to send SMS to ${phoneNumber}`, { error });
      throw error;
    }
  }
}

// Export a singleton instance
export const smsService = SmsService.getInstance();
