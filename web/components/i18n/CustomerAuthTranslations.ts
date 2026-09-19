'use client';

import { useMemo } from 'react';
import { useLanguage } from './LanguageProvider';

const english = {
  'customerAuth.badge': 'Secure account',
  'customerAuth.passwordHint': 'Your password is handled securely and is never shown to other users.',
  'customerAuth.signupIntro': 'Create one account to book services, post requirements, and manage your activity.',
  'customerAuth.confirmationEyebrow': 'Email confirmation',
  'customerAuth.confirmationTitle': 'Check your email to finish creating your account.',
  'customerAuth.confirmationBody': 'We created your account, but you are not signed in yet. Open the confirmation email sent to',
  'customerAuth.confirmationHelp': 'After confirming your email, return to TakeItEsee and sign in.',
  'customerAuth.confirmationSignIn': 'Back to sign in',
  'customerAuth.forgotLink': 'Forgot password?',
  'customerAuth.forgotEyebrow': 'Account recovery',
  'customerAuth.forgotTitle': 'Reset your password.',
  'customerAuth.forgotIntro': 'Enter the email address you use for TakeItEsee. We will request a secure password-reset email.',
  'customerAuth.forgotSubmit': 'Send reset email',
  'customerAuth.forgotSentTitle': 'Check your email.',
  'customerAuth.forgotSentBody': 'If a TakeItEsee account can receive password-reset email at that address, a recovery message has been requested. Follow the link in that email to choose a new password.',
  'customerAuth.forgotError': 'Unable to request a password-reset email right now. Try again later.',
  'customerAuth.resetEyebrow': 'Secure password reset',
  'customerAuth.resetTitle': 'Choose a new password.',
  'customerAuth.resetIntro': 'Use the secure recovery link from your email to set a new password for your TakeItEsee account.',
  'customerAuth.resetChecking': 'Checking your secure recovery session…',
  'customerAuth.resetInvalidTitle': 'This recovery link is not active.',
  'customerAuth.resetInvalidBody': 'Request a new password-reset email and open the latest recovery link.',
  'customerAuth.resetPassword': 'New password',
  'customerAuth.resetConfirm': 'Confirm new password',
  'customerAuth.resetHint': 'Use at least 8 characters. Your Supabase Auth policy may require a stronger password.',
  'customerAuth.resetSubmit': 'Update password',
  'customerAuth.resetMismatch': 'The two passwords do not match.',
  'customerAuth.resetTooShort': 'Use a password with at least 8 characters.',
  'customerAuth.resetError': 'Unable to update your password. Request a fresh recovery link and try again.',
  'customerAuth.resetDoneTitle': 'Your password has been updated.',
  'customerAuth.resetDoneBody': 'You can continue to your TakeItEsee account with your new password.',
  'customerAuth.accountAction': 'Continue to account',
  'customerAuth.requestAnother': 'Request another reset email',
  'customerAuth.backToSignIn': 'Back to sign in',
  'customerAuth.password.show': 'Show password',
  'customerAuth.password.hide': 'Hide password',
  'customerAuth.email': 'Email',
} as const;

export type CustomerAuthKey = keyof typeof english;

