# Google Play declarations evidence

This file is a repository evidence checklist for Play Console review. It does not submit or complete any Play Console declaration.

## Target audience and age eligibility

Repository evidence supports an adults-only account policy:

- TakeItEsee account creation requires the user to confirm that they are 18 years of age or older.
- Production signup records `legal_age_18_confirmed: true` in Supabase auth metadata after the required consent is accepted.
- The Terms of Service state that TakeItEsee accounts and services are intended only for persons who are 18 years of age or older.

Play Console target-audience and content-rating answers must still be completed in the authorized Console. Do not infer a questionnaire answer beyond this evidence.

## App access for Google review

Core Customer and Provider workflows are login-gated, so Play review must be given working access instructions and controlled reviewer credentials when required.

- Never commit reviewer passwords, OTPs, recovery codes, service-account credentials, or other secrets to this repository.
- Create or maintain a dedicated production reviewer account outside source control.
- Reviewer instructions should explain how to sign in and reach representative Customer and Provider functionality.
- If a workflow requires an external approval, special state, location, or other prerequisite, disclose that prerequisite in Play Console App access instructions.
- Verify the reviewer account immediately before each submission.

## Ads declaration

The repository audit has not established a final Play Console ads answer.

The current native dependency/config review does not by itself prove the behavior of the final Android artifact. Before locking the Play Console Ads declaration:

1. Build the production AAB.
2. Inspect the generated/merged Android manifest and packaged SDK/dependency set.
3. Verify actual production runtime behavior for advertising, sponsored placements, or ad-serving integrations.
4. Reconcile the result with the Play Console definition in force at submission time.

Do not mark the Ads declaration complete from source-package names or marketing copy alone.

## Content rating

Content rating is a Play Console questionnaire and cannot be completed from repository configuration alone. Use actual shipped functionality as evidence, including user-generated marketplace content, messaging, provider/customer interactions, moderation, and any other questionnaire-relevant behavior.

The repository's 18+ eligibility rule does not replace the Play content-rating questionnaire and must not be treated as a rating result.

## Submission gates

Before Play Internal Testing submission is treated as release-ready:

- production AAB signing/keystore state verified in the authorized EAS account;
- final AAB/merged manifest and packaged SDK audit completed;
- Data Safety answers reconciled with the shipped artifact and Privacy Policy;
- Ads declaration completed from verified shipped behavior;
- Target Audience and Content Rating questionnaires completed in Play Console;
- App Access reviewer credentials/instructions verified outside source control;
- store screenshots captured from real current production/native screens;
- Play Console-only account, signing, and disclosure state verified.

The configured submit track remains `internal`; this checklist does not authorize changing it to production.
