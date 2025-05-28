import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField, FormValidation, validators, composeValidators, FormErrors } from "@/components/ui/form-field";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/components/ui/use-toast";
import { useApiClient } from "@/lib/api-client";
import { Separator } from "@/components/ui/separator";

export default function NotificationTestPage() {
  const notifications = useNotifications();
  const { toast, success, error, warning, info, loading } = useToast();
  const apiClient = useApiClient();

  // Form state for testing validation
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    message: ""
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate form
  const validateForm = () => {
    const errors: FormErrors = {};

    errors.email = composeValidators(
      validators.required,
      validators.email
    )(formData.email);

    errors.password = composeValidators(
      validators.required,
      validators.minLength(8)
    )(formData.password);

    errors.name = validators.required(formData.name);

    errors.phone = formData.phone ? validators.phone(formData.phone) : undefined;

    errors.message = composeValidators(
      validators.required,
      validators.minLength(10),
      validators.maxLength(500)
    )(formData.message);

    setFormErrors(errors);
    return !Object.values(errors).some(error => Boolean(error));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      notifications.error("Form Validation Failed", "Please fix the errors below");
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      notifications.success("Form Submitted", "Your information has been saved successfully");
      setFormData({ email: "", password: "", name: "", phone: "", message: "" });
      setFormErrors({});
    } catch (error) {
      notifications.error("Submission Failed", "Unable to save your information. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Test notification scenarios
  const testScenarios = [
    {
      title: "Success Scenarios",
      tests: [
        {
          name: "Vehicle Added",
          action: () => notifications.success("Vehicle Added", "2024 Honda Civic has been added to inventory"),
        },
        {
          name: "User Login",
          action: () => success({
            title: "Login Successful",
            description: "Welcome back to CleanRylie!",
          }),
        },
        {
          name: "Data Saved",
          action: () => notifications.success("Changes Saved", "Your dealership settings have been updated"),
        },
      ]
    },
    {
      title: "Error Scenarios",
      tests: [
        {
          name: "Import Failed",
          action: () => notifications.error(
            "Import Failed",
            "Unable to process inventory file. Please check the format and try again.",
            {
              action: {
                label: "Retry Import",
                onClick: () => notifications.info("Retry Triggered", "Retrying import...")
              }
            }
          ),
        },
        {
          name: "Session Expired",
          action: () => error({
            title: "Session Expired",
            description: "Your session has expired. Please log in again.",
            action: {
              label: "Log In",
              onClick: () => window.location.href = "/auth"
            }
          }),
        },
        {
          name: "Network Error",
          action: () => notifications.error(
            "Network Error",
            "Unable to connect to the server. Please check your internet connection.",
            {
              action: {
                label: "Retry",
                onClick: () => notifications.info("Retrying", "Attempting to reconnect...")
              }
            }
          ),
        },
      ]
    },
    {
      title: "Warning Scenarios",
      tests: [
        {
          name: "Low Inventory",
          action: () => notifications.warning("Low Inventory", "You have less than 5 vehicles in stock for Honda Civic"),
        },
        {
          name: "Unsaved Changes",
          action: () => warning({
            title: "Unsaved Changes",
            description: "You have unsaved changes. Save before leaving?",
            action: {
              label: "Save Changes",
              onClick: () => notifications.success("Saved", "Changes saved successfully")
            }
          }),
        },
        {
          name: "Rate Limit Warning",
          action: () => notifications.warning("Rate Limit", "You're approaching your API rate limit"),
        },
      ]
    },
    {
      title: "Info Scenarios",
      tests: [
        {
          name: "Feature Update",
          action: () => notifications.info("New Feature", "Chat analytics are now available in your dashboard"),
        },
        {
          name: "Maintenance Notice",
          action: () => info({
            title: "Scheduled Maintenance",
            description: "System maintenance scheduled for tonight 2-4 AM EST",
          }),
        },
        {
          name: "Tip",
          action: () => notifications.info("Pro Tip", "Use keyboard shortcuts Ctrl+S to save your work quickly"),
        },
      ]
    },
    {
      title: "Loading Scenarios",
      tests: [
        {
          name: "Processing Import",
          action: () => {
            const id = notifications.loading("Processing", "Importing inventory data...");
            setTimeout((): void => {
              notifications.removeNotification(id);
              notifications.success("Import Complete", "Successfully imported 150 vehicles");
            }, 3000);
          },
        },
        {
          name: "Generating Report",
          action: () => {
            const loadingToast = loading({
              title: "Generating Report",
              description: "This may take a few moments...",
            });
            setTimeout((): void => {
              loadingToast.dismiss();
              success({
                title: "Report Ready",
                description: "Your analytics report has been generated",
              });
            }, 4000);
          },
        },
      ]
    },
    {
      title: "API Error Scenarios",
      tests: [
        {
          name: "Test 401 Unauthorized",
          action: async () => {
            try {
              await apiClient.request('/test-401', {
                showErrorToast: true,
                errorMessage: "Authentication required. Please log in."
              });
            } catch (error) {
              console.log("Expected 401 error caught:", error);
            }
          },
        },
        {
          name: "Test 404 Not Found",
          action: async () => {
            try {
              await apiClient.request('/test-404', {
                showErrorToast: true,
                errorMessage: "The requested resource was not found."
              });
            } catch (error) {
              console.log("Expected 404 error caught:", error);
            }
          },
        },
        {
          name: "Test Network Error",
          action: async () => {
            try {
              await apiClient.request('/invalid-endpoint-12345', {
                showErrorToast: true
              });
            } catch (error) {
              console.log("Expected network error caught:", error);
            }
          },
        },
      ]
    }
  ];

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Notification System Testing</h1>
        <p className="text-muted-foreground">
          Test all notification types and error handling scenarios
        </p>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => notifications.clearAllNotifications()} variant="outline">
              Clear All Notifications
            </Button>
            <Button onClick={() => notifications.success("Test", "Quick success message")}>
              Quick Success
            </Button>
            <Button onClick={() => notifications.error("Test", "Quick error message")} variant="destructive">
              Quick Error
            </Button>
            <Button onClick={() => notifications.warning("Test", "Quick warning message")} variant="secondary">
              Quick Warning
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Form Validation Testing */}
      <Card>
        <CardHeader>
          <CardTitle>Form Validation Testing</CardTitle>
        </CardHeader>
        <CardContent>
          <FormValidation
            errors={formErrors}
            onSubmit={handleFormSubmit}
            isSubmitting={isSubmitting}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={(value) => setFormData(prev => ({ ...prev, email: value }))}
                onBlur={validateForm}
                error={formErrors.email}
                required
                placeholder="Enter your email"
              />

              <FormField
                label="Password"
                name="password"
                type="password"
                value={formData.password}
                onChange={(value) => setFormData(prev => ({ ...prev, password: value }))}
                onBlur={validateForm}
                error={formErrors.password}
                required
                placeholder="Enter password"
                helperText="Must be at least 8 characters"
              />

              <FormField
                label="Full Name"
                name="name"
                value={formData.name}
                onChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
                onBlur={validateForm}
                error={formErrors.name}
                required
                placeholder="Enter your full name"
              />

              <FormField
                label="Phone (Optional)"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={(value) => setFormData(prev => ({ ...prev, phone: value }))}
                onBlur={validateForm}
                error={formErrors.phone}
                placeholder="+1 (555) 123-4567"
                helperText="Include country code"
              />
            </div>

            <FormField
              label="Message"
              name="message"
              variant="textarea"
              rows={4}
              value={formData.message}
              onChange={(value) => setFormData(prev => ({ ...prev, message: value }))}
              onBlur={validateForm}
              error={formErrors.message}
              required
              placeholder="Enter your message (10-500 characters)"
              helperText={`${formData.message.length}/500 characters`}
            />

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full md:w-auto"
            >
              {isSubmitting ? "Submitting..." : "Submit Form"}
            </Button>
          </FormValidation>
        </CardContent>
      </Card>

      {/* Test Scenarios */}
      <div className="grid gap-6">
        {testScenarios.map((category, categoryIndex) => (
          <Card key={categoryIndex}>
            <CardHeader>
              <CardTitle>{category.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {category.tests.map((test, testIndex) => (
                  <Button
                    key={testIndex}
                    onClick={test.action}
                    variant="outline"
                    className="justify-start h-auto p-4 text-left"
                  >
                    <div>
                      <div className="font-medium">{test.name}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Current Notifications Display */}
      <Card>
        <CardHeader>
          <CardTitle>Active Notifications ({notifications.notifications.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.notifications.length === 0 ? (
            <p className="text-muted-foreground">No active notifications</p>
          ) : (
            <div className="space-y-2">
              {notifications.notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div>
                    <div className="font-medium">{notification.title}</div>
                    {notification.description && (
                      <div className="text-sm text-muted-foreground">
                        {notification.description}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 bg-background rounded">
                      {notification.type}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => notifications.removeNotification(notification.id)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}