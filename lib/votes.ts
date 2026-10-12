export const CAKE_OPTION = 'cake';
export const FIRST_GIFT_OPTION = 'gift-elversberg-bodysuit';
export const giftOption = (id: string) => `gift:${id}`;
export type VoteCount = { count: number; upvoted: boolean };
export type VoteCounts = Record<string, VoteCount>;

export function validateVote(input: unknown): { optionId: string; upvoted: boolean } {
  if (!input || typeof input !== 'object') throw new Error('Please choose an option to upvote.');
  const { optionId, upvoted } = input as Record<string, unknown>;
  if (typeof optionId !== 'string' || !(optionId === CAKE_OPTION || optionId === FIRST_GIFT_OPTION || /^gift:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(optionId))) {
    throw new Error('Please choose a cake or gift option from this page.');
  }
  if (typeof upvoted !== 'boolean') throw new Error('Please choose whether to add or remove your upvote.');
  return { optionId, upvoted };
}
