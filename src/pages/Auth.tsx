import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Boxes, Loader2, Mail, UserX } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);
  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);

      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);

      setError("The verification code you entered is incorrect.");
      setIsLoading(false);

      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (error) {
      console.error("Guest login error:", error);
      setError(`Failed to sign in as guest: ${error instanceof Error ? error.message : "Unknown error"}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="clay-bg flex min-h-screen flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-7 flex flex-col items-center">
            <Link
              to="/"
              className="flex size-16 items-center justify-center rounded-3xl bg-[oklch(0.7_0.13_42)] text-white shadow-[var(--shadow-clay)] transition-transform hover:scale-105"
            >
              <Boxes className="size-8" />
            </Link>
            <h1 className="mt-4 font-display text-2xl font-extrabold text-foreground">
              NykoMart OMS
            </h1>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Nyko Mart · Rugara · CASA ARRA
            </p>
          </div>

          <Card className="clay-card border-0 bg-card pb-0">
            {step === "signIn" ? (
              <>
                <CardHeader className="text-center">
                  <CardTitle className="font-display text-xl text-foreground">
                    Sign in to the back office
                  </CardTitle>
                  <CardDescription className="font-semibold">
                    Enter your work email to log in or sign up
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleEmailSubmit}>
                  <CardContent>
                    <div className="relative flex items-center gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          name="email"
                          placeholder="name@example.com"
                          type="email"
                          className="clay-inset rounded-full border-0 bg-muted pl-10 font-semibold shadow-none"
                          disabled={isLoading}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="default"
                        size="icon"
                        className="size-10 shrink-0 rounded-full bg-[oklch(0.7_0.13_42)] shadow-[var(--shadow-clay-sm)] hover:bg-[oklch(0.64_0.13_42)]"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {error && (
                      <p className="mt-2 text-sm font-semibold text-[oklch(0.5_0.13_27)]">{error}</p>
                    )}

                    <div className="mt-5">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-border/70" />
                        </div>
                        <div className="relative flex justify-center text-xs font-extrabold uppercase">
                          <span className="bg-card px-2 text-muted-foreground">Or</span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        className="mt-4 w-full rounded-full border-0 bg-[oklch(0.9_0.045_155)] font-extrabold text-[oklch(0.34_0.05_155)] shadow-[var(--shadow-clay-sm)] hover:bg-[oklch(0.86_0.05_155)]"
                        onClick={handleGuestLogin}
                        disabled={isLoading}
                      >
                        <UserX className="mr-2 h-4 w-4" />
                        Continue as Guest
                      </Button>
                    </div>
                  </CardContent>
                </form>
              </>
            ) : (
              <>
                <CardHeader className="mt-4 text-center">
                  <CardTitle className="font-display text-xl text-foreground">
                    Check your email
                  </CardTitle>
                  <CardDescription className="font-semibold">
                    We&apos;ve sent a code to {step.email}
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleOtpSubmit}>
                  <CardContent className="pb-4">
                    <input type="hidden" name="email" value={step.email} />
                    <input type="hidden" name="code" value={otp} />

                    <div className="flex justify-center">
                      <InputOTP
                        value={otp}
                        onChange={setOtp}
                        maxLength={6}
                        disabled={isLoading}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                            const form = (e.target as HTMLElement).closest("form");
                            if (form) {
                              form.requestSubmit();
                            }
                          }
                        }}
                      >
                        <InputOTPGroup className="gap-2">
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot
                              key={index}
                              index={index}
                              className="clay-inset size-11 rounded-2xl first:rounded-2xl last:rounded-2xl border-y-0 border-r-0 first:border-l-0 bg-muted text-lg font-extrabold text-foreground shadow-[var(--shadow-clay-inset)] data-[active=true]:shadow-[var(--shadow-clay-press)] data-[active=true]:ring-2 data-[active=true]:ring-[oklch(0.7_0.13_42)] data-[active=true]:ring-offset-0"
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {error && (
                      <p className="mt-2 text-center text-sm font-semibold text-[oklch(0.5_0.13_27)]">
                        {error}
                      </p>
                    )}
                    <p className="mt-4 text-center text-sm font-semibold text-muted-foreground">
                      Didn&apos;t receive a code?{" "}
                      <Button
                        variant="link"
                        className="h-auto p-0 font-extrabold text-[oklch(0.58_0.13_42)]"
                        onClick={() => setStep("signIn")}
                      >
                        Try again
                      </Button>
                    </p>
                  </CardContent>
                  <CardFooter className="flex-col gap-2">
                    <Button
                      type="submit"
                      className="w-full rounded-full bg-[oklch(0.7_0.13_42)] font-extrabold shadow-[var(--shadow-clay)] hover:bg-[oklch(0.64_0.13_42)]"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          Verify code
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep("signIn")}
                      disabled={isLoading}
                      className="w-full rounded-full font-bold"
                    >
                      Use different email
                    </Button>
                  </CardFooter>
                </form>
              </>
            )}

            <div className="rounded-b-[calc(var(--radius-xl)-6px)] border-t border-border/60 bg-muted px-6 py-4 text-center text-xs font-bold text-muted-foreground">
              Secured by{" "}
              <a
                href="https://www.nykoinfotech.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline transition-colors hover:text-foreground"
              >
                nykoinfotech.com
              </a>
            </div>
          </Card>

          <p className="mt-6 text-center text-xs font-semibold text-muted-foreground">
            <Link to="/" className="font-extrabold underline-offset-2 hover:underline">
              ← Back to the landing page
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}