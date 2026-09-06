import { LoginForm } from '../../components/auth/AuthForms';
import { EmailConfirmationResend } from '../../components/auth/EmailConfirmationResend';

type LoginSearchParams = {
  returnTo?: string;
  confirmation?: string;
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<LoginSearchParams> }) {
  const params = await searchParams;
  const confirmationFailed = params.confirmation === 'failed';

  return (
    <>
      {confirmationFailed ? (
        <div className="auth-page">
          <div className="card auth-card">
            <span className="badge badge-info">Email confirmation</span>
            <p className="field-error" role="alert">
              This email confirmation link is invalid or has expired. Request a fresh confirmation email below.
            </p>
            <p>
              இந்த email confirmation link செல்லுபடியாகவில்லை அல்லது காலாவதியாகிவிட்டது. கீழே புதிய confirmation email request செய்யவும்.
            </p>
            <EmailConfirmationResend />
          </div>
        </div>
      ) : null}
      <LoginForm returnTo={params.returnTo ?? null} />
    </>
  );
}
