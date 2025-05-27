import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useSearchParams } from '../hooks/use-search-params';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoaderCircle, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';

export default function VerifyMagicLinkPage() {
  const [, setLocation] = useLocation();
  const { verifyMagicLink } = useAuth();
  const { getParam } = useSearchParams();
  const token = getParam('token');
  const email = getParam('email');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const verify = async () => {
      if (!token || !email) {
        setStatus('error');
        setErrorMessage('Invalid verification link. Please request a new one.');
        return;
      }

      try {
        const result = await verifyMagicLink(token, email);
        if (result.success) {
          setStatus('success');
          
          // Redirect to dashboard after successful verification
          setTimeout(() => {
            setLocation('/');
          }, 2000);
        } else {
          setStatus('error');
          setErrorMessage(result.message || 'Verification failed. Please try again.');
        }
      } catch (error) {
        setStatus('error');
        setErrorMessage('An error occurred while verifying your link. Please try again.');
        console.error('Verification error:', error);
      }
    };

    verify();
  }, [token, email, verifyMagicLink, setLocation]);

  return (
    <div className="container flex items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Magic Link Verification</CardTitle>
          <CardDescription className="text-center">
            Verifying your secure access link
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex flex-col items-center justify-center py-6 space-y-4">
          {status === 'loading' && (
            <>
              <LoaderCircle className="h-16 w-16 text-primary animate-spin" />
              <p className="text-center text-lg">Verifying your magic link...</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="h-16 w-16 text-green-500" />
              <p className="text-center text-lg font-medium text-green-600">Verification successful!</p>
              <p className="text-center">You'll be redirected to the dashboard in a moment.</p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="h-16 w-16 text-red-500" />
              <p className="text-center text-lg font-medium text-red-600">Verification failed</p>
              <p className="text-center">{errorMessage}</p>
            </>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-center">
          {status === 'error' && (
            <Button 
              variant="outline" 
              onClick={() => setLocation('/auth')}
              className="flex items-center"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to login
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}