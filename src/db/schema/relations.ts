import { relations } from "drizzle-orm";
import { businessCountries } from "./businessCountries";
import { businessDocuments } from "./businessDocuments";
import { businessPhotos } from "./businessPhotos";
import { businessProfiles } from "./businessProfiles";
import { businessUserGroups } from "./businessUserGroups";
import { businessVideoLinks } from "./businessVideoLinks";
import { investorOpportunities } from "./investorOpportunities";
import { investorOpportunityBookmarks } from "./investorOpportunityBookmarks";
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
}));

export const personalDocumentsRelations = relations(personalDocuments, ({ one }) => ({
  user: one(users, {
    fields: [personalDocuments.userId],
    references: [users.id],
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
}));

export const businessDocumentsRelations = relations(businessDocuments, ({ one }) => ({
  business: one(businessProfiles, {
    fields: [businessDocuments.businessId],
    references: [businessProfiles.id],
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
  // loanApplications: many(loanApplications), // TODO: Re-add when loan applications are re-implemented
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
