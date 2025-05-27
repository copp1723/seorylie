import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Form validation schema
const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

// Define the form values type
type FormValues = z.infer<typeof formSchema>;

export function MagicLinkForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/public/magic-link/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send magic link");
      }

      // Show success message
      setIsEmailSent(true);
      toast({
        title: "Magic Link Sent!",
        description: "Check your email for the login link",
      });
    } catch (error) {
      console.error("Magic link request error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to send magic link",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {isEmailSent ? (
        <div className="text-center py-4 space-y-4">
          <Mail className="mx-auto h-12 w-12 text-primary" />
          <h3 className="text-xl font-medium">Check your inbox</h3>
          <p className="text-muted-foreground">
            We've sent a magic link to your email address. Click the link in the
            email to sign in.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setIsEmailSent(false)}
          >
            Use a different email
          </Button>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your email address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              <Mail className="mr-2 h-4 w-4" />
              {isLoading ? "Sending..." : "Send Magic Link"}
            </Button>
          </form>
        </Form>
      )}
    </div>
  );
}
