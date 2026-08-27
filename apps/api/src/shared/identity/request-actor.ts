/** HTTP principal resolved by the bearer guard. Not a system actor. */
export type RequestActor = {
  readonly userId: string;
};
