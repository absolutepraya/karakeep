CREATE TABLE `offlineSyncEvents` (
  `sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `userId` text NOT NULL,
  `entityType` text NOT NULL,
  `entityId` text NOT NULL,
  `operation` text NOT NULL,
  `changedFields` text NOT NULL,
  `createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `offlineSyncEvents_userId_sequence_idx`
  ON `offlineSyncEvents` (`userId`, `sequence`);
--> statement-breakpoint
CREATE TABLE `offlineSyncFieldVersions` (
  `bookmarkId` text NOT NULL,
  `field` text NOT NULL,
  `version` integer NOT NULL,
  PRIMARY KEY (`bookmarkId`, `field`),
  FOREIGN KEY (`bookmarkId`) REFERENCES `bookmarks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `offlineSyncMutationReceipts` (
  `userId` text NOT NULL,
  `idempotencyKey` text NOT NULL,
  `result` text NOT NULL,
  `createdAt` integer NOT NULL,
  PRIMARY KEY (`userId`, `idempotencyKey`)
);
