"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { errorMessage } from "@/lib/api";
import styles from "./signin.module.css";

const REMEMBER_KEY = "r53.rememberedAccount";

function SignInForm() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") || "/route53/v2/hostedzones";

  const [account, setAccount] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setAccount(saved);
        setRemember(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!loading && user) router.replace(redirect.startsWith("/") ? redirect : "/route53/v2/hostedzones");
  }, [loading, user, redirect, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!account || !username || !password) {
      setError("Enter your account ID or alias, IAM user name and password.");
      return;
    }
    setSubmitting(true);
    try {
      await login(account.trim(), username.trim(), password);
      try {
        if (remember) window.localStorage.setItem(REMEMBER_KEY, account.trim());
        else window.localStorage.removeItem(REMEMBER_KEY);
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.logo}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/aws-logo.svg" alt="Amazon Web Services" />
      </div>
      <main className={styles.main}>
        <form className={styles.card} onSubmit={onSubmit} noValidate>
          <h1>Sign in as IAM user</h1>
          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}
          <div className={styles.hint}>
            Demo credentials: account <code>123456789012</code> (or alias <code>demo</code>), user <code>admin</code>,
            password <code>Route53Demo!</code>{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setAccount("123456789012");
                setUsername("admin");
                setPassword("Route53Demo!");
              }}
            >
              Fill in
            </a>
          </div>
          <div className={styles.field}>
            <label htmlFor="account">Account ID (12 digits) or account alias</label>
            <input id="account" value={account} onChange={(e) => setAccount(e.target.value)} autoComplete="organization" />
          </div>
          <div className={styles.field}>
            <label htmlFor="username">IAM user name</label>
            <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
          </div>
          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <label className={styles.check}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember this account
          </label>
          <button className={styles.primary} type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </button>
          <div className={styles.links}>
            <a href="#" onClick={(e) => e.preventDefault()}>
              Sign in using root user email
            </a>
            <a href="#" onClick={(e) => e.preventDefault()}>
              Forgot password?
            </a>
          </div>
        </form>
        <aside className={styles.promo}>
          <div>
            <h2>Amazon Route 53</h2>
            <p>
              A reliable and cost-effective way to route end users to Internet applications. Manage hosted zones and
              DNS records for your domains from one console.
            </p>
          </div>
          <a className={styles.promoBtn} href="https://aws.amazon.com/route53/" target="_blank" rel="noreferrer">
            Learn more
          </a>
        </aside>
      </main>
      <footer className={styles.footer}>
        <a href="#">Terms of Use</a>|<a href="#">Privacy Policy</a>
        <div style={{ marginTop: 6 }}>
          A Route 53 console clone built for a coursework assignment. Not affiliated with Amazon Web Services.
        </div>
      </footer>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
