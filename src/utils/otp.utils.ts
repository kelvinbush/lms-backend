import { logger } from "./logger";

/**
 * Utility functions for OTP generation and validation
 */
export class OtpUtils {
  /**
   * Generate a random OTP code of specified length
   * @param length Length of the OTP code (default: 6)
   * @returns A random numeric OTP code
   */
  static generateOtp(length = 6): string {
    // Generate a random number with the specified number of digits
    const min = 10 ** (length - 1);
    const max = 10 ** length - 1;
    const otp = Math.floor(min + Math.random() * (max - min + 1)).toString();

    logger.debug(`Generated OTP: ${otp}`);
    return otp;
  }

  /**
   * Calculate the expiry time for an OTP
   * @param minutes Minutes until expiry (default: 10)
   * @returns Date object representing the expiry time
   */
  static calculateExpiryTime(minutes = 10): Date {
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + minutes);
    return expiryTime;
  }

  /**
   * Check if an OTP has expired
   * @param expiryTime The expiry time to check against
   * @returns Boolean indicating if the OTP has expired
   */
  static isOtpExpired(expiryTime: Date | null): boolean {
    if (!expiryTime) return true;
    return new Date() > new Date(expiryTime);
  }

  /**
   * Validate an OTP against the stored value and expiry time
   * @param inputOtp The OTP provided by the user
   * @param storedOtp The OTP stored in the database
   * @param expiryTime The expiry time of the OTP
   * @returns Boolean indicating if the OTP is valid
   */
  static validateOtp(inputOtp: string, storedOtp: string | null, expiryTime: Date | null): boolean {
    if (!storedOtp || !expiryTime) {
      logger.debug("No stored OTP or expiry time found");
      return false;
    }

    if (OtpUtils.isOtpExpired(expiryTime)) {
      logger.debug("OTP has expired");
      return false;
    }

    const isValid = inputOtp === storedOtp;
    logger.debug(`OTP validation result: ${isValid}`);
    return isValid;
  }
}
