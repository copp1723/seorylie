import React, { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { CheckCircle, Loader2, Mail } from "lucide-react";

// Form validation schema
const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type FormValues = z.infer<typeof formSchema>;

export default function MagicLinkForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();
  const { loginWithMagicLink } = useAuth();
  const [, setLocation] = useLocation();

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);

    try {
      // Use the loginWithMagicLink function from auth hook
      const success = await loginWithMagicLink(values.email);

      if (success) {
        // Set success state
        setIsSuccess(true);
      }
    } catch (error) {
      // Show error toast (should be handled by the auth hook)
      console.error("Error requesting magic link:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToLogin = () => {
    setLocation("/auth");
  };

  const requestNewLink = () => {
    setIsSuccess(false);
    form.reset();
  };

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            Magic Link Login
          </CardTitle>
          <CardDescription className="text-center">
            Enter your email address to receive a secure login link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isSuccess ? (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="email@example.com"
                          type="email"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Magic Link
                    </>
                  )}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-4 py-6">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <div className="text-center space-y-2">
                <p className="font-medium">Magic link sent!</p>
                <p className="text-muted-foreground">
                  Please check your email inbox for a secure login link. The
                  link will expire in 24 hours.
                </p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          {isSuccess ? (
            <div className="space-x-4">
              <Button variant="outline" onClick={requestNewLink}>
                Request New Link
              </Button>
              <Button variant="secondary" onClick={goToLogin}>
                Back to Login
              </Button>
            </div>
          ) : (
            <Button variant="link" onClick={goToLogin}>
              Return to Login
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
