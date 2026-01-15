import { relations } from "drizzle-orm";
import { businessCountries } from "./businessCountries";
import { businessDocuments } from "./businessDocuments";
import { businessPhotos } from "./businessPhotos";
import { businessProfiles } from "./businessProfiles";
import { businessUserGroups } from "./businessUserGroups";
import { businessVideoLinks } from "./businessVideoLinks";
import { investorOpportunities } from "./investorOpportunities";
import { investorOpportunityBookmarks } from "./investorOpportunityBookmarks";
import { loanApplicationAuditTrail } from "./loanApplicationAuditTrail";
import { loanApplicationDocumentVerifications } from "./loanApplicationDocumentVerifications";
import { loanApplications } from "./loanApplications";
import { loanDocuments } from "./loanDocuments";
import { loanProducts } from "./loanProducts";
import { personalDocuments } from "./personalDocuments";
import { smeOnboardingProgress } from "./smeOnboardingProgress";
import { userGroupMembers } from "./userGroupMembers";
import { userGroups } from "./userGroups";
import { users } from "./users";

export const usersRelations = relations(users, ({ many, one }) => ({
  personalDocuments: many(personalDocuments),
  businessProfiles: many(businessProfiles),
  investorOpportunityBookmarks: many(investorOpportunityBookmarks),
  groupMemberships: many(userGroupMembers),
  onboardingProgress: one(smeOnboardingProgress),
  // Loan applications where user is the entrepreneur
  entrepreneurLoanApplications: many(loanApplications, { relationName: "entrepreneur" }),
  // Loan applications created by the user (as admin/member or entrepreneur)
  createdLoanApplications: many(loanApplications, { relationName: "creator" }),
  // Loan applications last updated by the user
  updatedLoanApplications: many(loanApplications, { relationName: "updater" }),
  // Loan application audit trail entries performed by the user
  loanApplicationAuditEntries: many(loanApplicationAuditTrail),
  // Loan applications where user completed eligibility assessment
  eligibilityAssessedLoanApplications: many(loanApplications, {
    relationName: "eligibility_assessor",
  }),
  // Loan applications where user completed credit assessment
  creditAssessedLoanApplications: many(loanApplications, { relationName: "credit_assessor" }),
  // Loan applications where user completed head of credit review
  headOfCreditReviewAssessedLoanApplications: many(loanApplications, {
    relationName: "head_of_credit_reviewer",
  }),
  // Loan applications where user completed internal approval CEO
  internalApprovalCeoAssessedLoanApplications: many(loanApplications, {
    relationName: "internal_approval_ceo_reviewer",
  }),
  // Loan documents uploaded by the user
  uploadedLoanDocuments: many(loanDocuments),
}));

export const personalDocumentsRelations = relations(personalDocuments, ({ one }) => ({
  user: one(users, {
    fields: [personalDocuments.userId],
    references: [users.id],
  }),
  verifiedForLoanApplication: one(loanApplications, {
    fields: [personalDocuments.verifiedForLoanApplicationId],
    references: [loanApplications.id],
  }),
}));

export const businessProfilesRelations = relations(businessProfiles, ({ one, many }) => ({
  owner: one(users, {
    fields: [businessProfiles.userId],
    references: [users.id],
  }),
  documents: many(businessDocuments),
  userGroups: many(businessUserGroups),
  countries: many(businessCountries),
  photos: many(businessPhotos),
  videoLinks: many(businessVideoLinks),
  loanApplications: many(loanApplications),
}));

export const businessDocumentsRelations = relations(businessDocuments, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [businessDocuments.businessId],
    references: [businessProfiles.id],
  }),
  verifiedForLoanApplication: one(loanApplications, {
    fields: [businessDocuments.verifiedForLoanApplicationId],
    references: [loanApplications.id],
  }),
}));

export const investorOpportunitiesRelations = relations(investorOpportunities, ({ many }) => ({
  bookmarks: many(investorOpportunityBookmarks),
}));

export const userGroupsRelations = relations(userGroups, ({ many }) => ({
  memberships: many(userGroupMembers),
}));

export const userGroupMembersRelations = relations(userGroupMembers, ({ one }) => ({
  user: one(users, {
    fields: [userGroupMembers.userId],
    references: [users.id],
  }),
  group: one(userGroups, {
    fields: [userGroupMembers.groupId],
    references: [userGroups.id],
  }),
}));

export const investorOpportunityBookmarksRelations = relations(
  investorOpportunityBookmarks,
  ({ one }) => ({
    user: one(users, {
      fields: [investorOpportunityBookmarks.userId],
      references: [users.id],
    }),
    opportunity: one(investorOpportunities, {
      fields: [investorOpportunityBookmarks.opportunityId],
      references: [investorOpportunities.id],
    }),
  })
);

