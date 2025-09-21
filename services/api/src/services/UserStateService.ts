export interface UserState {
  step?: string;
  listingData?: any;
  listingId?: string;
  originalData?: any;
}

export class UserStateService {
  private static userStates = new Map<number, UserState>();

  static setUserState(userId: number, state: UserState): void {
    this.userStates.set(userId, state);
  }

  static getUserState(userId: number): UserState | undefined {
    return this.userStates.get(userId);
  }

  static clearUserState(userId: number): void {
    this.userStates.delete(userId);
  }

  static updateUserState(userId: number, updates: Partial<UserState>): void {
    const currentState = this.getUserState(userId) || {};
    this.setUserState(userId, { ...currentState, ...updates });
  }
}
