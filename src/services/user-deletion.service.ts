import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  businessProfiles,
  investorOpportunityBookmarks,
  personalDocuments,
  users,
} from "../db/schema";
import { CachingService } from "../modules/caching/caching.service";
import { logger } from "../utils/logger";

export class UserDeletionService {
  static async deleteUserAndAllRelatedData(clerkId: string): Promise<void> {
    try {
      logger.info("Starting user deletion process", { clerkId });

      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkId),
      });

      if (!user) {
        logger.warn("User not found for deletion", { clerkId });
        return;
      }

      const userId = user.id;
      logger.info("Found user for deletion", { userId, clerkId });

      // Wrap all deletions in a transaction
      await db.transaction(async (tx) => {
        // TODO: Re-add loan application related deletions when loan applications are re-implemented
        // This includes: documentRequests, loanApplicationSnapshots, applicationAuditTrail,
        // loanApplications, offerLetters

        await tx
          .delete(investorOpportunityBookmarks)
          .where(eq(investorOpportunityBookmarks.userId, userId));
        logger.info("Deleted investor opportunity bookmarks", { userId });

        await tx.delete(businessProfiles).where(eq(businessProfiles.userId, userId));
        logger.info("Deleted business profiles", { userId });

        await tx.delete(personalDocuments).where(eq(personalDocuments.userId, userId));
        logger.info("Deleted personal documents", { userId });

        await tx.delete(users).where(eq(users.id, userId));
        logger.info("Deleted user record", { userId, clerkId });
      });

      logger.info("User deletion completed successfully", {
        userId,
        clerkId,
        transactionCommitted: true,
      });

      // Invalidate all cache entries for this user
      try {
        logger.info("Invalidating cache for deleted user", { userId, clerkId });

        // Invalidate user-specific cache
        await CachingService.invalidateUser(userId);

        // TODO: Re-add loan application cache invalidation when loan applications are re-implemented

        logger.info("Cache invalidation completed for deleted user", { userId, clerkId });
      } catch (cacheError) {
        logger.error("Error invalidating cache after user deletion", {
          userId,
          clerkId,
          error: cacheError instanceof Error ? cacheError.message : cacheError,
        });
        // Don't throw - cache invalidation failure shouldn't prevent user deletion
      }
    } catch (error) {
      logger.error("Error during user deletion process - transaction rolled back", {
        clerkId,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }
}
