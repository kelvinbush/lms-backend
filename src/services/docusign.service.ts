import { logger } from "../utils/logger";

// DocuSign API configuration - Demo environment
const DOCUSIGN_API_BASE_URL = process.env.DOCUSIGN_BASE_URL || "https://demo.docusign.net/restapi";
const DOCUSIGN_AUTH_BASE_URL =
  process.env.DOCUSIGN_AUTH_BASE_URL || "https://account-d.docusign.com/oauth/token";
const DOCUSIGN_INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY;
const DOCUSIGN_USER_ID = process.env.DOCUSIGN_USER_ID;
const DOCUSIGN_PRIVATE_KEY = process.env.DOCUSIGN_PRIVATE_KEY?.replace(/\\n/g, "\n"); // Handle multiline private key
const DOCUSIGN_ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID;

// DocuSign API interfaces
export interface DocuSignEnvelope {
  envelopeId: string;
  status: string;
  statusChangedDateTime: string;
  documentsUri: string;
  recipientsUri: string;
  attachmentsUri: string;
  uri: string;
  emailSubject: string;
  emailBlurb: string;
  envelopeIdStamping: string;
  authoritative: string;
  enforceSignerVisibility: string;
  enableWetSign: string;
  allowMarkup: string;
  allowReassign: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  deliveredDateTime: string;
  sentDateTime: string;
  completedDateTime: string;
  voidedDateTime: string;
  voidedReason: string;
  deletedDateTime: string;
  declinedDateTime: string;
  autoNavigation: string;
  is21CFRPart11: string;
  isSignatureProviderEnvelope: string;
  anySigner: string;
  envelopeLocation: string;
  isDynamicEnvelope: string;
}

export interface DocuSignRecipient {
  recipientId: string;
  recipientIdGuid: string;
  email: string;
  name: string;
  userId: string;
  routingOrder: string;
  roleName: string;
  status: string;
  sentDateTime: string;
  deliveredDateTime: string;
  signedDateTime: string;
  declinedDateTime: string;
  declineReason: string;
  deliveryMethod: string;
  totalTabCount: string;
  requireIdLookup: string;
  idCheckConfigurationName: string;
  requireSignerCertificate: string;
  requireNotary: string;
  emailNotification: {
    emailSubject: string;
    emailBody: string;
    supportedLanguage: string;
  };
  signerName: string;
  signerEmail: string;
  recipientType: string;
  recipientTypeMetadata: {
    type: string;
    required: string;
    readOnly: string;
  };
  tabs: {
    signHereTabs: Array<{
      tabId: string;
      documentId: string;
      pageNumber: string;
      recipientId: string;
      xPosition: string;
      yPosition: string;
      anchorString: string;
      anchorXOffset: string;
      anchorYOffset: string;
      anchorUnits: string;
      name: string;
      optional: string;
      scaleValue: string;
      templateLocked: string;
      templateRequired: string;
      conditionalParentLabel: string;
      conditionalParentValue: string;
      tooltip: string;
    }>;
  };
}

export interface CreateEnvelopeRequest {
  emailSubject: string;
  emailBlurb: string;
  templateId?: string;
  templateRoles?: Array<{
    roleName: string;
    name: string;
    email: string;
    clientUserId?: string;
  }>;
  documents?: Array<{
    documentId: string;
    name: string;
    documentBase64: string;
    fileExtension: string;
  }>;
  recipients?: {
    signers: Array<{
      email: string;
      name: string;
      recipientId: string;
      routingOrder: string;
      clientUserId?: string;
      tabs?: {
        signHereTabs: Array<{
          documentId: string;
          pageNumber: string;
          recipientId: string;
          xPosition: string;
          yPosition: string;
          anchorString?: string;
          anchorXOffset?: string;
          anchorYOffset?: string;
          anchorUnits?: string;
        }>;
      };
    }>;
  };
  status: string;
  eventNotification?: {
    url: string;
    loggingEnabled: string;
    includeDocuments: string;
    includeCertificateOfCompletion: string;
    includeTimeZone: string;
    includeSenderAccountAsCustomField: string;
    envelopeEvents: Array<{
      envelopeEventStatusCode: string;
      includeDocuments: string;
    }>;
    recipientEvents: Array<{
      recipientEventStatusCode: string;
      includeDocuments: string;
    }>;
  };
}

