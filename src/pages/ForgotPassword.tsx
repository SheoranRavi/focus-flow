import React, { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { Link } from "react-router-dom";
import { auth } from "../firebase";
import Button from "../components/ui/Button";

function getResetErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;

  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-not-found":
      return "No account was found for that email address.";
    case "auth/too-many-requests":
      return "Too many reset requests. Please wait a little and try again.";
    default:
      return "We couldn't send the reset email. Please try again.";
  }
}

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSent(false);

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (resetError) {
      setError(getResetErrorMessage(resetError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Reset your password
          </h1>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your email and we&apos;ll send you a link to choose a new password.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div role="alert" className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {sent && (
            <div role="status" className="rounded-md bg-green-50 p-4">
              <p className="text-sm text-green-800">
                Check your inbox for a password reset link. It may take a few minutes to arrive.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="reset-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-brand focus:border-brand sm:text-sm"
              placeholder="Email address"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-brand text-white hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending..." : "Send reset link"}
          </Button>

          <p className="text-center text-sm text-gray-600">
            Remember your password?{" "}
            <Link to="/login" className="font-medium text-brand hover:text-brand/80">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
