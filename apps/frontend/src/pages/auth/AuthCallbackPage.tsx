import { type ReactElement, useEffect, useState } from 'react';
import { beginDiscordLoginRedirect, completeDiscordCallback } from '@features/auth';

type CallbackStatus = 'loading' | 'ok' | 'error';

type CallbackViewModel = {
  status: CallbackStatus;
  title: string;
  message: string;
  detail?: string;
};

const CALLBACK_COPY: Record<CallbackStatus, CallbackViewModel> = {
  loading: {
    status: 'loading',
    title: 'Connecting your FAKAP account',
    message: 'We are securely completing your Discord sign-in and restoring your previous page.',
  },
  ok: {
    status: 'ok',
    title: 'Login successful',
    message: 'Authentication completed. You are being redirected back now.',
  },
  error: {
    status: 'error',
    title: 'Could not complete login',
    message: 'The callback was invalid, expired, or interrupted before completion.',
    detail: 'Please retry sign-in. If this continues, return to the app and start login again.',
  },
};

export function AuthCallbackPage(): ReactElement {
  const [status, setStatus] = useState<CallbackStatus>('loading');

  useEffect(() => {
    const run = async (): Promise<void> => {
      const params = new URLSearchParams(window.location.search);
      const state = params.get('state');

      try {
        const result = await completeDiscordCallback({
          state,
        });

        setStatus('ok');
        const target = result.returnTo ?? '/';
        window.setTimeout(() => {
          window.location.replace(target);
        }, 800);
      } catch {
        setStatus('error');
      }
    };

    void run();
  }, []);

  const content = CALLBACK_COPY[status];

  return (
    <main className="auth-callback-page">
      <section className="auth-callback-card" aria-live="polite" aria-busy={status === 'loading'}>
        <p className="auth-callback-brand">FAKA PERFORMANCE</p>
        <h1>{content.title}</h1>
        <p className="auth-callback-message">{content.message}</p>
        {content.detail ? <p className="auth-callback-detail">{content.detail}</p> : null}

        <div className="auth-callback-status" data-status={status}>
          {status === 'loading' ? <span className="auth-callback-spinner" aria-hidden="true" /> : null}
          <span>{status === 'loading' ? 'Authenticating…' : status === 'ok' ? 'Redirecting…' : 'Action required'}</span>
        </div>

        {status === 'error' ? (
          <div className="auth-callback-actions">
            <button
              type="button"
              className="btn btn-solid"
              onClick={() => {
                void beginDiscordLoginRedirect();
              }}
            >
              Retry login
            </button>
            <a className="btn btn-ghost" href="/">
              Cancel
            </a>
          </div>
        ) : null}
      </section>
    </main>
  );
}