export interface DocuSignWebhookEvent {
  event: string;
  apiVersion: string;
  uri: string;
  retryCount: string;
  configurationId: string;
  generatedDateTime: string;
  data: {
    accountId: string;
    userId: string;
    envelopeId: string;
    envelopeSummary: {
      envelopeId: string;
      uri: string;
      statusDateTime: string;
      status: string;
      emailSubject: string;
      emailBlurb: string;
      envelopeIdStamping: string;
      authoritative: string;
      enforceSignerVisibility: string;
      enableWetSign: string;
      allowMarkup: string;
      allowReassign: string;
      createdDateTime: string;
      lastModifiedDateTime: string;
      deliveredDateTime: string;
      sentDateTime: string;
      completedDateTime: string;
      voidedDateTime: string;
      voidedReason: string;
      deletedDateTime: string;
      declinedDateTime: string;
      autoNavigation: string;
      is21CFRPart11: string;
      isSignatureProviderEnvelope: string;
      anySigner: string;
      envelopeLocation: string;
      isDynamicEnvelope: string;
    };
  };
}

class DocuSignService {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private baseUri: string | null = null;

  /**
   * Get access token using JWT authentication
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!DOCUSIGN_INTEGRATION_KEY || !DOCUSIGN_USER_ID || !DOCUSIGN_PRIVATE_KEY) {
      throw new Error("DocuSign configuration is missing. Please check environment variables.");
    }

    try {
      // Use the correct DocuSign auth endpoint
      const tokenResponse = await fetch(DOCUSIGN_AUTH_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: this.generateJWT(),
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        logger.error("DocuSign auth error response:", errorText);
        throw new Error(`Failed to get access token: ${tokenResponse.statusText} - ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      this.accessToken = tokenData.access_token;
      this.tokenExpiry = new Date(Date.now() + tokenData.expires_in * 1000 - 60000); // 1 minute buffer

      return this.accessToken || "";
    } catch (error) {
      logger.error("Error getting DocuSign access token:", error);
      throw new Error("Failed to authenticate with DocuSign");
    }
  }

  /**
   * Generate JWT for DocuSign authentication
   */
  private generateJWT(): string {
    const jwt = require("jsonwebtoken");

    const payload = {
      iss: DOCUSIGN_INTEGRATION_KEY,
      sub: DOCUSIGN_USER_ID,
      aud: "account-d.docusign.com",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      scope: "signature impersonation",
    };

    return jwt.sign(payload, DOCUSIGN_PRIVATE_KEY, { algorithm: "RS256" });
  }

