CREATE TABLE `option_votes` (
	`option_id` text NOT NULL,
	`voter_hash` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`option_id`, `voter_hash`)
);
