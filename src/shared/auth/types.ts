export type AuthContext = {
  readonly organizationId: string
  readonly email: string
  readonly name: string
}

export type AuthSessionPayload = {
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresIn: number
  readonly organization: {
    readonly id: string
    readonly email: string
    readonly name: string
    readonly plan: string
    readonly preferredTranslationLanguage: string | null
  }
  readonly subscription: {
    readonly plan: string
    readonly status: string
    readonly hasAccess: boolean
    readonly isTrialing: boolean
    readonly isPaid: boolean
    readonly trialStartedAt: string
    readonly trialEndsAt: string
    readonly subscriptionPeriodEndsAt: string | null
    readonly daysRemainingInTrial: number | null
    readonly requiresPayment: boolean
  }
  readonly businessDetails: {
    readonly completed: boolean
    readonly completedAt: string | null
  }
}
