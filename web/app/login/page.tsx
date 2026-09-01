import { LoginForm } from '../../components/auth/AuthForms';

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
          <div className="card auth-card" role="alert">
            <span className="badge badge-info">Email confirmation</span>
            <p className="field-error">
              This email confirmation link is invalid or has expired. Open the latest confirmation email, or return to signup and try again.
            </p>
            <p>
              இந்த email confirmation link செல்லுபடியாகவில்லை அல்லது காலாவதியாகிவிட்டது. சமீபத்திய confirmation email-ஐ திறக்கவும், அல்லது signup-க்கு திரும்பி மீண்டும் முயற்சிக்கவும்.
            </p>
          </div>
        </div>
      ) : null}
      <LoginForm returnTo={params.returnTo ?? null} />
    </>
  );
}