  /**
   * Get account ID from DocuSign
   */
  async getAccountId(): Promise<string> {
    try {
      const accessToken = await this.getAccessToken();
      const response = await fetch(
        `${DOCUSIGN_AUTH_BASE_URL.replace("/oauth/token", "/oauth/userinfo")}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.statusText}`);
      }

      const userInfo = await response.json();
      logger.info("DocuSign userinfo response:", JSON.stringify(userInfo, null, 2));

      if (userInfo.accounts && userInfo.accounts.length > 0) {
        const account = userInfo.accounts[0];
        // Store the base URI for use in API calls
        this.baseUri = `${account.base_uri}/restapi`;
        return account.account_id;
      }
      logger.warn("No accounts found in userinfo response, using environment variable");
      return DOCUSIGN_ACCOUNT_ID || "";
    } catch (error) {
      logger.error("Error getting DocuSign account ID:", error);
      throw new Error("Failed to get DocuSign account ID");
    }
  }

  /**
   * Create a new envelope (document for signing)
   */
  async createEnvelope(request: CreateEnvelopeRequest): Promise<DocuSignEnvelope> {
    try {
      const accessToken = await this.getAccessToken();

      // Get account ID and base URI dynamically
      const accountId = await this.getAccountId();
      const apiBaseUrl = this.baseUri || DOCUSIGN_API_BASE_URL;
      const envelopeUrl = `${apiBaseUrl}/v2.1/accounts/${accountId}/envelopes`;
      logger.info("Creating DocuSign envelope at:", envelopeUrl);
      logger.info("Using account ID:", accountId);
      logger.info("Using base URI:", apiBaseUrl);

      const response = await fetch(envelopeUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create envelope: ${response.statusText} - ${errorText}`);
      }

      const envelope = await response.json();
      logger.info("DocuSign envelope created successfully:", envelope.envelopeId);

      return envelope;
    } catch (error) {
      logger.error("Error creating DocuSign envelope:", error);
      throw error;
    }
  }

  /**
   * Get envelope status
   */
  async getEnvelopeStatus(envelopeId: string): Promise<DocuSignEnvelope> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `${DOCUSIGN_API_BASE_URL}/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes/${envelopeId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get envelope status: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error("Error getting DocuSign envelope status:", error);
      throw error;
    }
  }

  /**
   * Get envelope recipients
   */
  async getEnvelopeRecipients(envelopeId: string): Promise<{ signers: DocuSignRecipient[] }> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `${DOCUSIGN_API_BASE_URL}/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes/${envelopeId}/recipients`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get envelope recipients: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error("Error getting DocuSign envelope recipients:", error);
      throw error;
    }
  }

  /**
   * Void an envelope
   */
  async voidEnvelope(envelopeId: string, reason: string): Promise<void> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `${DOCUSIGN_API_BASE_URL}/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes/${envelopeId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "voided",
            voidedReason: reason,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to void envelope: ${response.statusText}`);
      }

      logger.info("DocuSign envelope voided successfully:", envelopeId);
    } catch (error) {
      logger.error("Error voiding DocuSign envelope:", error);
      throw error;
    }
  }

  /**
   * Send an envelope (change status from created to sent)
   */
  async sendEnvelope(envelopeId: string): Promise<void> {
    try {
      const accessToken = await this.getAccessToken();
      const accountId = await this.getAccountId();
      const apiBaseUrl = this.baseUri || DOCUSIGN_API_BASE_URL;

      const response = await fetch(
        `${apiBaseUrl}/v2.1/accounts/${accountId}/envelopes/${envelopeId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "sent",
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send envelope: ${response.statusText} - ${errorText}`);
      }

      logger.info("DocuSign envelope sent successfully:", envelopeId);
    } catch (error) {
      logger.error("Error sending DocuSign envelope:", error);
      throw error;
    }
  }

  /**
   * Get signing URL for embedded signing
   */
  async getSigningUrl(envelopeId: string, recipientId: string, returnUrl: string): Promise<string> {
    try {
      const accessToken = await this.getAccessToken();

      const accountId = await this.getAccountId();
      const apiBaseUrl = this.baseUri || DOCUSIGN_API_BASE_URL;
      const response = await fetch(
        `${apiBaseUrl}/v2.1/accounts/${accountId}/envelopes/${envelopeId}/views/recipient`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            authenticationMethod: "none",
            email: "",
            userName: "",
            recipientId: recipientId || "",
            returnUrl: returnUrl,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get signing URL: ${response.statusText}`);
      }

      const result = await response.json();
      return result.url;
    } catch (error) {
      logger.error("Error getting DocuSign signing URL:", error);
      throw error;
    }
  }

  /**
   * Process webhook event
   */
  async processWebhookEvent(event: any): Promise<void> {
    try {
      // Handle both webhook formats:
      // 1. Test format: event.data.envelopeSummary.envelopeId
      // 2. Real DocuSign format: event.data.envelopeId
      let envelopeId: string;
      let status: string;

      if (event.data?.envelopeSummary) {
        envelopeId = event.data.envelopeSummary.envelopeId;
        status = event.data.envelopeSummary.status;
      } else if (event.data?.envelopeId) {
        envelopeId = event.data.envelopeId;
        status = "unknown"; // Real DocuSign webhooks don't include status in this format
      } else {
        logger.error("Cannot extract envelope information from webhook event:", event);
        return;
      }

      logger.info(`Processing DocuSign webhook for envelope ${envelopeId} with status: ${status}`);

      // Here you would update your database based on the webhook event
      // For example, update the offer letter status in your database

      switch (status) {
        case "sent":
          logger.info(`Envelope ${envelopeId} has been sent`);
          break;
        case "delivered":
          logger.info(`Envelope ${envelopeId} has been delivered`);
          break;
        case "completed":
          logger.info(`Envelope ${envelopeId} has been completed (signed)`);
          break;
        case "declined":
          logger.info(`Envelope ${envelopeId} has been declined`);
          break;
        case "voided":
          logger.info(`Envelope ${envelopeId} has been voided`);
          break;
        case "unknown":
          // For real DocuSign webhooks, determine status from event type
          if (event.event === "envelope-delivered") {
            logger.info(`Envelope ${envelopeId} has been delivered`);
          } else if (event.event === "envelope-completed") {
            logger.info(`Envelope ${envelopeId} has been completed (signed)`);
          } else if (event.event === "envelope-declined") {
            logger.info(`Envelope ${envelopeId} has been declined`);
          } else if (event.event === "envelope-voided") {
            logger.info(`Envelope ${envelopeId} has been voided`);
          } else {
            logger.info(`Envelope ${envelopeId} received event: ${event.event}`);
          }
          break;
        default:
          logger.info(`Envelope ${envelopeId} status changed to: ${status}`);
      }
    } catch (error) {
      logger.error("Error processing DocuSign webhook event:", error);
      throw error;
    }
  }

  /**
   * Get envelope details
   */
  async getEnvelope(envelopeId: string): Promise<DocuSignEnvelope> {
    try {
      const accessToken = await this.getAccessToken();
      const accountId = await this.getAccountId();
      const apiBaseUrl = this.baseUri || DOCUSIGN_API_BASE_URL;

      const response = await fetch(
        `${apiBaseUrl}/v2.1/accounts/${accountId}/envelopes/${envelopeId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get envelope: ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error("Error getting DocuSign envelope:", error);
      throw new Error("Failed to get DocuSign envelope");
    }
  }
}

export const docuSignService = new DocuSignService();
