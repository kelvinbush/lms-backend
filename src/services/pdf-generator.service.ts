import puppeteer from "puppeteer";
import { logger } from "../utils/logger";

export interface LoanOfferLetterData {
  offerNumber: string;
  loanAmount: string;
  currency: string;
  interestRate: string;
  offerTerm: number;
  expiresAt: Date;
  recipientName: string;
  recipientEmail: string;
  specialConditions?: string;
  requiresGuarantor: boolean;
  requiresCollateral: boolean;
  businessName?: string;
}

export class PDFGeneratorService {
  /**
   * Generate PDF from HTML content
   */
  private async generatePDFFromHTML(htmlContent: string): Promise<Buffer> {
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "20mm",
          right: "20mm",
          bottom: "20mm",
          left: "20mm",
        },
      });

      return Buffer.from(pdfBuffer);
    } catch (error) {
      logger.error("Error generating PDF:", error);
      throw new Error("Failed to generate PDF");
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Generate loan offer letter HTML content
   */
  private generateOfferLetterHTML(data: LoanOfferLetterData): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Loan Offer Letter - ${data.offerNumber}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #151F28;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .company-name {
            font-size: 24px;
            font-weight: bold;
            color: #151F28;
            margin-bottom: 5px;
          }
          .company-tagline {
            font-size: 14px;
            color: #666;
            font-style: italic;
          }
          .offer-title {
            font-size: 20px;
            font-weight: bold;
            color: #151F28;
            margin-bottom: 20px;
          }
          .offer-details {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #e9ecef;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid #e9ecef;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 600;
            color: #151F28;
          }
          .detail-value {
            font-weight: 500;
            color: #333;
          }
          .conditions-section {
            margin: 20px 0;
          }
          .conditions-title {
            font-size: 16px;
            font-weight: bold;
            color: #151F28;
            margin-bottom: 10px;
          }
          .condition-item {
            margin: 5px 0;
            padding-left: 20px;
            position: relative;
          }
          .condition-item:before {
            content: "•";
            position: absolute;
            left: 0;
            color: #151F28;
          }
          .signature-section {
            margin-top: 40px;
            border-top: 2px solid #151F28;
            padding-top: 20px;
          }
          .signature-line {
            margin: 30px 0;
          }
          .signature-label {
            font-weight: 600;
            margin-bottom: 5px;
          }
          .signature-space {
            border-bottom: 1px solid #333;
            height: 40px;
            margin-bottom: 10px;
          }
          .footer {
            margin-top: 40px;
            font-size: 12px;
            color: #666;
            text-align: center;
            border-top: 1px solid #e9ecef;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">Melanin Kapital</div>
          <div class="company-tagline">Empowering Black Entrepreneurs</div>
        </div>

        <div class="offer-title">Loan Offer Letter</div>
        
        <p>Dear ${data.recipientName},</p>
        
        <p>We are pleased to offer you a business loan through Melanin Kapital. After reviewing your application, we're excited to present you with the following terms:</p>

        <div class="offer-details">
          <div class="detail-row">
            <span class="detail-label">Offer Number:</span>
            <span class="detail-value">${data.offerNumber}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Loan Amount:</span>
            <span class="detail-value">${data.currency} ${data.loanAmount}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Interest Rate:</span>
            <span class="detail-value">${data.interestRate}% per annum</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Loan Term:</span>
            <span class="detail-value">${data.offerTerm} months</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Expires On:</span>
            <span class="detail-value">${data.expiresAt.toLocaleDateString()}</span>
          </div>
        </div>

        ${
          data.requiresGuarantor || data.requiresCollateral || data.specialConditions
            ? `
          <div class="conditions-section">
            <div class="conditions-title">Additional Requirements & Conditions</div>
            ${data.requiresGuarantor ? '<div class="condition-item">A guarantor is required for this loan</div>' : ""}
            ${data.requiresCollateral ? '<div class="condition-item">Collateral is required for this loan</div>' : ""}
            ${data.specialConditions ? `<div class="condition-item">${data.specialConditions}</div>` : ""}
          </div>
        `
            : ""
        }

        <p>To proceed with this offer, please review and sign this document to accept the terms and conditions.</p>

        <div class="signature-section">
          <p><strong>By signing below, I agree to the terms and conditions of this loan offer.</strong></p>
          
          <div class="signature-line">
            <div class="signature-label">Signature:</div>
            <div class="signature-space"></div>
          </div>
          
          <div class="signature-line">
            <div class="signature-label">Print Name:</div>
            <div class="signature-space"></div>
          </div>
          
          <div class="signature-line">
            <div class="signature-label">Date:</div>
            <div class="signature-space"></div>
          </div>
        </div>

        <div class="footer">
          <p>This is a legally binding document. Please read all terms carefully before signing.</p>
          <p>Melanin Kapital - Empowering Black Entrepreneurs</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate loan offer letter PDF
   */
  async generateOfferLetterPDF(data: LoanOfferLetterData): Promise<Buffer> {
    try {
      const htmlContent = this.generateOfferLetterHTML(data);
      const pdfBuffer = await this.generatePDFFromHTML(htmlContent);

      logger.info(`Generated PDF for offer letter: ${data.offerNumber}`);
      return pdfBuffer;
    } catch (error) {
      logger.error("Error generating offer letter PDF:", error);
      throw new Error("Failed to generate offer letter PDF");
    }
  }
}

export const pdfGeneratorService = new PDFGeneratorService();
