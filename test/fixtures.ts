import { testDb } from "./db";
import {
  users,
  businessProfiles,
  personalDocuments,
  businessDocuments,
  loanApplications,
  loanProducts,
  organizations,
} from "../src/db/schema";
import {
  loanApplicationDocumentVerifications,
  type DocumentType,
  type DocumentVerificationStatus,
} from "../src/db/schema/loanApplicationDocumentVerifications";
import type { LoanApplicationDocumentVerifications } from "../src/db/schema/loanApplicationDocumentVerifications";
import { eq } from "drizzle-orm";

/**
 * Test fixtures for creating test data
 */

export interface TestUser {
  id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface TestLoanApplication {
  id: string;
  loanId: string;
  businessId: string;
  entrepreneurId: string;
  loanProductId: string;
  status: string;
}

/**
 * Create a test user (admin)
 */
export async function createTestAdmin(): Promise<TestUser> {
  const [user] = await testDb
    .insert(users)
    .values({
      clerkId: `clerk_test_admin_${Date.now()}`,
      email: `admin_${Date.now()}@test.com`,
      firstName: "Test",
      lastName: "Admin",
      role: "admin",
      onboardingStatus: "active",
    })
    .returning();

  return {
    id: user.id,
    clerkId: user.clerkId!,
    email: user.email,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    role: user.role || "",
  };
}

/**
 * Create a test user (entrepreneur)
 */
export async function createTestEntrepreneur(): Promise<TestUser> {
  const [user] = await testDb
    .insert(users)
    .values({
      clerkId: `clerk_test_entrepreneur_${Date.now()}`,
      email: `entrepreneur_${Date.now()}@test.com`,
      firstName: "Test",
      lastName: "Entrepreneur",
      role: "entrepreneur",
      onboardingStatus: "active",
    })
    .returning();

  return {
    id: user.id,
    clerkId: user.clerkId!,
    email: user.email,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    role: user.role || "",
  };
}

/**
 * Create a test organization
 */
export async function createTestOrganization(): Promise<string> {
  const [org] = await testDb
    .insert(organizations)
    .values({
      name: `Test Org ${Date.now()}`,
    })
    .returning();

  return org.id;
}

/**
 * Create a test loan product
 */
export async function createTestLoanProduct(organizationId: string): Promise<string> {
  const [product] = await testDb
    .insert(loanProducts)
    .values({
      organizationId,
      name: `Test Product ${Date.now()}`,
      description: "Test product description",
      currency: "USD",
      minAmount: "1000.00",
      maxAmount: "100000.00",
      minTerm: 1,
      maxTerm: 12,
      termUnit: "months",
      interestRate: "10.00",
      ratePeriod: "per_year",
      amortizationMethod: "reducing_balance",
      repaymentFrequency: "monthly",
      interestCollectionMethod: "installments",
      interestRecognitionCriteria: "when_accrued",
      status: "active",
      isActive: true,
    })
    .returning();

  return product.id;
}

/**
 * Create a test business profile
 */
export async function createTestBusiness(userId: string): Promise<string> {
  const [business] = await testDb
    .insert(businessProfiles)
    .values({
      userId,
      name: `Test Business ${Date.now()}`,
    })
    .returning();

  return business.id;
}

/**
 * Create a test personal document
 */
export async function createTestPersonalDocument(
  userId: string,
  docType: string = "national_id_front",
  docUrl: string = "https://test.com/doc.pdf"
): Promise<string> {
  const [doc] = await testDb
    .insert(personalDocuments)
    .values({
      userId,
      docType,
      docUrl,
    })
    .returning();

  return doc.id;
}

/**
 * Create a test business document
 */
export async function createTestBusinessDocument(
  businessId: string,
  docType: string = "business_registration",
  docUrl: string = "https://test.com/doc.pdf"
): Promise<string> {
  const [doc] = await testDb
    .insert(businessDocuments)
    .values({
      businessId,
      docType: docType as any,
      docUrl,
    })
    .returning();

  return doc.id;
}

/**
 * Create a test loan application
 */
export async function createTestLoanApplication(
  businessId: string,
  entrepreneurId: string,
  loanProductId: string,
  status: string = "kyc_kyb_verification"
): Promise<TestLoanApplication> {
  const loanId = `LN-${Date.now()}`;
  const [app] = await testDb
    .insert(loanApplications)
    .values({
      loanId,
      businessId,
      entrepreneurId,
      loanProductId,
      fundingAmount: "10000.00",
      fundingCurrency: "USD",
      repaymentPeriod: 6,
      intendedUseOfFunds: "Business expansion",
      interestRate: "10.00",
      status: status as any,
      createdBy: entrepreneurId,
      submittedAt: new Date(),
    })
    .returning();

  return {
    id: app.id,
    loanId: app.loanId,
    businessId: app.businessId,
    entrepreneurId: app.entrepreneurId,
    loanProductId: app.loanProductId,
    status: app.status,
  };
}

/**
 * Create a test verification record
 */
export async function createTestVerification(
  loanApplicationId: string,
  documentType: DocumentType,
  documentId: string,
  verificationStatus: DocumentVerificationStatus = "pending",
  verifiedBy?: string
): Promise<string> {
  const [verification] = await testDb
    .insert(loanApplicationDocumentVerifications)
    .values({
      loanApplicationId,
      documentType,
      documentId,
      verificationStatus,
      verifiedBy: verifiedBy || null,
      verifiedAt: verificationStatus !== "pending" ? new Date() : null,
    })
    .returning();

  return verification.id;
}

/**
 * Get a user by ID
 */
export async function getUserById(userId: string) {
  return await testDb.query.users.findFirst({
    where: eq(users.id, userId),
  });
}

/**
 * Get a loan application by ID
 */
export async function getLoanApplicationById(loanApplicationId: string) {
  return await testDb.query.loanApplications.findFirst({
    where: eq(loanApplications.id, loanApplicationId),
  });
}
