CREATE TABLE `listCollaborationScopes` (
	`listId` text NOT NULL,
	`userId` text NOT NULL,
	`recursive` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`listId`, `userId`),
	FOREIGN KEY (`listId`) REFERENCES `bookmarkLists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `listCollaborationScopes_userId_idx` ON `listCollaborationScopes` (`userId`);
