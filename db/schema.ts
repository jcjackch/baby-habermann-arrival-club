import { sqliteTable, text, integer, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';
export const entries = sqliteTable('entries', {
  id:text('id').primaryKey(), name:text('name').notNull(), nameKey:text('name_key').notNull(),
  participantHash:text('participant_hash').notNull(), predictedDate:text('predicted_date').notNull(),
  predictedHour:integer('predicted_hour').notNull().default(12),
  amountCents:integer('amount_cents').notNull(), createdAt:text('created_at').notNull(),
},table=>[uniqueIndex('entries_name_key_unique').on(table.nameKey),uniqueIndex('entries_participant_unique').on(table.participantHash)]);
export const event = sqliteTable('event', { id:integer('id').primaryKey(), arrivalDate:text('arrival_date').notNull(), arrivalAt:text('arrival_at').notNull() });
export const giftSuggestions = sqliteTable('gift_suggestions', {
  id:text('id').primaryKey(), title:text('title').notNull(), url:text('url').notNull(),
  note:text('note').notNull(), addedBy:text('added_by').notNull(), createdAt:text('created_at').notNull(),
});
export const optionVotes = sqliteTable('option_votes', {
  optionId:text('option_id').notNull(), voterHash:text('voter_hash').notNull(), createdAt:text('created_at').notNull(),
},table=>[primaryKey({ columns:[table.optionId,table.voterHash] })]);
