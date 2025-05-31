import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AuthPage() {
  // Get auth functions from our simplified hook
  const { user, isAuthenticated, loginMutation, registerMutation } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");

  // Login form state
  const [loginData, setLoginData] = useState({
    username: "",
    password: "",
  });

  // Register form state
  const [registerData, setRegisterData] = useState({
    username: "",
    password: "",
    email: "",
  });

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      // Check if there's a saved redirect path
      const redirectPath = localStorage.getItem("redirectAfterLogin") || "/";
      navigate(redirectPath);
      // Clear the saved path
      localStorage.removeItem("redirectAfterLogin");
    }
  }, [isAuthenticated, navigate]);

  // Early return if already authenticated
  if (isAuthenticated) {
    return null;
  }

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRegisterData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLoginSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    loginMutation.mutate(loginData, {
      onSuccess: () => {
        navigate("/");
      },
    });
  };

  const handleRegisterSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    registerMutation.mutate(registerData, {
      onSuccess: () => {
        navigate("/");
      },
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Left side - Auth form */}
      <div className="flex flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24 w-full lg:w-1/2">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Welcome to Automotive Sales AI
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {activeTab === "login"
                ? "Sign in to access your account"
                : "Create an account to get started"}
            </p>
          </div>

          <div className="mb-6">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                className={`px-4 py-2 font-medium text-sm ${
                  activeTab === "login"
                    ? "border-b-2 border-primary text-primary"
                    : "text-gray-500 dark:text-gray-400"
                }`}
                onClick={() => setActiveTab("login")}
              >
                Sign In
              </button>
              <button
                className={`px-4 py-2 font-medium text-sm ${
                  activeTab === "register"
                    ? "border-b-2 border-primary text-primary"
                    : "text-gray-500 dark:text-gray-400"
                }`}
                onClick={() => setActiveTab("register")}
              >
                Create Account
              </button>
            </div>
          </div>

          {activeTab === "login" ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Username
                </label>
                <Input
                  id="username"
                  name="username"
                  value={loginData.username}
                  onChange={handleLoginChange}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Password
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={loginData.password}
                  onChange={handleLoginChange}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isLoading}
                >
                  {loginMutation.isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="reg-username"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Username
                </label>
                <Input
                  id="reg-username"
                  name="username"
                  value={registerData.username}
                  onChange={handleRegisterChange}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Password
                </label>
                <Input
                  id="reg-password"
                  name="password"
                  type="password"
                  value={registerData.password}
                  onChange={handleRegisterChange}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Email (optional)
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={registerData.email}
                  onChange={handleRegisterChange}
                  className="mt-1"
                />
              </div>

              {/* Name fields removed for simplicity */}

              <div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerMutation.isLoading}
                >
                  {registerMutation.isLoading
                    ? "Creating account..."
                    : "Create Account"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Right side - Hero image/info */}
      <div className="hidden lg:block relative lg:w-1/2">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-700 flex flex-col justify-center p-12">
          <div className="max-w-md">
            <h2 className="text-3xl font-extrabold text-white mb-6">
              Automotive Sales AI Platform
            </h2>
            <p className="text-white text-lg mb-8">
              Our advanced AI platform helps automotive dealerships streamline
              sales processes, capture leads, and improve customer engagement
              through intelligent conversation management.
            </p>
            <ul className="space-y-4">
              <li className="flex items-center text-white">
                <svg
                  className="h-6 w-6 mr-2 text-indigo-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Advanced prompt testing and optimization
              </li>
              <li className="flex items-center text-white">
                <svg
                  className="h-6 w-6 mr-2 text-indigo-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Customer intent analysis and lead qualification
              </li>
              <li className="flex items-center text-white">
                <svg
                  className="h-6 w-6 mr-2 text-indigo-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Seamless integration with your existing workflows
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
