"use client";
import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useToast } from "./hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./components/ui/form";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";

const signInSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
});

const signUpSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
});

export function SignInForm() {
  const { signIn } = useAuthActions();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");

  const signInForm = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
    },
  });

  const signUpForm = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
    },
  });

  const handleSignIn = async (values: z.infer<typeof signInSchema>) => {
    try {
      const formData = new FormData();
      formData.set("email", values.email);
      formData.set("password", "password"); // Simplified for demo
      formData.set("flow", "signIn");

      await signIn("password", formData);
      toast({
        title: "Verification email sent",
        description: "Check your email for a verification link",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign in",
        variant: "destructive",
      });
    }
  };

  const handleSignUp = async (values: z.infer<typeof signUpSchema>) => {
    try {
      const formData = new FormData();
      formData.set("email", values.email);
      formData.set("name", values.name);
      formData.set("password", "password"); // Simplified for demo
      formData.set("flow", "signUp");

      await signIn("password", formData);
      toast({
        title: "Verification email sent",
        description: "Check your email for a verification link",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign up",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-full">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "signin" | "signup")}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin">Sign In</TabsTrigger>
          <TabsTrigger value="signup">Sign Up</TabsTrigger>
        </TabsList>
        <TabsContent value="signin" className="pt-4">
          <Form {...signInForm}>
            <form
              onSubmit={signInForm.handleSubmit(handleSignIn)}
              className="space-y-4"
            >
              <FormField
                control={signInForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="your.email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">
                Sign in with Email
              </Button>
            </form>
          </Form>
        </TabsContent>
        <TabsContent value="signup" className="pt-4">
          <Form {...signUpForm}>
            <form
              onSubmit={signUpForm.handleSubmit(handleSignUp)}
              className="space-y-4"
            >
              <FormField
                control={signUpForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={signUpForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="your.email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">
                Sign up with Email
              </Button>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