const tamil: Record<CustomerAuthKey, string> = {
  'customerAuth.badge': 'பாதுகாப்பான கணக்கு',
  'customerAuth.passwordHint': 'உங்கள் கடவுச்சொல் பாதுகாப்பாக கையாளப்படுகிறது; அது மற்ற பயனர்களுக்கு காட்டப்படாது.',
  'customerAuth.signupIntro': 'சேவைகளை முன்பதிவு செய்ய, தேவைகளை பதிவிட மற்றும் உங்கள் செயல்பாடுகளை நிர்வகிக்க ஒரே கணக்கை உருவாக்குங்கள்.',
  'customerAuth.confirmationEyebrow': 'Email உறுதிப்படுத்தல்',
  'customerAuth.confirmationTitle': 'உங்கள் account உருவாக்கத்தை முடிக்க email-ஐ சரிபார்க்கவும்.',
  'customerAuth.confirmationBody': 'உங்கள் account உருவாக்கப்பட்டது, ஆனால் இன்னும் sign in ஆகவில்லை. Confirmation email அனுப்பப்பட்ட முகவரி:',
  'customerAuth.confirmationHelp': 'Email-ஐ confirm செய்த பிறகு TakeItEsee-க்கு திரும்பி sign in செய்யவும்.',
  'customerAuth.confirmationSignIn': 'Sign in-க்கு திரும்பவும்',
  'customerAuth.forgotLink': 'Password மறந்துவிட்டதா?',
  'customerAuth.forgotEyebrow': 'Account recovery',
  'customerAuth.forgotTitle': 'உங்கள் password-ஐ reset செய்யுங்கள்.',
  'customerAuth.forgotIntro': 'TakeItEsee-க்கு பயன்படுத்தும் email address-ஐ உள்ளிடவும். பாதுகாப்பான password-reset email-ஐ request செய்வோம்.',
  'customerAuth.forgotSubmit': 'Reset email அனுப்பவும்',
  'customerAuth.forgotSentTitle': 'உங்கள் email-ஐ சரிபார்க்கவும்.',
  'customerAuth.forgotSentBody': 'இந்த email address-க்கு TakeItEsee password-reset email பெறக்கூடிய account இருந்தால், recovery message request செய்யப்பட்டுள்ளது. புதிய password தேர்வு செய்ய அந்த email-ல் உள்ள link-ஐ திறக்கவும்.',
  'customerAuth.forgotError': 'இப்போது password-reset email request செய்ய முடியவில்லை. சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.',
  'customerAuth.resetEyebrow': 'பாதுகாப்பான password reset',
  'customerAuth.resetTitle': 'புதிய password-ஐ தேர்வு செய்யுங்கள்.',
  'customerAuth.resetIntro': 'உங்கள் TakeItEsee account-க்கு புதிய password அமைக்க email-ல் வந்த secure recovery link-ஐ பயன்படுத்தவும்.',
  'customerAuth.resetChecking': 'உங்கள் secure recovery session-ஐ சரிபார்க்கிறது…',
  'customerAuth.resetInvalidTitle': 'இந்த recovery link தற்போது active இல்லை.',
  'customerAuth.resetInvalidBody': 'புதிய password-reset email-ஐ request செய்து அதில் வரும் சமீபத்திய recovery link-ஐ திறக்கவும்.',
  'customerAuth.resetPassword': 'புதிய password',
  'customerAuth.resetConfirm': 'புதிய password-ஐ மீண்டும் உள்ளிடவும்',
  'customerAuth.resetHint': 'குறைந்தது 8 characters பயன்படுத்தவும். உங்கள் Supabase Auth policy இன்னும் வலுவான password-ஐ கேட்கலாம்.',
  'customerAuth.resetSubmit': 'Password update செய்யவும்',
  'customerAuth.resetMismatch': 'இரண்டு passwords-மும் பொருந்தவில்லை.',
  'customerAuth.resetTooShort': 'குறைந்தது 8 characters உள்ள password பயன்படுத்தவும்.',
  'customerAuth.resetError': 'Password-ஐ update செய்ய முடியவில்லை. புதிய recovery link request செய்து மீண்டும் முயற்சிக்கவும்.',
  'customerAuth.resetDoneTitle': 'உங்கள் password update செய்யப்பட்டது.',
  'customerAuth.resetDoneBody': 'புதிய password உடன் உங்கள் TakeItEsee account-ஐ தொடர்ந்து பயன்படுத்தலாம்.',
  'customerAuth.accountAction': 'Account-க்கு செல்லவும்',
  'customerAuth.requestAnother': 'மற்றொரு reset email request செய்யவும்',
  'customerAuth.backToSignIn': 'Sign in-க்கு திரும்பவும்',
  'customerAuth.password.show': 'Password-ஐ காட்டு',
  'customerAuth.password.hide': 'Password-ஐ மறை',
  'customerAuth.email': 'மின்னஞ்சல்',
};

const catalogs = { 'en-IN': english, 'ta-IN': tamil } as const;

export function useCustomerAuthTranslations() {
  const { locale } = useLanguage();
  return useMemo(() => ({
    locale,
    t: (key: CustomerAuthKey) => catalogs[locale][key] ?? english[key],
  }), [locale]);
}