export const loanProductsRelations = relations(loanProducts, ({ many }) => ({
  loanApplications: many(loanApplications),
}));

// Business User Groups Relation
export const businessUserGroupsRelations = relations(businessUserGroups, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [businessUserGroups.businessId],
    references: [businessProfiles.id],
  }),
  group: one(userGroups, {
    fields: [businessUserGroups.groupId],
    references: [userGroups.id],
  }),
}));

// Business Countries Relations
export const businessCountriesRelations = relations(businessCountries, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [businessCountries.businessId],
    references: [businessProfiles.id],
  }),
}));

// Business Photos Relations
export const businessPhotosRelations = relations(businessPhotos, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [businessPhotos.businessId],
    references: [businessProfiles.id],
  }),
}));

// Business Video Links Relations
export const businessVideoLinksRelations = relations(businessVideoLinks, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [businessVideoLinks.businessId],
    references: [businessProfiles.id],
  }),
}));

// SME Onboarding Progress Relations
export const smeOnboardingProgressRelations = relations(smeOnboardingProgress, ({ one }) => ({
  user: one(users, {
    fields: [smeOnboardingProgress.userId],
    references: [users.id],
  }),
}));

// Loan Applications Relations
export const loanApplicationsRelations = relations(loanApplications, ({ one, many }) => ({
  business: one(businessProfiles, {
    fields: [loanApplications.businessId],
    references: [businessProfiles.id],
  }),
  entrepreneur: one(users, {
    fields: [loanApplications.entrepreneurId],
    references: [users.id],
    relationName: "entrepreneur",
  }),
  loanProduct: one(loanProducts, {
    fields: [loanApplications.loanProductId],
    references: [loanProducts.id],
  }),
  creator: one(users, {
    fields: [loanApplications.createdBy],
    references: [users.id],
    relationName: "creator",
  }),
  lastUpdatedByUser: one(users, {
    fields: [loanApplications.lastUpdatedBy],
    references: [users.id],
    relationName: "updater",
  }),
  // Audit trail entries for this loan application
  auditTrail: many(loanApplicationAuditTrail),
  // Document verifications for this loan application
  documentVerifications: many(loanApplicationDocumentVerifications),
  // Loan documents for this loan application
  loanDocuments: many(loanDocuments),
  // Eligibility assessment completed by
  eligibilityAssessmentCompletedByUser: one(users, {
    fields: [loanApplications.eligibilityAssessmentCompletedBy],
    references: [users.id],
    relationName: "eligibility_assessor",
  }),
  // Credit assessment completed by
  creditAssessmentCompletedByUser: one(users, {
    fields: [loanApplications.creditAssessmentCompletedBy],
    references: [users.id],
    relationName: "credit_assessor",
  }),
  // Head of credit review completed by
  headOfCreditReviewCompletedByUser: one(users, {
    fields: [loanApplications.headOfCreditReviewCompletedBy],
    references: [users.id],
    relationName: "head_of_credit_reviewer",
  }),
  // Internal approval CEO completed by
  internalApprovalCeoCompletedByUser: one(users, {
    fields: [loanApplications.internalApprovalCeoCompletedBy],
    references: [users.id],
    relationName: "internal_approval_ceo_reviewer",
  }),
}));

// Loan Application Audit Trail Relations
export const loanApplicationAuditTrailRelations = relations(
  loanApplicationAuditTrail,
  ({ one }) => ({
    loanApplication: one(loanApplications, {
      fields: [loanApplicationAuditTrail.loanApplicationId],
      references: [loanApplications.id],
    }),
    performedBy: one(users, {
      fields: [loanApplicationAuditTrail.performedById],
      references: [users.id],
    }),
  })
);

// Loan Application Document Verifications Relations
export const loanApplicationDocumentVerificationsRelations = relations(
  loanApplicationDocumentVerifications,
  ({ one }) => ({
    loanApplication: one(loanApplications, {
      fields: [loanApplicationDocumentVerifications.loanApplicationId],
      references: [loanApplications.id],
    }),
    verifiedBy: one(users, {
      fields: [loanApplicationDocumentVerifications.verifiedBy],
      references: [users.id],
    }),
  })
);

// Loan Documents Relations
export const loanDocumentsRelations = relations(loanDocuments, ({ one }) => ({
  loanApplication: one(loanApplications, {
    fields: [loanDocuments.loanApplicationId],
    references: [loanApplications.id],
  }),
  uploadedByUser: one(users, {
    fields: [loanDocuments.uploadedBy],
    references: [users.id],
  }),
}));
